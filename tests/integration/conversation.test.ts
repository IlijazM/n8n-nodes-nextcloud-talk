import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextcloudTalk } from '../../nodes/NextcloudTalk/NextcloudTalk.node';
import { createRealExecutionContext } from './helpers/realContext';
import { createConversation, deleteConversation } from './helpers/nextcloudClient';

describe('Conversation resource', () => {
	let testToken: string;
	const node = new NextcloudTalk();

	beforeAll(async () => {
		testToken = await createConversation('Integration Test Conversations');
	});

	afterAll(async () => {
		if (testToken) await deleteConversation(testToken);
	});

	it('getMany returns an array of conversations including the test one', async () => {
		const ctx = createRealExecutionContext({ resource: 'conversation', operation: 'getMany' });
		const result = await node.execute.call(ctx);

		expect(result[0].length).toBeGreaterThan(0);
		const tokens = result[0].map((item) => item.json.token);
		expect(tokens).toContain(testToken);
	});

	it('get returns the conversation matching the given token', async () => {
		const ctx = createRealExecutionContext({
			resource: 'conversation',
			operation: 'get',
			token: testToken,
		});
		const result = await node.execute.call(ctx);

		expect(result[0]).toHaveLength(1);
		expect(result[0][0].json.token).toBe(testToken);
	});

	it('create creates a new public conversation and returns it', async () => {
		const ctx = createRealExecutionContext({
			resource: 'conversation',
			operation: 'create',
			roomType: 3,
			roomName: 'Temp Integration Test Room',
		});
		const result = await node.execute.call(ctx);

		expect(result[0]).toHaveLength(1);
		const newToken = result[0][0].json.token as string;
		expect(typeof newToken).toBe('string');
		expect(newToken.length).toBeGreaterThan(0);

		// Clean up
		await deleteConversation(newToken);
	});

	it('rename renames a conversation', async () => {
		// Create a dedicated room so we don't rename the shared test room
		const roomToken = await createConversation('To Be Renamed');
		try {
			const ctx = createRealExecutionContext({
				resource: 'conversation',
				operation: 'rename',
				token: roomToken,
				roomName: 'Renamed Successfully',
			});
			const result = await node.execute.call(ctx);

			// Rename returns an empty-ish OCS response; verify no error
			expect(result[0]).toHaveLength(1);
		} finally {
			await deleteConversation(roomToken);
		}
	});

	it('setDescription sets the conversation description', async () => {
		const ctx = createRealExecutionContext({
			resource: 'conversation',
			operation: 'setDescription',
			token: testToken,
			description: 'Set by integration test',
		});
		const result = await node.execute.call(ctx);
		expect(result[0]).toHaveLength(1);
	});

	it('setGuestAccess allows and then disallows guests', async () => {
		const allow = createRealExecutionContext({
			resource: 'conversation',
			operation: 'setGuestAccess',
			token: testToken,
			allowGuests: true,
		});
		await expect(node.execute.call(allow)).resolves.toBeDefined();

		const disallow = createRealExecutionContext({
			resource: 'conversation',
			operation: 'setGuestAccess',
			token: testToken,
			allowGuests: false,
		});
		await expect(node.execute.call(disallow)).resolves.toBeDefined();
	});

	it('setFavorite adds and removes from favorites', async () => {
		const add = createRealExecutionContext({
			resource: 'conversation',
			operation: 'setFavorite',
			token: testToken,
			favorite: true,
		});
		await expect(node.execute.call(add)).resolves.toBeDefined();

		const remove = createRealExecutionContext({
			resource: 'conversation',
			operation: 'setFavorite',
			token: testToken,
			favorite: false,
		});
		await expect(node.execute.call(remove)).resolves.toBeDefined();
	});

	it('setNotificationLevel sets the notification level', async () => {
		const ctx = createRealExecutionContext({
			resource: 'conversation',
			operation: 'setNotificationLevel',
			token: testToken,
			notificationLevel: 1,
		});
		await expect(node.execute.call(ctx)).resolves.toBeDefined();
	});

	it('setReadOnly sets and unsets the read-only flag', async () => {
		const setRO = createRealExecutionContext({
			resource: 'conversation',
			operation: 'setReadOnly',
			token: testToken,
			readOnly: true,
		});
		await expect(node.execute.call(setRO)).resolves.toBeDefined();

		const unsetRO = createRealExecutionContext({
			resource: 'conversation',
			operation: 'setReadOnly',
			token: testToken,
			readOnly: false,
		});
		await expect(node.execute.call(unsetRO)).resolves.toBeDefined();
	});

	it('delete removes a conversation', async () => {
		const roomToken = await createConversation('To Be Deleted');
		const ctx = createRealExecutionContext({
			resource: 'conversation',
			operation: 'delete',
			token: roomToken,
		});
		const result = await node.execute.call(ctx);
		expect(result[0]).toHaveLength(1);
	});
});
