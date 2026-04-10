import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextcloudTalkTrigger } from '../../nodes/NextcloudTalk/NextcloudTalkTrigger.node';
import { createRealPollContext } from './helpers/realContext';
import { createConversation, deleteConversation, sendMessage } from './helpers/nextcloudClient';

describe('NextcloudTalkTrigger (poll-based)', () => {
	let token: string;
	const node = new NextcloudTalkTrigger();

	beforeAll(async () => {
		token = await createConversation('Integration Test Trigger');
	});

	afterAll(async () => {
		if (token) await deleteConversation(token);
	});

	it('first run stores the cursor and returns null (no items emitted)', async () => {
		const staticData: Record<string, unknown> = {};
		const ctx = createRealPollContext(
			{ token, options: { ignoreSystemMessages: true } },
			staticData,
		);

		const result = await node.poll.call(ctx);

		expect(result).toBeNull();
		// The cursor must have been stored
		expect(typeof staticData.lastKnownMessageId).toBe('number');
	});

	it('second run after a new message returns that message', async () => {
		// First run: establish cursor
		const staticData: Record<string, unknown> = {};
		const firstCtx = createRealPollContext(
			{ token, options: { ignoreSystemMessages: true } },
			staticData,
		);
		await node.poll.call(firstCtx);

		const cursorAfterFirstRun = staticData.lastKnownMessageId as number;

		// Send a message so the next poll has something to return
		await sendMessage(token, 'trigger integration test message');

		// Second run: should detect the new message immediately (lookIntoFuture: 1 returns
		// immediately when messages newer than the cursor already exist)
		const secondCtx = createRealPollContext(
			{ token, options: { ignoreSystemMessages: true } },
			staticData,
		);
		const result = await node.poll.call(secondCtx);

		expect(result).not.toBeNull();
		expect(result![0].length).toBeGreaterThan(0);

		const messages = result![0].map((item) => item.json.message);
		expect(messages).toContain('trigger integration test message');

		// Cursor should have advanced
		expect(staticData.lastKnownMessageId as number).toBeGreaterThan(cursorAfterFirstRun);
	});

	it('ignoreSystemMessages filters out system messages', async () => {
		// Fresh conversation ensures the only messages are the ones we control
		const freshToken = await createConversation('Trigger System Message Test');
		try {
			// First run on a fresh conversation sets cursor
			const staticData: Record<string, unknown> = {};
			const firstCtx = createRealPollContext(
				{ token: freshToken, options: { ignoreSystemMessages: true } },
				staticData,
			);
			await node.poll.call(firstCtx);

			// Send a user message
			await sendMessage(freshToken, 'normal message');

			// Poll with filtering ON — should see the normal message
			const filteredCtx = createRealPollContext(
				{ token: freshToken, options: { ignoreSystemMessages: true } },
				{ ...staticData },
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
