import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextcloudTalk } from '../../nodes/NextcloudTalk/NextcloudTalk.node';
import { createRealExecutionContext } from './helpers/realContext';
import { createConversation, deleteConversation } from './helpers/nextcloudClient';

describe('Participant resource', () => {
	let token: string;
	const node = new NextcloudTalk();

	beforeAll(async () => {
		token = await createConversation('Integration Test Participants');
	});

	afterAll(async () => {
		if (token) await deleteConversation(token);
	});

	it('getMany returns a list of participants', async () => {
		const ctx = createRealExecutionContext({
			resource: 'participant',
			operation: 'getMany',
			token,
		});
		const result = await node.execute.call(ctx);

		expect(result[0].length).toBeGreaterThan(0);
		// The admin who created the conversation should be present
		const actors = result[0].map((item) => item.json.actorId);
		expect(actors).toContain('admin');
	});

	it('add adds testuser and remove removes them', async () => {
		// Add testuser to the conversation
		const addCtx = createRealExecutionContext({
			resource: 'participant',
			operation: 'add',
			token,
			newParticipant: 'testuser',
			source: 'users',
		});
		await expect(node.execute.call(addCtx)).resolves.toBeDefined();

		// Retrieve the attendeeId for testuser
		const listCtx = createRealExecutionContext({
			resource: 'participant',
			operation: 'getMany',
			token,
		});
		const listResult = await node.execute.call(listCtx);
		const testUserItem = listResult[0].find((item) => item.json.actorId === 'testuser');
		expect(testUserItem).toBeDefined();
		const attendeeId = testUserItem!.json.attendeeId as number;

		// Remove testuser
		const removeCtx = createRealExecutionContext({
			resource: 'participant',
			operation: 'remove',
			token,
			attendeeId,
		});
		const removeResult = await node.execute.call(removeCtx);
		expect(removeResult[0]).toHaveLength(1);
	});

	it('promote and demote cycle a participant through moderator role', async () => {
		// Add testuser first
		const addCtx = createRealExecutionContext({
			resource: 'participant',
			operation: 'add',
			token,
			newParticipant: 'testuser',
			source: 'users',
		});
		await node.execute.call(addCtx);

		// Get attendeeId for testuser
		const listCtx = createRealExecutionContext({
			resource: 'participant',
			operation: 'getMany',
			token,
		});
		const listResult = await node.execute.call(listCtx);
		const testUserItem = listResult[0].find((item) => item.json.actorId === 'testuser');
		const attendeeId = testUserItem!.json.attendeeId as number;

		// Promote to moderator
		const promoteCtx = createRealExecutionContext({
			resource: 'participant',
			operation: 'promote',
			token,
			attendeeId,
		});
		await expect(node.execute.call(promoteCtx)).resolves.toBeDefined();

		// Demote back to participant
		const demoteCtx = createRealExecutionContext({
			resource: 'participant',
			operation: 'demote',
			token,
			attendeeId,
		});
		await expect(node.execute.call(demoteCtx)).resolves.toBeDefined();

		// Clean up: remove testuser
		const removeCtx = createRealExecutionContext({
			resource: 'participant',
			operation: 'remove',
			token,
			attendeeId,
		});
		await node.execute.call(removeCtx);
	});
});
