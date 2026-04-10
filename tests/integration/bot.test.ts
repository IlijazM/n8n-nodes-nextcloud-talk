import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextcloudTalk } from '../../nodes/NextcloudTalk/NextcloudTalk.node';
import { createRealExecutionContext } from './helpers/realContext';
import { createConversation, deleteConversation } from './helpers/nextcloudClient';

// configure-nextcloud.sh installs a single test bot during global setup,
// so its ID is deterministic on a fresh container.
const TEST_BOT_ID = 1;

describe('Bot resource', () => {
	let token: string;
	const node = new NextcloudTalk();

	beforeAll(async () => {
		token = await createConversation('Integration Test Bots');
	});

	afterAll(async () => {
		if (token) await deleteConversation(token);
	});

	it('enable installs the bot in the conversation', async () => {
		const ctx = createRealExecutionContext({
			resource: 'bot',
			operation: 'enable',
			token,
			botId: TEST_BOT_ID,
		});
		const result = await node.execute.call(ctx);

		expect(result[0]).toHaveLength(1);
		expect(result[0][0].json).toMatchObject({
			enabled: true,
			token,
			botId: TEST_BOT_ID,
		});
	});

	it('list returns the enabled bot in the conversation', async () => {
		const ctx = createRealExecutionContext({
			resource: 'bot',
			operation: 'list',
			token,
		});
		const result = await node.execute.call(ctx);

		expect(result[0].length).toBeGreaterThan(0);
		const ids = result[0].map((item) => item.json.id);
		expect(ids).toContain(TEST_BOT_ID);

		// state === 1 means the bot is enabled for this conversation
		const entry = result[0].find((item) => item.json.id === TEST_BOT_ID)!;
		expect(entry.json.state).toBe(1);
	});

	it('enable is idempotent — repeating the call does not error', async () => {
		const ctx = createRealExecutionContext({
			resource: 'bot',
			operation: 'enable',
			token,
			botId: TEST_BOT_ID,
		});
		const result = await node.execute.call(ctx);

		expect(result[0]).toHaveLength(1);
		expect(result[0][0].json).toMatchObject({
			enabled: true,
			token,
			botId: TEST_BOT_ID,
		});
	});

	it('disable removes the bot from the conversation', async () => {
		const ctx = createRealExecutionContext({
			resource: 'bot',
			operation: 'disable',
			token,
			botId: TEST_BOT_ID,
		});
		const result = await node.execute.call(ctx);

		expect(result[0]).toHaveLength(1);
		expect(result[0][0].json).toMatchObject({
			enabled: false,
			token,
			botId: TEST_BOT_ID,
		});

		// After disable, the bot should be reported as disabled (state 0) or absent.
		const listCtx = createRealExecutionContext({
			resource: 'bot',
			operation: 'list',
			token,
		});
		const listResult = await node.execute.call(listCtx);
		const entry = listResult[0].find((item) => item.json.id === TEST_BOT_ID);
		if (entry) {
			expect(entry.json.state).toBe(0);
		}
	});

	it('list on a freshly created conversation shows bots with state 0', async () => {
		const freshToken = await createConversation('Bot Empty-List Test');
		try {
			const ctx = createRealExecutionContext({
				resource: 'bot',
				operation: 'list',
				token: freshToken,
			});
			const result = await node.execute.call(ctx);

			// The server lists installed bots with their per-conversation state.
			// On a fresh conversation our test bot is installed globally but not
			// enabled, so it should appear (if at all) with state 0.
			const entry = result[0].find((item) => item.json.id === TEST_BOT_ID);
			if (entry) {
				expect(entry.json.state).toBe(0);
			}
		} finally {
			await deleteConversation(freshToken);
		}
	});
});
