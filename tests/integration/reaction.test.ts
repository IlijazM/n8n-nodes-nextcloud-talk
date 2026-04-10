import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextcloudTalk } from '../../nodes/NextcloudTalk/NextcloudTalk.node';
import { createRealExecutionContext } from './helpers/realContext';
import { createConversation, deleteConversation, sendMessage } from './helpers/nextcloudClient';

describe('Reaction resource', () => {
	let token: string;
	let messageId: number;
	const node = new NextcloudTalk();

	beforeAll(async () => {
		token = await createConversation('Integration Test Reactions');
		messageId = await sendMessage(token, 'message for reactions');
	});

	afterAll(async () => {
		if (token) await deleteConversation(token);
	});

	it('add adds a reaction and returns the updated reaction list', async () => {
		const ctx = createRealExecutionContext({
			resource: 'reaction',
			operation: 'add',
			token,
			messageId,
			reaction: '👍',
		});
		const result = await node.execute.call(ctx);

		// Nextcloud returns the reactions for the message; 👍 should now be present
		expect(result[0].length).toBeGreaterThan(0);
	});

	it('get returns the reactions for the message', async () => {
		const ctx = createRealExecutionContext({
			resource: 'reaction',
			operation: 'get',
			token,
			messageId,
			reaction: '',
		});
		const result = await node.execute.call(ctx);

		expect(result[0].length).toBeGreaterThan(0);
		const actors = result[0].map((item) => item.json.actorId);
		expect(actors).toContain('admin');
	});

	it('get with emoji filter returns only that emoji\'s reactions', async () => {
		const ctx = createRealExecutionContext({
			resource: 'reaction',
			operation: 'get',
			token,
			messageId,
			reaction: '👍',
		});
		const result = await node.execute.call(ctx);
		expect(result[0].length).toBeGreaterThan(0);
	});

	it('remove removes the reaction', async () => {
		const ctx = createRealExecutionContext({
			resource: 'reaction',
			operation: 'remove',
			token,
			messageId,
			reaction: '👍',
		});
		const result = await node.execute.call(ctx);
		expect(result[0]).toHaveLength(1);
	});
});
