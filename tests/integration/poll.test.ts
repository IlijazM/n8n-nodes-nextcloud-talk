import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextcloudTalk } from '../../nodes/NextcloudTalk/NextcloudTalk.node';
import { createRealExecutionContext } from './helpers/realContext';
import { createConversation, deleteConversation } from './helpers/nextcloudClient';

describe('Poll resource', () => {
	let token: string;
	const node = new NextcloudTalk();

	beforeAll(async () => {
		token = await createConversation('Integration Test Polls');
	});

	afterAll(async () => {
		if (token) await deleteConversation(token);
	});

	it('create creates a poll and returns it with the given question and options', async () => {
		const ctx = createRealExecutionContext({
			resource: 'poll',
			operation: 'create',
			token,
			question: 'What is your favourite colour?',
			pollOptions: { option: [{ text: 'Red' }, { text: 'Blue' }, { text: 'Green' }] },
			resultMode: 0,
			maxVotes: 1,
		});
		const result = await node.execute.call(ctx);

		expect(result[0]).toHaveLength(1);
		const poll = result[0][0].json;
		expect(poll.question).toBe('What is your favourite colour?');
		expect(Array.isArray(poll.options)).toBe(true);
		expect((poll.options as string[]).length).toBe(3);
		expect(poll.status).toBe(0); // 0 = open
	});

	it('get returns the current poll state', async () => {
		// Create a poll to fetch
		const createCtx = createRealExecutionContext({
			resource: 'poll',
			operation: 'create',
			token,
			question: 'Get test poll?',
			pollOptions: { option: [{ text: 'Yes' }, { text: 'No' }] },
			resultMode: 0,
			maxVotes: 1,
		});
		const createResult = await node.execute.call(createCtx);
		const pollId = createResult[0][0].json.id as number;

		const getCtx = createRealExecutionContext({
			resource: 'poll',
			operation: 'get',
			token,
			pollId,
		});
		const getResult = await node.execute.call(getCtx);

		expect(getResult[0]).toHaveLength(1);
		expect(getResult[0][0].json.id).toBe(pollId);
	});

	it('vote registers a vote and the result reflects it', async () => {
		const createCtx = createRealExecutionContext({
			resource: 'poll',
			operation: 'create',
			token,
			question: 'Vote test poll?',
			pollOptions: { option: [{ text: 'Option A' }, { text: 'Option B' }] },
			resultMode: 0,
			maxVotes: 1,
		});
		const createResult = await node.execute.call(createCtx);
		const pollId = createResult[0][0].json.id as number;

		const voteCtx = createRealExecutionContext({
			resource: 'poll',
			operation: 'vote',
			token,
			pollId,
			optionIds: { id: [{ value: 0 }] },
		});
		const voteResult = await node.execute.call(voteCtx);

		expect(voteResult[0]).toHaveLength(1);
		// After voting, the poll response includes the voted options
		expect(voteResult[0][0].json).toHaveProperty('votedSelf');
	});

	it('close closes a poll and the status changes to closed', async () => {
		const createCtx = createRealExecutionContext({
			resource: 'poll',
			operation: 'create',
			token,
			question: 'Close test poll?',
			pollOptions: { option: [{ text: 'Yes' }, { text: 'No' }] },
			resultMode: 1, // hidden until closed
			maxVotes: 1,
		});
		const createResult = await node.execute.call(createCtx);
		const pollId = createResult[0][0].json.id as number;

		const closeCtx = createRealExecutionContext({
			resource: 'poll',
			operation: 'close',
			token,
			pollId,
		});
		const closeResult = await node.execute.call(closeCtx);

		expect(closeResult[0]).toHaveLength(1);
		expect(closeResult[0][0].json.status).toBe(1); // 1 = closed
	});
});
