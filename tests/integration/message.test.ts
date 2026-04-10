import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextcloudTalk } from '../../nodes/NextcloudTalk/NextcloudTalk.node';
import { createRealExecutionContext } from './helpers/realContext';
import { createConversation, deleteConversation } from './helpers/nextcloudClient';

describe('Message resource', () => {
	let token: string;
	const node = new NextcloudTalk();

	beforeAll(async () => {
		token = await createConversation('Integration Test Messages');
	});

	afterAll(async () => {
		if (token) await deleteConversation(token);
	});

	it('send creates a message and returns it', async () => {
		const ctx = createRealExecutionContext({
			resource: 'message',
			operation: 'send',
			token,
			message: 'hello from integration test',
			replyTo: 0,
			sender: 'user',
		});
		const result = await node.execute.call(ctx);

		expect(result[0]).toHaveLength(1);
		expect(result[0][0].json).toMatchObject({
			message: 'hello from integration test',
			actorType: 'users',
		});
	});

	it('getMany returns messages including the sent one', async () => {
		const ctx = createRealExecutionContext({
			resource: 'message',
			operation: 'getMany',
			token,
			returnAll: true,
			additionalOptions: {},
		});
		const result = await node.execute.call(ctx);

		expect(result[0].length).toBeGreaterThan(0);
		const messages = result[0].map((item) => item.json.message);
		expect(messages).toContain('hello from integration test');
	});

	it('send with replyTo sends a reply and references the parent message', async () => {
		// First send a message to reply to
		const sendCtx = createRealExecutionContext({
			resource: 'message',
			operation: 'send',
			token,
			message: 'parent message',
			replyTo: 0,
			sender: 'user',
		});
		const sendResult = await node.execute.call(sendCtx);
		const parentId = sendResult[0][0].json.id as number;

		// Now reply to it
		const replyCtx = createRealExecutionContext({
			resource: 'message',
			operation: 'send',
			token,
			message: 'this is a reply',
			replyTo: parentId,
			sender: 'user',
		});
		const replyResult = await node.execute.call(replyCtx);

		expect(replyResult[0]).toHaveLength(1);
		expect(replyResult[0][0].json.message).toBe('this is a reply');
		expect(replyResult[0][0].json).toHaveProperty('parent');
	});

	it('edit updates a message and getMany reflects the new content', async () => {
		const sendCtx = createRealExecutionContext({
			resource: 'message',
			operation: 'send',
			token,
			message: 'original content',
			replyTo: 0,
			sender: 'user',
		});
		const sendResult = await node.execute.call(sendCtx);
		const messageId = sendResult[0][0].json.id as number;

		const editCtx = createRealExecutionContext({
			resource: 'message',
			operation: 'edit',
			token,
			messageId,
			message: 'edited content',
		});
		// The edit endpoint returns a system notification message ("You edited a message"),
		// not the edited message itself. Just verify the call succeeded.
		const editResult = await node.execute.call(editCtx);
		expect(editResult[0]).toHaveLength(1);

		// Verify the actual content changed by fetching the conversation history
		const getCtx = createRealExecutionContext({
			resource: 'message',
			operation: 'getMany',
			token,
			returnAll: true,
			additionalOptions: {},
		});
		const getResult = await node.execute.call(getCtx);
		const editedMessage = getResult[0].find(
			(item) => (item.json.id as number) === messageId,
		);
		expect(editedMessage).toBeDefined();
		expect(editedMessage!.json.message).toBe('edited content');
	});

	it('react adds a reaction without error', async () => {
		const sendCtx = createRealExecutionContext({
			resource: 'message',
			operation: 'send',
			token,
			message: 'message to react to',
			replyTo: 0,
			sender: 'user',
		});
		const sendResult = await node.execute.call(sendCtx);
		const messageId = sendResult[0][0].json.id as number;

		const reactCtx = createRealExecutionContext({
			resource: 'message',
			operation: 'react',
			token,
			messageId,
			reaction: '👍',
		});
		const reactResult = await node.execute.call(reactCtx);
		expect(reactResult[0].length).toBeGreaterThan(0);
	});

	it('delete removes a message', async () => {
		const sendCtx = createRealExecutionContext({
			resource: 'message',
			operation: 'send',
			token,
			message: 'message to be deleted',
			replyTo: 0,
			sender: 'user',
		});
		const sendResult = await node.execute.call(sendCtx);
		const messageId = sendResult[0][0].json.id as number;

		const deleteCtx = createRealExecutionContext({
			resource: 'message',
			operation: 'delete',
			token,
			messageId,
		});
		const deleteResult = await node.execute.call(deleteCtx);
		expect(deleteResult[0]).toHaveLength(1);
	});

	it('getMany with limit returns at most limit messages', async () => {
		// Ensure there are enough messages by sending a few
		for (let n = 0; n < 3; n++) {
			await node.execute.call(createRealExecutionContext({
				resource: 'message', operation: 'send', token,
				message: `limit test ${n}`, replyTo: 0, sender: 'user',
			}));
		}

		const ctx = createRealExecutionContext({
			resource: 'message',
			operation: 'getMany',
			token,
			returnAll: false,
			limit: 2,
			additionalOptions: {},
		});
		const result = await node.execute.call(ctx);

		expect(result[0].length).toBeLessThanOrEqual(2);
	});

	it('getMany with lastKnownMessageId returns only messages older than that ID', async () => {
		// Send 3 messages and collect their IDs
		const ids: number[] = [];
		for (let n = 0; n < 3; n++) {
			const r = await node.execute.call(createRealExecutionContext({
				resource: 'message', operation: 'send', token,
				message: `pagination test ${n}`, replyTo: 0, sender: 'user',
			}));
			ids.push(r[0][0].json.id as number);
		}

		// lastKnownMessageId = third message's ID → should return messages older than it
		const ctx = createRealExecutionContext({
			resource: 'message',
			operation: 'getMany',
			token,
			returnAll: true,
			additionalOptions: { lastKnownMessageId: ids[2] },
		});
		const result = await node.execute.call(ctx);
		const resultIds = result[0].map((item) => item.json.id as number);

		expect(resultIds).not.toContain(ids[2]);
		expect(resultIds).toContain(ids[0]);
	});

	it('markRead marks messages as read without error', async () => {
		const ctx = createRealExecutionContext({
			resource: 'message',
			operation: 'markRead',
			token,
			lastReadMessage: 0,
		});
		await expect(node.execute.call(ctx)).resolves.toBeDefined();
	});
});
