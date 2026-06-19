import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { IExecuteFunctions, IWebhookFunctions, IDataObject } from 'n8n-workflow';
import { NextcloudTalk } from '../../nodes/NextcloudTalk/NextcloudTalk.node';
import { NextcloudTalkAsk } from '../../nodes/NextcloudTalk/NextcloudTalkAsk.node';
import { NextcloudTalkWaitForAnswer } from '../../nodes/NextcloudTalk/NextcloudTalkWaitForAnswer.node';
import { createRealExecutionContext } from './helpers/realContext';
import { createConversation, deleteConversation } from './helpers/nextcloudClient';

const RESUME_URL = 'https://n8n.example/webhook-waiting/exec-123';

// The Ask node evaluates {{ $execution.resumeUrl }}; the real context mock doesn't
// implement evaluateExpression, so inject a fixed value.
function askContext(params: Record<string, unknown>): IExecuteFunctions {
	const ctx = createRealExecutionContext(params) as unknown as Record<string, unknown>;
	ctx.evaluateExpression = () => RESUME_URL;
	return ctx as unknown as IExecuteFunctions;
}

// Minimal context for driving WaitForAnswer.webhook() in isolation (no real wait).
function webhookContext(params: Record<string, unknown>, body: IDataObject): IWebhookFunctions {
	return {
		getNodeParameter: (name: string) => params[name],
		getBodyData: () => body,
	} as unknown as IWebhookFunctions;
}

describe('Nextcloud Talk Ask', () => {
	let token: string;
	const ask = new NextcloudTalkAsk();
	const talk = new NextcloudTalk();

	beforeAll(async () => {
		token = await createConversation('Integration Test Ask');
	});

	afterAll(async () => {
		if (token) await deleteConversation(token);
	});

	it('approval sends a message, self-reacts 👍/👎 and emits the resume metadata', async () => {
		const ctx = askContext({
			operation: 'approval',
			token,
			message: 'Should I delete the event "Lunch"?',
			approveReaction: '👍',
			rejectReaction: '👎',
			additionalOptions: {},
		});
		const result = await ask.execute.call(ctx);

		const out = result[0][0].json;
		expect(out.operation).toBe('approval');
		expect(out.resumeUrl).toBe(RESUME_URL);
		expect(typeof out.questionMessageId).toBe('number');

		// The bot's two reactions should now be present on the message.
		const reactCtx = createRealExecutionContext({
			resource: 'reaction',
			operation: 'get',
			token,
			messageId: out.questionMessageId,
			reaction: '',
		});
		const reactions = await talk.execute.call(reactCtx);
		const emojis = reactions[0].map((r) => r.json.reaction);
		expect(emojis).toContain('👍');
		expect(emojis).toContain('👎');
	});

	it('question sends a plain message and emits questionMessageId + resumeUrl', async () => {
		const ctx = askContext({
			operation: 'question',
			token,
			message: 'Which calendar should I use?',
			additionalOptions: {},
		});
		const result = await ask.execute.call(ctx);

		const out = result[0][0].json;
		expect(out.operation).toBe('question');
		expect(out.resumeUrl).toBe(RESUME_URL);
		expect(typeof out.questionMessageId).toBe('number');
	});

	it('poll creates a poll and emits its pollId', async () => {
		const ctx = askContext({
			operation: 'poll',
			token,
			question: 'Pick a slot',
			pollOptions: { option: [{ text: '10:00' }, { text: '11:00' }] },
			maxVotes: 1,
		});
		const result = await ask.execute.call(ctx);

		const out = result[0][0].json;
		expect(out.operation).toBe('poll');
		expect(typeof out.pollId).toBe('number');
		expect(out.resumeUrl).toBe(RESUME_URL);
	});
});

describe('Nextcloud Talk Wait For Answer (webhook routing)', () => {
	const wait = new NextcloudTalkWaitForAnswer();

	it('approval → Approved output when approved=true', async () => {
		const ctx = webhookContext({ operation: 'approval' }, { approved: true });
		const res = await wait.webhook.call(ctx);
		const data = res.workflowData!;
		expect(data).toHaveLength(3); // Approved, Rejected, Timeout
		expect(data[0]).toHaveLength(1);
		expect(data[0][0].json.approved).toBe(true);
		expect(data[1]).toHaveLength(0);
		expect(data[2]).toHaveLength(0);
	});

	it('approval → Rejected output when approved=false', async () => {
		const ctx = webhookContext({ operation: 'approval' }, { approved: false });
		const res = await wait.webhook.call(ctx);
		const data = res.workflowData!;
		expect(data[0]).toHaveLength(0);
		expect(data[1]).toHaveLength(1);
		expect(data[1][0].json.approved).toBe(false);
	});

	it('question → Answered output carries the answer', async () => {
		const ctx = webhookContext({ operation: 'question' }, { answer: 'the work calendar' });
		const res = await wait.webhook.call(ctx);
		const data = res.workflowData!;
		expect(data).toHaveLength(2); // Answered, Timeout
		expect(data[0]).toHaveLength(1);
		expect(data[0][0].json.answer).toBe('the work calendar');
		expect(data[0][0].json.answered).toBe(true);
	});
});
