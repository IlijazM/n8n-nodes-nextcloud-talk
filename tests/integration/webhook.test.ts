import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { NextcloudTalkWebhookTrigger } from '../../nodes/NextcloudTalk/NextcloudTalkWebhookTrigger.node';
import { NEXTCLOUD_TALK_CURSORS_KEY } from '../../nodes/NextcloudTalk/types';
import { createMockWebhookContext } from './helpers/realContext';

const BOT_SECRET = 'integration_test_bot_secret_at_least_40_chars_long';

function makeSignedRequest(args: {
	body: Record<string, unknown>;
	secret?: string;
	random?: string;
}) {
	const secret = args.secret ?? BOT_SECRET;
	const random = args.random ?? crypto.randomBytes(32).toString('hex');
	const rawBody = JSON.stringify(args.body);
	const signature = crypto.createHmac('sha256', secret).update(random + rawBody).digest('hex');
	return {
		headers: {
			'x-nextcloud-talk-random': random,
			'x-nextcloud-talk-signature': signature,
		},
		rawBody,
	};
}

function makeChatPayload(opts: {
	id: number;
	token: string;
	actorIdRaw: string;
	actorName?: string;
	message: string;
	objectType?: string;
	objectName?: string;
}) {
	return {
		type: 'Activity',
		actor: {
			type: 'Person',
			id: opts.actorIdRaw,
			name: opts.actorName ?? 'Test User',
		},
		object: {
			type: opts.objectType ?? 'Note',
			id: opts.id,
			name: opts.objectName ?? 'message',
			content: JSON.stringify({ message: opts.message, parameters: [] }),
			mediaType: 'text/markdown',
		},
		target: {
			type: 'Collection',
			id: opts.token,
			name: 'Test Conversation',
		},
	};
}

describe('NextcloudTalkWebhookTrigger', () => {
	const node = new NextcloudTalkWebhookTrigger();

	it('rejects requests with missing signature headers as 401', async () => {
		const body = makeChatPayload({ id: 1, token: 'tok1', actorIdRaw: 'users/alice', message: 'hi' });
		const { ctx, response } = createMockWebhookContext({
			params: {
				botSecret: BOT_SECRET,
				conversationMode: 'all',
				options: { ignoreSystemMessages: true },
			},
			headers: {},
			body,
		});

		const result = await node.webhook.call(ctx);

		expect(response.status).toBe(401);
		expect(result).toEqual({ noWebhookResponse: true });
	});

	it('rejects requests with an invalid signature as 403', async () => {
		const body = makeChatPayload({ id: 2, token: 'tok1', actorIdRaw: 'users/alice', message: 'hi' });
		const { rawBody } = makeSignedRequest({ body });
		const { ctx, response } = createMockWebhookContext({
			params: {
				botSecret: BOT_SECRET,
				conversationMode: 'all',
				options: { ignoreSystemMessages: true },
			},
			headers: {
				'x-nextcloud-talk-random': 'a'.repeat(64),
				// tamper with the signature: same length, wrong content
				'x-nextcloud-talk-signature': 'f'.repeat(64),
			},
			body,
			rawBody,
		});

		const result = await node.webhook.call(ctx);

		expect(response.status).toBe(403);
		expect(result).toEqual({ noWebhookResponse: true });
	});

	it('accepts a valid signature and emits a normalized message', async () => {
		const body = makeChatPayload({
			id: 42,
			token: 'tok1',
			actorIdRaw: 'users/alice',
			actorName: 'Alice',
			message: 'hello world',
		});
		const { headers, rawBody } = makeSignedRequest({ body });
		const globalData: Record<string, unknown> = {};

		const { ctx } = createMockWebhookContext({
			params: {
				botSecret: BOT_SECRET,
				conversationMode: 'all',
				options: { ignoreSystemMessages: true },
			},
			headers,
			body,
			rawBody,
			globalData,
		});

		const result = await node.webhook.call(ctx);

		expect(result.workflowData).toBeDefined();
		const items = result.workflowData![0];
		expect(items).toHaveLength(1);
		const json = items[0].json;
		expect(json).toMatchObject({
			id: 42,
			token: 'tok1',
			actorType: 'users',
			actorId: 'alice',
			actorDisplayName: 'Alice',
			message: 'hello world',
			messageType: 'comment',
			isReplyable: true,
			_source: 'webhook',
		});

		// Cursor must have been advanced for cross-trigger dedup.
		const cursors = globalData[NEXTCLOUD_TALK_CURSORS_KEY] as Record<string, number>;
		expect(cursors.tok1).toBe(42);
	});

	it('filters out system messages when ignoreSystemMessages is true', async () => {
		const body = makeChatPayload({
			id: 5,
			token: 'tok1',
			actorIdRaw: 'users/system',
			message: 'someone joined',
			objectType: 'system',
		});
		const { headers, rawBody } = makeSignedRequest({ body });
		const { ctx } = createMockWebhookContext({
			params: {
				botSecret: BOT_SECRET,
				conversationMode: 'all',
				options: { ignoreSystemMessages: true },
			},
			headers,
			body,
			rawBody,
		});

		const result = await node.webhook.call(ctx);

		expect(result.workflowData).toEqual([[]]);
	});

	it('drops messages from other conversations in specific mode', async () => {
		const body = makeChatPayload({
			id: 7,
			token: 'someOtherToken',
			actorIdRaw: 'users/bob',
			message: 'noise from elsewhere',
		});
		const { headers, rawBody } = makeSignedRequest({ body });
		const { ctx } = createMockWebhookContext({
			params: {
				botSecret: BOT_SECRET,
				conversationMode: 'specific',
				tokens: { token: [{ value: 'allowedToken' }] },
				options: { ignoreSystemMessages: true },
			},
			headers,
			body,
			rawBody,
		});

		const result = await node.webhook.call(ctx);

		expect(result.workflowData).toEqual([[]]);
	});

	it('emits messages from a matching conversation in specific mode', async () => {
		const body = makeChatPayload({
			id: 8,
			token: 'allowedToken',
			actorIdRaw: 'users/bob',
			message: 'on-topic message',
		});
		const { headers, rawBody } = makeSignedRequest({ body });
		const { ctx } = createMockWebhookContext({
			params: {
				botSecret: BOT_SECRET,
				conversationMode: 'specific',
				tokens: { token: [{ value: 'allowedToken' }] },
				options: { ignoreSystemMessages: true },
			},
			headers,
			body,
			rawBody,
		});

		const result = await node.webhook.call(ctx);

		const items = result.workflowData![0];
		expect(items).toHaveLength(1);
		expect(items[0].json.message).toBe('on-topic message');
		expect(items[0].json.token).toBe('allowedToken');
	});

	it('does not lower an existing higher cursor', async () => {
		const body = makeChatPayload({
			id: 10,
			token: 'tok1',
			actorIdRaw: 'users/alice',
			message: 'older message',
		});
		const { headers, rawBody } = makeSignedRequest({ body });

		// Pre-existing cursor is already past this message id.
		const globalData: Record<string, unknown> = {
			[NEXTCLOUD_TALK_CURSORS_KEY]: { tok1: 100 },
		};

		const { ctx } = createMockWebhookContext({
			params: {
				botSecret: BOT_SECRET,
				conversationMode: 'all',
				options: { ignoreSystemMessages: true },
			},
			headers,
			body,
			rawBody,
			globalData,
		});

		await node.webhook.call(ctx);

		const cursors = globalData[NEXTCLOUD_TALK_CURSORS_KEY] as Record<string, number>;
		expect(cursors.tok1).toBe(100);
	});
});
