import {
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';

import { nextcloudApiRequest, extractOcsData, CHAT_API_PATH } from './helpers';

/**
 * Nextcloud Talk — Ask
 *
 * First half of an explicit human-in-the-loop gate. It posts a prompt to a Talk
 * conversation and prepares the means by which the user will answer, then emits the
 * metadata needed to (a) store a "pending interaction" row and (b) later resume the
 * paused execution. It does NOT wait itself — pair it with the "Wait For Answer" node,
 * with a step in between (e.g. a Teable insert) that persists the emitted `resumeUrl`
 * keyed by `questionMessageId` / `pollId` so the Filter workflow can look it up when the
 * user reacts/replies/votes and POST the answer back to `resumeUrl`.
 *
 * Detection note: open-poll votes emit no Talk event, but reactions and replies do — so
 * `approval` uses 👍/👎 reactions (the bot self-reacts) and `question` uses a reply, both
 * of which the Filter can detect. `poll` is offered for multi-choice but its answer must
 * be detected by re-reading the poll results, not by an event.
 */
export class NextcloudTalkAsk implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nextcloud Talk Ask',
		name: 'nextcloudTalkAsk',
		icon: { light: 'file:../../icons/nextcloud.svg', dark: 'file:../../icons/nextcloud.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description:
			'Post a human-in-the-loop prompt (approval / poll / question) to a Nextcloud Talk conversation and emit the metadata needed to resume the paused execution once the user answers',
		defaults: { name: 'Nextcloud Talk Ask' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'nextcloudApi', required: true }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Approval',
						value: 'approval',
						description: 'Send a yes/no prompt and self-react 👍/👎 for the user to tap',
						action: 'Ask for approval',
					},
					{
						name: 'Poll',
						value: 'poll',
						description: 'Create a multi-option poll',
						action: 'Ask via a poll',
					},
					{
						name: 'Question',
						value: 'question',
						description: 'Send a free-text question and wait for a reply',
						action: 'Ask a question',
					},
				],
				default: 'approval',
			},
			{
				displayName: 'Conversation Token',
				name: 'token',
				type: 'string',
				typeOptions: { password: true },
				required: true,
				default: '',
				description:
					'The token (ID) of the conversation. You can find it in the URL when opening the conversation in Nextcloud Talk.',
			},
			// ── approval / question: message text ──────────────────────
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				required: true,
				default: '',
				description: 'The prompt to send to the conversation',
				displayOptions: { show: { operation: ['approval', 'question'] } },
			},
			// ── poll ───────────────────────────────────────────────────
			{
				displayName: 'Question',
				name: 'question',
				type: 'string',
				required: true,
				default: '',
				description: 'The poll question',
				displayOptions: { show: { operation: ['poll'] } },
			},
			{
				displayName: 'Options',
				name: 'pollOptions',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				required: true,
				default: { option: [{ text: '' }] },
				description: 'The answer options for the poll',
				displayOptions: { show: { operation: ['poll'] } },
				options: [
					{
						name: 'option',
						displayName: 'Option',
						values: [
							{
								displayName: 'Text',
								name: 'text',
								type: 'string',
								default: '',
								description: 'Text of this poll option',
							},
						],
					},
				],
			},
			{
				displayName: 'Max Votes',
				name: 'maxVotes',
				type: 'number',
				default: 1,
				description: 'Maximum number of options a participant can vote for. Use 0 for unlimited.',
				displayOptions: { show: { operation: ['poll'] } },
			},
			// ── approval reaction config ───────────────────────────────
			{
				displayName: 'Approve Reaction',
				name: 'approveReaction',
				type: 'string',
				default: '👍',
				description: 'Emoji the user taps to approve. The bot adds it to the message for one-tap approval.',
				displayOptions: { show: { operation: ['approval'] } },
			},
			{
				displayName: 'Reject Reaction',
				name: 'rejectReaction',
				type: 'string',
				default: '👎',
				description: 'Emoji the user taps to reject',
				displayOptions: { show: { operation: ['approval'] } },
			},
			{
				displayName: 'Options',
				name: 'additionalOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { operation: ['approval', 'question'] } },
				options: [
					{
						displayName: 'Reply To Message ID',
						name: 'replyTo',
						type: 'number',
						default: 0,
						description: 'ID of the message to reply to. Leave at 0 for a standalone message.',
					},
					{
						displayName: 'Thread Title',
						name: 'threadTitle',
						type: 'string',
						default: '',
						description:
							'When set, the prompt starts a new thread with this title. Ignored if Reply To is set. Requires Talk v22+.',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const token = this.getNodeParameter('token', i) as string;

				// The execution-scoped resume URL. POSTing to it later resumes the paired
				// "Wait For Answer" node. It is evaluated here so the next workflow step
				// (e.g. a Teable insert) can persist it before the wait begins.
				const resumeUrl = this.evaluateExpression('{{ $execution.resumeUrl }}', i) as string;

				const base: IDataObject = { token, operation, resumeUrl, _source: 'ask' };

				if (operation === 'poll') {
					const question = this.getNodeParameter('question', i) as string;
					const maxVotes = this.getNodeParameter('maxVotes', i, 1) as number;
					const pollOptionsCollection = this.getNodeParameter('pollOptions', i) as {
						option?: Array<{ text: string }>;
					};
					const options = (pollOptionsCollection.option ?? []).map((o) => o.text);

					const response = await nextcloudApiRequest.call(this, 'POST', CHAT_API_PATH, `/poll/${token}`, {
						question,
						options,
						resultMode: 0,
						maxVotes,
					});
					const poll = extractOcsData(response) as IDataObject;

					returnData.push({
						json: { ...base, pollId: poll.id, options, poll },
						pairedItem: { item: i },
					});
					continue;
				}

				// approval | question — send a chat message first
				const message = this.getNodeParameter('message', i) as string;
				const additionalOptions = this.getNodeParameter('additionalOptions', i, {}) as {
					replyTo?: number;
					threadTitle?: string;
				};
				const replyTo = additionalOptions.replyTo ?? 0;
				const threadTitle = (additionalOptions.threadTitle ?? '').trim();

				const body: IDataObject = { message };
				if (replyTo > 0) body.replyTo = replyTo;
				if (threadTitle) body.threadTitle = threadTitle;

				const response = await nextcloudApiRequest.call(this, 'POST', CHAT_API_PATH, `/chat/${token}`, body);
				const sent = extractOcsData(response) as IDataObject;
				const questionMessageId = sent.id as number;

				if (operation === 'approval') {
					const approveReaction = this.getNodeParameter('approveReaction', i, '👍') as string;
					const rejectReaction = this.getNodeParameter('rejectReaction', i, '👎') as string;

					// Self-react so the user gets one-tap approve/reject. Reactions surface as
					// events the Filter can detect (unlike open-poll votes).
					for (const reaction of [approveReaction, rejectReaction]) {
						await nextcloudApiRequest.call(
							this,
							'POST',
							CHAT_API_PATH,
							`/reaction/${token}/${questionMessageId}`,
							{ reaction },
						);
					}

					returnData.push({
						json: { ...base, questionMessageId, approveReaction, rejectReaction, message: sent },
						pairedItem: { item: i },
					});
				} else {
					returnData.push({
						json: { ...base, questionMessageId, message: sent },
						pairedItem: { item: i },
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
