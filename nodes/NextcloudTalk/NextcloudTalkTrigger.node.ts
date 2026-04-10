import {
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type IPollFunctions,
} from 'n8n-workflow';

import { nextcloudApiRequest, extractOcsData, CHAT_API_PATH } from './helpers';

interface NextcloudTalkMessage {
	id: number;
	actorType: string;
	actorId: string;
	actorDisplayName: string;
	timestamp: number;
	message: string;
	messageType: string;
	systemMessage: string;
	[key: string]: unknown;
}

export class NextcloudTalkTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nextcloud Talk Trigger',
		name: 'nextcloudTalkTrigger',
		icon: { light: 'file:../../icons/nextcloud.svg', dark: 'file:../../icons/nextcloud.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '=New message in: {{$parameter["token"]}}',
		description: 'Triggers when a new message is received in a Nextcloud Talk conversation',
		defaults: {
			name: 'Nextcloud Talk Trigger',
		},
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'nextcloudApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Conversation Token',
				name: 'token',
				type: 'string',
				typeOptions: { password: true },
				required: true,
				default: '',
				description:
					'The token (ID) of the conversation to watch for new messages. You can find it in the URL when opening the conversation in Nextcloud Talk.',
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
						description:
							'Whether to ignore system messages (e.g. user joined, call started)',
					},
				],
			},
		],
		usableAsTool: true,
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const token = this.getNodeParameter('token') as string;
		const options = this.getNodeParameter('options') as { ignoreSystemMessages?: boolean };
		const ignoreSystemMessages = options.ignoreSystemMessages !== false;

		const staticData = this.getWorkflowStaticData('node') as {
			lastKnownMessageId?: number;
		};

		const isFirstRun = staticData.lastKnownMessageId === undefined;

		const qs: Record<string, string | number> = {
			lookIntoFuture: 0,
			limit: 200,
		};

		if (staticData.lastKnownMessageId) {
			qs.lastKnownMessageId = staticData.lastKnownMessageId;
			qs.lookIntoFuture = 1;
		}

		let messages: NextcloudTalkMessage[];

		try {
			const response = await nextcloudApiRequest.call(this, 'GET', CHAT_API_PATH, `/chat/${token}`, {}, qs);
			messages = extractOcsData(response) as NextcloudTalkMessage[];
		} catch (error) {
			if ((error as { statusCode?: number }).statusCode === 304) {
				// 304 Not Modified — no new messages
				return null;
			}
			throw new NodeOperationError(this.getNode(), error as Error);
		}

		if (!Array.isArray(messages) || messages.length === 0) {
			return null;
		}

		// Update last known message ID to the newest message
		const latestId = Math.max(...messages.map((m) => m.id));
		staticData.lastKnownMessageId = latestId;

		// On the very first run, we only store the cursor and emit nothing
		if (isFirstRun) {
			return null;
		}

		let filteredMessages = messages;
		if (ignoreSystemMessages) {
			filteredMessages = messages.filter((m) => m.messageType !== 'system');
		}

		if (filteredMessages.length === 0) {
			return null;
		}

		return [filteredMessages.map((message) => ({ json: message as unknown as IDataObject }))];
	}
}
