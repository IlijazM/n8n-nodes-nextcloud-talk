import crypto from 'crypto';
import {
	NodeConnectionTypes,
	type IDataObject,
	type INodeType,
	type INodeTypeDescription,
	type IPollFunctions,
	type IWebhookFunctions,
	type IWebhookResponseData,
} from 'n8n-workflow';

import { NEXTCLOUD_TALK_CURSORS_KEY } from './types';

// ── helpers ───────────────────────────────────────────────────────────────────

function getSpecificTokens(context: IWebhookFunctions | IPollFunctions): string[] {
	const col = context.getNodeParameter('tokens') as { token?: Array<{ value: string }> };
	return (col.token ?? []).map((t) => t.value).filter(Boolean);
}

// ── node ──────────────────────────────────────────────────────────────────────

export class NextcloudTalkWebhookTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nextcloud Talk Webhook Trigger',
		name: 'nextcloudTalkWebhookTrigger',
		icon: { light: 'file:../../icons/nextcloud.svg', dark: 'file:../../icons/nextcloud.dark.svg' },
		group: ['trigger'],
		version: 1,
		description:
			'Triggers instantly when a new message is received in a Nextcloud Talk conversation via webhook',
		subtitle:
			'={{$parameter["conversationMode"] === "all" ? "All conversations" : "Specific conversation(s)"}}',
		defaults: { name: 'Nextcloud Talk Webhook Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'nextcloudApi', required: true }],
		usableAsTool: true,
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: '={{$parameter["webhookPath"]}}',
				isFullPath: true,
			},
		],
		properties: [
			{
				displayName: 'Webhook Path',
				name: 'webhookPath',
				type: 'string',
				default: 'nextcloud-talk',
				required: true,
				description: 'Fixed path for the webhook URL: <code>&lt;n8n-URL&gt;/webhook/&lt;path&gt;</code>. Set this once and never change it — this is the URL you register with <code>occ talk:bot:install</code>. Unlike the default n8n webhook URL, this does not contain the workflow UUID so it survives workflow re-creation.',
			},
			{
				displayName:
					'Register the bot once with: <code>occ talk:bot:install --feature webhook --feature response "n8n" "&lt;YOUR_SECRET&gt;" "&lt;YOUR_N8N_URL&gt;/webhook/&lt;WEBHOOK_PATH&gt;"</code>. The secret must be at least 40 characters. Then enable the bot per-conversation using the Nextcloud Talk action node (Bot → Enable for Conversation). Use <code>--feature webhook</code> so Nextcloud sends events to n8n, and <code>--feature response</code> if you also want to send messages back as the bot.',
				name: 'setupNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Trigger For',
				name: 'conversationMode',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'All Conversations',
						value: 'all',
						description:
							'Trigger for messages in any conversation the bot is enabled in. Enable the bot per-conversation using the Nextcloud Talk action node (Bot → Enable for Conversation).',
					},
					{
						name: 'Specific Conversation(s)',
						value: 'specific',
						description: 'Trigger only for messages in the configured conversations',
					},
				],
				default: 'all',
			},
			{
				displayName: 'Conversations',
				name: 'tokens',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				displayOptions: { show: { conversationMode: ['specific'] } },
				default: {},
				placeholder: 'Add Conversation',
				options: [
					{
						name: 'token',
						displayName: 'Conversation',
						values: [
							{
								displayName: 'Conversation Token',
								name: 'value',
								type: 'string',
								typeOptions: { password: true },
								required: true,
								default: '',
								description:
									'The token (ID) of the conversation. You can find it in the URL when opening the conversation in Nextcloud Talk.',
							},
						],
					},
				],
			},
			{
				displayName: 'Bot Secret',
				name: 'botSecret',
				type: 'string',
				typeOptions: { password: true },
				required: true,
				default: '',
				description:
					'The secret set when the bot was registered via <code>occ talk:bot:install</code> (min. 40 characters). Used to verify incoming webhook signatures.',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Ignore System Messages',
						name: 'ignoreSystemMessages',
						type: 'boolean',
						default: true,
						description: 'Whether to ignore system messages (e.g. user joined, call started)',
					},
				],
			},
		],
	};

	// ── incoming webhook ──────────────────────────────────────────────────────

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const botSecret = this.getNodeParameter('botSecret') as string;
		const headers = this.getHeaderData();
		const random = headers['x-nextcloud-talk-random'] as string | undefined;
		const signature = headers['x-nextcloud-talk-signature'] as string | undefined;

		if (!random || !signature) {
			this.getResponseObject().status(401).json({ message: 'Missing signature headers' });
			return { noWebhookResponse: true };
		}

		const req = this.getRequestObject();
		const rawBody =
			(req as unknown as { rawBody?: Buffer }).rawBody?.toString('utf8') ??
			JSON.stringify(this.getBodyData());

		const expected = crypto
			.createHmac('sha256', botSecret)
			.update(random + rawBody)
			.digest('hex');

		if (
			signature.length !== expected.length ||
			!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
		) {
			this.getResponseObject().status(403).json({ message: 'Invalid signature' });
			return { noWebhookResponse: true };
		}

		const bodyData = this.getBodyData() as IDataObject;
		const conversationMode = this.getNodeParameter('conversationMode') as string;

		if (conversationMode === 'specific') {
			const allowed = getSpecificTokens(this);
			const incomingToken = (bodyData.target as IDataObject | undefined)?.id as string | undefined;
			if (!allowed.includes(incomingToken ?? '')) {
				return { workflowData: [[]] };
			}
		}

		const options = this.getNodeParameter('options') as {
			ignoreSystemMessages?: boolean;
		};

		if (options.ignoreSystemMessages !== false) {
			const objectType = (bodyData.object as IDataObject | undefined)?.type as string | undefined;
			if (objectType === 'system') {
				return { workflowData: [[]] };
			}
		}

		// The ActivityPub actor.id is "type/identifier" (e.g. "users/ilijaz", "bots/mybot").
		// Extract the Nextcloud-internal actor type from the prefix so it matches the poll trigger output.
		const actorIdRaw = (bodyData.actor as IDataObject | undefined)?.id as string | undefined;
		const slashIdx = actorIdRaw?.indexOf('/') ?? -1;
		const actorType = slashIdx >= 0 ? actorIdRaw!.slice(0, slashIdx) : undefined;
		const actorId = slashIdx >= 0 ? actorIdRaw!.slice(slashIdx + 1) : actorIdRaw;
		const actorDisplayName = (bodyData.actor as IDataObject | undefined)?.name as string | undefined;

		// Parse message text and parameters from the ActivityPub object.content JSON string.
		// Content format: {"message":"...", "parameters": {"mention-user1": {...}} }
		// Parameters may be an empty array [] when there are none, or an object when there are.
		const objectData = bodyData.object as IDataObject | undefined;
		const msgIdRaw = objectData?.id;
		const msgId = typeof msgIdRaw === 'number' ? msgIdRaw : Number(msgIdRaw);
		const token = (bodyData.target as IDataObject | undefined)?.id as string | undefined;
		let message = '';
		let messageParameters: IDataObject = {};
		try {
			const parsed = JSON.parse(objectData?.content as string) as {
				message?: string;
				parameters?: IDataObject | unknown[];
			};
			message = parsed.message ?? '';
			// Nextcloud sends [] when there are no parameters, object when there are
			if (parsed.parameters && !Array.isArray(parsed.parameters)) {
				messageParameters = parsed.parameters;
			}
		} catch {
			message = objectData?.name as string ?? '';
		}

		// Advance the shared cursor so the poll node skips this message.
		if (token && !Number.isNaN(msgId)) {
			const globalData = this.getWorkflowStaticData('global');
			const cursors = (globalData[NEXTCLOUD_TALK_CURSORS_KEY] ?? {}) as Record<string, number>;
			if (msgId > (cursors[token] ?? -1)) {
				cursors[token] = msgId;
				globalData[NEXTCLOUD_TALK_CURSORS_KEY] = cursors;
			}
		}

		// Normalize to a flat shape matching the poll trigger output so both triggers are
		// interchangeable in a workflow (same field names for token, message, id, actorType, etc.).
		const isNote = objectData?.type === 'Note';
		const normalized: IDataObject = {
			id: msgId,
			token,
			actorType,
			actorId,
			actorDisplayName,
			timestamp: Math.floor(Date.now() / 1000),
			message,
			messageParameters,
			systemMessage: isNote ? '' : (objectData?.name as string ?? ''),
			messageType: isNote ? 'comment' : 'system',
			isReplyable: isNote,
			reactions: {},
			expirationTimestamp: 0,
			markdown: true,
			threadId: msgId,
			_source: 'webhook',
		};

		return { workflowData: [this.helpers.returnJsonArray([normalized])] };
	}
}
