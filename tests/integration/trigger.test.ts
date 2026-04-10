import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextcloudTalkPollTrigger } from '../../nodes/NextcloudTalk/NextcloudTalkPollTrigger.node';
import { NEXTCLOUD_TALK_CURSORS_KEY } from '../../nodes/NextcloudTalk/types';
import { createRealPollContext } from './helpers/realContext';
import { createConversation, deleteConversation, sendMessage } from './helpers/nextcloudClient';

describe('NextcloudTalkPollTrigger', () => {
	let token: string;
	const node = new NextcloudTalkPollTrigger();

	beforeAll(async () => {
		token = await createConversation('Integration Test Trigger');
	});

	afterAll(async () => {
		if (token) await deleteConversation(token);
	});

	it('first run stores the cursor and returns null (no items emitted)', async () => {
		const globalData: Record<string, unknown> = {};
		const ctx = createRealPollContext(
			{ conversationMode: 'specific', tokens: { token: [{ value: token }] }, options: { ignoreSystemMessages: true } },
			globalData,
			'trigger',
		);

		const result = await node.poll.call(ctx);

		expect(result).toBeNull();
		// The shared cursor must have been stored
		const cursors = globalData[NEXTCLOUD_TALK_CURSORS_KEY] as Record<string, number>;
		expect(typeof cursors[token]).toBe('number');
	});

	it('second run after a new message returns that message', async () => {
		// First run: establish cursor
		const globalData: Record<string, unknown> = {};
		const firstCtx = createRealPollContext(
			{ conversationMode: 'specific', tokens: { token: [{ value: token }] }, options: { ignoreSystemMessages: true } },
			globalData,
			'trigger',
		);
		await node.poll.call(firstCtx);

		const cursorAfterFirstRun = (globalData[NEXTCLOUD_TALK_CURSORS_KEY] as Record<string, number>)[token];

		// Send a message so the next poll has something to return
		await sendMessage(token, 'trigger integration test message');

		// Second run: should detect the new message
		const secondCtx = createRealPollContext(
			{ conversationMode: 'specific', tokens: { token: [{ value: token }] }, options: { ignoreSystemMessages: true } },
			globalData,
			'trigger',
		);
		const result = await node.poll.call(secondCtx);

		expect(result).not.toBeNull();
		expect(result![0].length).toBeGreaterThan(0);

		const messages = result![0].map((item) => item.json.message);
		expect(messages).toContain('trigger integration test message');

		// Cursor should have advanced
		const cursors = globalData[NEXTCLOUD_TALK_CURSORS_KEY] as Record<string, number>;
		expect(cursors[token]).toBeGreaterThan(cursorAfterFirstRun);
	});

	it('manual mode returns the single most recent message without cursor', async () => {
		await sendMessage(token, 'manual mode test message');

		const ctx = createRealPollContext(
			{ conversationMode: 'specific', tokens: { token: [{ value: token }] }, options: { ignoreSystemMessages: true } },
			{},
			'manual',
		);
		const result = await node.poll.call(ctx);

		expect(result).not.toBeNull();
		expect(result![0]).toHaveLength(1);
		expect(result![0][0].json.message).toBe('manual mode test message');
	});

	it('actorTypes filter excludes messages from non-matching actor types', async () => {
		const globalData: Record<string, unknown> = {};

		// First run: establish cursor
		await node.poll.call(createRealPollContext(
			{ conversationMode: 'specific', tokens: { token: [{ value: token }] }, options: { ignoreSystemMessages: true, actorTypes: ['bots'] } },
			globalData, 'trigger',
		));

		// Send a user message
		await sendMessage(token, 'user message for actor filter test');

		// Poll filtering for bots only — the user message should be excluded
		const result = await node.poll.call(createRealPollContext(
			{ conversationMode: 'specific', tokens: { token: [{ value: token }] }, options: { ignoreSystemMessages: true, actorTypes: ['bots'] } },
			globalData, 'trigger',
		));

		expect(result).toBeNull();
	});

	it('all conversations mode detects messages across all conversations', async () => {
		const globalData: Record<string, unknown> = {};

		// First run in 'all' mode: establish cursors for every room
		await node.poll.call(createRealPollContext(
			{ conversationMode: 'all', botId: 0, options: { ignoreSystemMessages: true } },
			globalData, 'trigger',
		));

		// Send a message to the test conversation
		await sendMessage(token, 'all mode test message');

		// Second run: should detect the message in any conversation
		const result = await node.poll.call(createRealPollContext(
			{ conversationMode: 'all', botId: 0, options: { ignoreSystemMessages: true } },
			globalData, 'trigger',
		));

		expect(result).not.toBeNull();
		const messages = result![0].map((item) => item.json.message);
		expect(messages).toContain('all mode test message');
	});

	it('ignoreSystemMessages filters out system messages', async () => {
		const freshToken = await createConversation('Trigger System Message Test');
		try {
			// First run: establish cursor
			const globalData: Record<string, unknown> = {};
			const firstCtx = createRealPollContext(
				{ conversationMode: 'specific', tokens: { token: [{ value: freshToken }] }, options: { ignoreSystemMessages: true } },
				globalData,
				'trigger',
			);
			await node.poll.call(firstCtx);

			// Send a user message
			await sendMessage(freshToken, 'normal message');

			// Poll with filtering ON — should see only non-system messages
			const filteredCtx = createRealPollContext(
				{ conversationMode: 'specific', tokens: { token: [{ value: freshToken }] }, options: { ignoreSystemMessages: true } },
				globalData,
				'trigger',
			);
			const result = await node.poll.call(filteredCtx);

			expect(result).not.toBeNull();
			const types = result![0].map((item) => item.json.messageType);
			expect(types).not.toContain('system');
		} finally {
			await deleteConversation(freshToken);
		}
	});
});
