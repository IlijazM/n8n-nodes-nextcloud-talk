import crypto from 'crypto';
import {
	NodeConnectionTypes,
	type IDataObject,
	type IHookFunctions,
	type INodeType,
	type INodeTypeDescription,
	type IPollFunctions,
	type IWebhookFunctions,
	type IWebhookResponseData,
} from 'n8n-workflow';

import { nextcloudApiRequest, extractOcsData, CHAT_API_PATH, ROOM_API_PATH } from './helpers';
import type { NextcloudTalkBotEntry } from './types';
import { NEXTCLOUD_TALK_CURSORS_KEY } from './types';

// ── node-scoped static data (bot lifecycle only) ──────────────────────────────

interface WebhookNodeStaticData {
	enabledTokens: string[];
}

function initNodeData(raw: Record<string, unknown>): WebhookNodeStaticData {
	const data = raw as unknown as WebhookNodeStaticData;
	if (!data.enabledTokens) data.enabledTokens = [];
	return data;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function getSpecificTokens(context: IHookFunctions | IPollFunctions): string[] {
	const col = context.getNodeParameter('tokens') as { token?: Array<{ value: string }> };
	return (col.token ?? []).map((t) => t.value).filter(Boolean);
}

async function getAllRoomTokens(context: IHookFunctions): Promise<string[]> {
	const response = await nextcloudApiRequest.call(context, 'GET', ROOM_API_PATH, '/room', {}, {});
	const rooms = extractOcsData(response) as Array<{ token: string }>;
	return Array.isArray(rooms) ? rooms.map((r) => r.token).filter(Boolean) : [];
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
					'Register the bot once with: <code>occ talk:bot:install --feature webhook --feature response "n8n" "&lt;YOUR_SECRET&gt;" "&lt;YOUR_N8N_URL&gt;/webhook/&lt;WEBHOOK_PATH&gt;"</code>. The secret must be at least 40 characters. The Bot ID is shown in the output or via <code>occ talk:bot:list</code>. Use <code>--feature webhook</code> so Nextcloud sends events to n8n, and <code>--feature response</code> if you also want to send messages back as the bot.',
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
							'Trigger for messages in any conversation the bot is enabled in. The bot is automatically enabled for all current conversations on activation.',
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
				displayName: 'Bot ID',
				name: 'botId',
				type: 'number',
				required: true,
				default: 0,
				description:
					'The numeric ID of the bot as assigned by Nextcloud. Shown in the output of <code>occ talk:bot:install</code> or <code>occ talk:bot:list</code>.',
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
						displayName: 'Actor Types',
						name: 'actorTypes',
						type: 'multiOptions',
						options: [
							{ name: 'Bots', value: 'bots', description: 'Bots, commands, and the changelog conversation' },
							{ name: 'Bridged', value: 'bridged', description: 'Users bridged in by the Matterbridge integration' },
							{ name: 'Deleted Users', value: 'deleted_users', description: 'Former logged-in users that got deleted' },
							{ name: 'Federated Users', value: 'federated_users' },
							{ name: 'Guests', value: 'guests', description: 'Guest users (attendee type guests and emails)' },
							{ name: 'Users', value: 'users' },
						],
						default: ['users', 'guests'],
						description: 'Only trigger for messages from these actor types. Leave as default to exclude bots and avoid loops.',
					},
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

	// ── webhook lifecycle ─────────────────────────────────────────────────────

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const conversationMode = this.getNodeParameter('conversationMode') as string;
				// Always re-run create() in 'all' mode so new conversations are picked up.
				if (conversationMode === 'all') return false;

				const botId = this.getNodeParameter('botId') as number;
				const tokens = getSpecificTokens(this);

				for (const token of tokens) {
					const response = await nextcloudApiRequest.call(
						this, 'GET', CHAT_API_PATH, `/bot/${token}`, {}, {},
					);
					const bots = extractOcsData(response) as NextcloudTalkBotEntry[];
					if (!Array.isArray(bots) || !bots.some((b) => b.id === botId && b.state === 1)) {
						return false;
					}
				}
				return true;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const conversationMode = this.getNodeParameter('conversationMode') as string;
				const botId = this.getNodeParameter('botId') as number;
				const tokens =
					conversationMode === 'all'
						? await getAllRoomTokens(this)
						: getSpecificTokens(this);

				const nodeData = initNodeData(
					this.getWorkflowStaticData('node') as Record<string, unknown>,
				);

				for (const token of tokens) {
					try {
						await nextcloudApiRequest.call(
							this, 'POST', CHAT_API_PATH, `/bot/${token}/${botId}`, {},
						);
						if (!nodeData.enabledTokens.includes(token)) {
							nodeData.enabledTokens.push(token);
						}
					} catch {
						// Not a moderator in this conversation — skip silently.
					}
				}
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const conversationMode = this.getNodeParameter('conversationMode') as string;
				const botId = this.getNodeParameter('botId') as number;
				const tokens =
					conversationMode === 'all'
						? await getAllRoomTokens(this)
						: getSpecificTokens(this);

				for (const token of tokens) {
					try {
						await nextcloudApiRequest.call(
							this, 'DELETE', CHAT_API_PATH, `/bot/${token}/${botId}`, {},
						);
					} catch {
						// Already gone or not enabled — ignore.
					}
				}

				const nodeData = initNodeData(
					this.getWorkflowStaticData('node') as Record<string, unknown>,
				);
				nodeData.enabledTokens = [];

				// Clear the shared cursor so the poll node starts fresh on next activation.
				const globalData = this.getWorkflowStaticData('global');
				delete globalData[NEXTCLOUD_TALK_CURSORS_KEY];

				return true;
			},
		},
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
			const allowed = getSpecificTokens(this as unknown as IPollFunctions);
			const incomingToken = (bodyData.target as IDataObject | undefined)?.id as string | undefined;
			if (!allowed.includes(incomingToken ?? '')) {
				return { workflowData: [[]] };
			}
		}

		const options = this.getNodeParameter('options') as {
			ignoreSystemMessages?: boolean;
			actorTypes?: string[];
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

		const allowedActorTypes = options.actorTypes;
		if (allowedActorTypes && allowedActorTypes.length > 0) {
			if (!allowedActorTypes.includes(actorType ?? '')) {
				return { workflowData: [[]] };
			}
		}

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
