import {
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type IPollFunctions,
} from 'n8n-workflow';

import { nextcloudApiRequest, extractOcsData, CHAT_API_PATH, ROOM_API_PATH } from './helpers';
import type { NextcloudTalkMessage, NextcloudTalkRoom } from './types';
import { NEXTCLOUD_TALK_CURSORS_KEY } from './types';

// ── helpers ───────────────────────────────────────────────────────────────────

function getSpecificTokens(context: IPollFunctions): string[] {
	const col = context.getNodeParameter('tokens') as { token?: Array<{ value: string }> };
	return (col.token ?? []).map((t) => t.value).filter(Boolean);
}

function applyFilters(
	messages: NextcloudTalkMessage[],
	ignoreSystemMessages: boolean,
): NextcloudTalkMessage[] {
	if (!ignoreSystemMessages) return messages;
	return messages.filter((m) => m.messageType !== 'system');
}

// ── node ──────────────────────────────────────────────────────────────────────

export class NextcloudTalkPollTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nextcloud Talk Poll Trigger',
		name: 'nextcloudTalkPollTrigger',
		icon: { light: 'file:../../icons/nextcloud.svg', dark: 'file:../../icons/nextcloud.dark.svg' },
		group: ['trigger'],
		version: 1,
		description:
			'Polls Nextcloud Talk conversations for new messages on a schedule. Use alongside the Webhook Trigger for real-time delivery with poll as fallback.',
		subtitle:
			'={{$parameter["conversationMode"] === "all" ? "All conversations" : "Specific conversation(s)"}}',
		defaults: { name: 'Nextcloud Talk Poll Trigger' },
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'nextcloudApi', required: true }],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Trigger For',
				name: 'conversationMode',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'All Conversations',
						value: 'all',
						description: 'Poll for new messages in any conversation the credentials user is a member of',
					},
					{
						name: 'Specific Conversation(s)',
						value: 'specific',
						description: 'Poll only for messages in the configured conversations',
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

	// ── poll ──────────────────────────────────────────────────────────────────

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const conversationMode = this.getNodeParameter('conversationMode') as string;
		const options = this.getNodeParameter('options') as { ignoreSystemMessages?: boolean };
		const ignoreSystemMessages = options.ignoreSystemMessages !== false;
		const isManualMode = this.getMode() === 'manual';

		// Shared state across both trigger nodes in this workflow.
		// NOTE: n8n does not persist static data when poll() returns null, so the
		// cursor is only reliable in automated (trigger) mode. In manual mode we
		// skip cursor logic entirely and just return the most recent messages.
		const globalData = this.getWorkflowStaticData('global');
		const cursors = (globalData[NEXTCLOUD_TALK_CURSORS_KEY] ?? {}) as Record<string, number>;

		// Resolve which conversations to poll.
		let tokensToPoll: string[];

		if (conversationMode === 'all') {
			const response = await nextcloudApiRequest.call(this, 'GET', ROOM_API_PATH, '/room', {}, {});
			const rooms = extractOcsData(response) as NextcloudTalkRoom[];
			tokensToPoll = Array.isArray(rooms) ? rooms.map((r) => r.token).filter(Boolean) : [];
		} else {
			tokensToPoll = getSpecificTokens(this);
		}

		const allMessages: INodeExecutionData[] = [];

		for (const token of tokensToPoll) {
			const qs: Record<string, string | number> = { lookIntoFuture: 0, limit: isManualMode ? 1 : 200 };

			let messages: NextcloudTalkMessage[];
			try {
				const response = await nextcloudApiRequest.call(
					this, 'GET', CHAT_API_PATH, `/chat/${token}`, {}, qs,
				);
				messages = extractOcsData(response) as NextcloudTalkMessage[];
			} catch (error) {
				throw new NodeOperationError(this.getNode(), error as Error);
			}

			if (!Array.isArray(messages) || messages.length === 0) continue;

			const latestId = Math.max(...messages.map((m) => m.id));

			if (isManualMode) {
				// In test mode static data is not persisted, so cursor is useless.
				// Just show the most recent message as a preview — same UX as other n8n triggers.
				const filtered = applyFilters(messages, ignoreSystemMessages);
				for (const message of filtered) {
					allMessages.push({ json: { ...(message as unknown as IDataObject), _source: 'poll' } });
				}
			} else {
				// Automated mode: use cursor to only emit new messages.
				const cursor = cursors[token] ?? -1;
				const isFirstRun = cursors[token] === undefined;

				if (latestId > cursor) {
					cursors[token] = latestId;
					globalData[NEXTCLOUD_TALK_CURSORS_KEY] = cursors;
				}

				if (isFirstRun) continue;

				const newMessages = messages.filter((m) => m.id > cursor);
				const filtered = applyFilters(newMessages, ignoreSystemMessages);

				for (const message of filtered) {
					allMessages.push({ json: { ...(message as unknown as IDataObject), _source: 'poll' } });
				}
			}
		}

		if (allMessages.length === 0) return null;

		// In test mode return only the single most recent message as a data sample.
		const output = isManualMode ? [allMessages[allMessages.length - 1]] : allMessages;
		return [output];
	}
}
