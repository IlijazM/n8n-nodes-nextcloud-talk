import {
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';

import { nextcloudApiRequest, nextcloudBotRequest, extractOcsData, CHAT_API_PATH, ROOM_API_PATH } from './helpers';
import { messageOperations, messageFields } from './descriptions/message.description';
import {
	conversationOperations,
	conversationFields,
} from './descriptions/conversation.description';
import { participantOperations, participantFields } from './descriptions/participant.description';
import { pollOperations, pollFields } from './descriptions/poll.description';
import { reactionOperations, reactionFields } from './descriptions/reaction.description';

export class NextcloudTalk implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nextcloud Talk',
		name: 'nextcloudTalk',
		icon: {
			light: 'file:../../icons/nextcloud.svg',
			dark: 'file:../../icons/nextcloud.dark.svg',
		},
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Send and manage messages in Nextcloud Talk conversations',
		defaults: {
			name: 'Nextcloud Talk',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'nextcloudApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Conversation', value: 'conversation' },
					{ name: 'Message', value: 'message' },
					{ name: 'Participant', value: 'participant' },
					{ name: 'Poll', value: 'poll' },
					{ name: 'Reaction', value: 'reaction' },
				],
				default: 'message',
			},
			...conversationOperations,
			...conversationFields,
			...messageOperations,
			...messageFields,
			...participantOperations,
			...participantFields,
			...pollOperations,
			...pollFields,
			...reactionOperations,
			...reactionFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				// ─── Conversation ──────────────────────────────────────────
				if (resource === 'conversation') {
					if (operation === 'getMany') {
						const response = await nextcloudApiRequest.call(
							this,
							'GET',
							ROOM_API_PATH,
							'/room',
						);
						const conversations = extractOcsData(response) as IDataObject[];
						for (const conversation of conversations) {
							returnData.push({ json: conversation, pairedItem: { item: i } });
						}
					} else if (operation === 'get') {
						const token = this.getNodeParameter('token', i) as string;
						const response = await nextcloudApiRequest.call(
							this,
							'GET',
							ROOM_API_PATH,
							`/room/${token}`,
						);
						returnData.push({
							json: extractOcsData(response) as IDataObject,
							pairedItem: { item: i },
						});
					} else if (operation === 'create') {
						const roomType = this.getNodeParameter('roomType', i) as number;
						const body: IDataObject = { roomType };

						if (roomType === 1 || roomType === 2) {
							const invite = this.getNodeParameter('invite', i) as string;
							if (invite) body.invite = invite;
						}
						if (roomType === 2) {
							body.source = this.getNodeParameter('source', i) as string;
						}
						if (roomType === 2 || roomType === 3) {
							const roomName = this.getNodeParameter('roomName', i) as string;
							if (roomName) body.roomName = roomName;
						}

						const response = await nextcloudApiRequest.call(
							this,
							'POST',
							ROOM_API_PATH,
							'/room',
							body,
						);
						returnData.push({
							json: extractOcsData(response) as IDataObject,
							pairedItem: { item: i },
						});
					} else if (operation === 'delete') {
						const token = this.getNodeParameter('token', i) as string;
						const response = await nextcloudApiRequest.call(
							this,
							'DELETE',
							ROOM_API_PATH,
							`/room/${token}`,
						);
						returnData.push({
							json: extractOcsData(response) as IDataObject,
							pairedItem: { item: i },
						});
					} else if (operation === 'rename') {
						const token = this.getNodeParameter('token', i) as string;
						const roomName = this.getNodeParameter('roomName', i) as string;
						const response = await nextcloudApiRequest.call(
							this,
							'PUT',
							ROOM_API_PATH,
							`/room/${token}`,
							{ roomName },
						);
						returnData.push({
							json: extractOcsData(response) as IDataObject,
							pairedItem: { item: i },
						});
					} else if (operation === 'setDescription') {
						const token = this.getNodeParameter('token', i) as string;
						const description = this.getNodeParameter('description', i) as string;
						const response = await nextcloudApiRequest.call(
							this,
							'PUT',
							ROOM_API_PATH,
							`/room/${token}/description`,
							{ description },
						);
						returnData.push({
							json: extractOcsData(response) as IDataObject,
							pairedItem: { item: i },
						});
					} else if (operation === 'setGuestAccess') {
						const token = this.getNodeParameter('token', i) as string;
						const allowGuests = this.getNodeParameter('allowGuests', i) as boolean;
						const response = await nextcloudApiRequest.call(
							this,
							allowGuests ? 'POST' : 'DELETE',
							ROOM_API_PATH,
							`/room/${token}/public`,
						);
						returnData.push({
							json: extractOcsData(response) as IDataObject,
							pairedItem: { item: i },
						});
					} else if (operation === 'setFavorite') {
						const token = this.getNodeParameter('token', i) as string;
						const favorite = this.getNodeParameter('favorite', i) as boolean;
						const response = await nextcloudApiRequest.call(
							this,
							favorite ? 'POST' : 'DELETE',
							ROOM_API_PATH,
							`/room/${token}/favorite`,
						);
						returnData.push({
							json: extractOcsData(response) as IDataObject,
							pairedItem: { item: i },
						});
					} else if (operation === 'setNotificationLevel') {
						const token = this.getNodeParameter('token', i) as string;
						const level = this.getNodeParameter('notificationLevel', i) as number;
						const response = await nextcloudApiRequest.call(
							this,
							'POST',
							ROOM_API_PATH,
							`/room/${token}/notify`,
							{ level },
						);
						returnData.push({
							json: extractOcsData(response) as IDataObject,
							pairedItem: { item: i },
						});
					} else if (operation === 'setReadOnly') {
						const token = this.getNodeParameter('token', i) as string;
						const readOnly = this.getNodeParameter('readOnly', i) as boolean;
						const response = await nextcloudApiRequest.call(
							this,
							'PUT',
							ROOM_API_PATH,
							`/room/${token}/read-only`,
							{ state: readOnly ? 1 : 0 },
						);
						returnData.push({
							json: extractOcsData(response) as IDataObject,
							pairedItem: { item: i },
						});
					}

				// ─── Message ───────────────────────────────────────────────
				} else if (resource === 'message') {
					const token = this.getNodeParameter('token', i) as string;

					if (operation === 'getMany') {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						const additionalOptions = this.getNodeParameter('additionalOptions', i) as {
							lastKnownMessageId?: number;
						};

						const qs: IDataObject = { lookIntoFuture: 0 };
						qs.limit = returnAll ? 200 : (this.getNodeParameter('limit', i) as number);
						if (additionalOptions.lastKnownMessageId) {
							qs.lastKnownMessageId = additionalOptions.lastKnownMessageId;
						}

						const response = await nextcloudApiRequest.call(
							this,
							'GET',
							CHAT_API_PATH,
							`/chat/${token}`,
							{},
							qs,
						);
						const messages = extractOcsData(response) as IDataObject[];
						for (const message of messages) {
							returnData.push({ json: message, pairedItem: { item: i } });
						}
					} else if (operation === 'send') {
						const message = this.getNodeParameter('message', i) as string;
						const replyTo = this.getNodeParameter('replyTo', i, 0) as number;
						const sender = this.getNodeParameter('sender', i, 'user') as string;

						const body: IDataObject = { message };
						if (replyTo > 0) body.replyTo = replyTo;

						let response: unknown;
						if (sender === 'bot') {
							const botSecret = (this.getNodeParameter('botSecret', i) as string).trim();
							const credentials = await this.getCredentials('nextcloudApi');
							const serverUrl = (credentials.serverUrl as string).replace(/\/$/, '');
							response = await nextcloudBotRequest.call(this, serverUrl, token, botSecret, body);
						} else {
							response = await nextcloudApiRequest.call(this, 'POST', CHAT_API_PATH, `/chat/${token}`, body);
						}
						returnData.push({
							json: extractOcsData(response) as IDataObject,
							pairedItem: { item: i },
						});
					} else if (operation === 'react') {
						const messageId = this.getNodeParameter('messageId', i) as number;
						const reaction = this.getNodeParameter('reaction', i) as string;
						const response = await nextcloudApiRequest.call(
							this,
							'POST',
							CHAT_API_PATH,
							`/reaction/${token}/${messageId}`,
							{ reaction },
						);
						returnData.push({
							json: extractOcsData(response) as IDataObject,
							pairedItem: { item: i },
						});
					} else if (operation === 'edit') {
						const messageId = this.getNodeParameter('messageId', i) as number;
						const message = this.getNodeParameter('message', i) as string;
						const response = await nextcloudApiRequest.call(
							this,
							'PUT',
							CHAT_API_PATH,
							`/chat/${token}/${messageId}`,
							{ message },
						);
						returnData.push({
							json: extractOcsData(response) as IDataObject,
							pairedItem: { item: i },
						});
					} else if (operation === 'delete') {
						const messageId = this.getNodeParameter('messageId', i) as number;
						const response = await nextcloudApiRequest.call(
							this,
							'DELETE',
							CHAT_API_PATH,
							`/chat/${token}/${messageId}`,
						);
						returnData.push({
							json: extractOcsData(response) as IDataObject,
							pairedItem: { item: i },
						});
					} else if (operation === 'markRead') {
						const lastReadMessage = this.getNodeParameter('lastReadMessage', i) as number;
						const response = await nextcloudApiRequest.call(
							this,
							'POST',
							CHAT_API_PATH,
							`/chat/${token}/read`,
							{ lastReadMessage: lastReadMessage || null },
						);
						returnData.push({
							json: extractOcsData(response) as IDataObject,
							pairedItem: { item: i },
						});
					}

				// ─── Participant ───────────────────────────────────────────
				} else if (resource === 'participant') {
					const token = this.getNodeParameter('token', i) as string;

					if (operation === 'getMany') {
						const response = await nextcloudApiRequest.call(
							this,
							'GET',
							ROOM_API_PATH,
							`/room/${token}/participants`,
						);
						const participants = extractOcsData(response) as IDataObject[];
						for (const participant of participants) {
							returnData.push({ json: participant, pairedItem: { item: i } });
						}
					} else if (operation === 'add') {
						const newParticipant = this.getNodeParameter('newParticipant', i) as string;
						const source = this.getNodeParameter('source', i) as string;
						const response = await nextcloudApiRequest.call(
							this,
							'POST',
							ROOM_API_PATH,
							`/room/${token}/participants`,
							{ newParticipant, source },
						);
						returnData.push({
							json: extractOcsData(response) as IDataObject,
							pairedItem: { item: i },
						});
					} else if (operation === 'remove') {
						const attendeeId = this.getNodeParameter('attendeeId', i) as number;
						const response = await nextcloudApiRequest.call(
							this,
							'DELETE',
							ROOM_API_PATH,
							`/room/${token}/attendees`,
							{ attendeeId },
						);
						returnData.push({
							json: extractOcsData(response) as IDataObject,
							pairedItem: { item: i },
						});
					} else if (operation === 'promote') {
						const attendeeId = this.getNodeParameter('attendeeId', i) as number;
						const response = await nextcloudApiRequest.call(
							this,
							'POST',
							ROOM_API_PATH,
							`/room/${token}/moderators`,
							{ attendeeId },
						);
						returnData.push({
							json: extractOcsData(response) as IDataObject,
							pairedItem: { item: i },
						});
					} else if (operation === 'demote') {
						const attendeeId = this.getNodeParameter('attendeeId', i) as number;
						const response = await nextcloudApiRequest.call(
							this,
							'DELETE',
							ROOM_API_PATH,
							`/room/${token}/moderators`,
							{ attendeeId },
						);
						returnData.push({
							json: extractOcsData(response) as IDataObject,
							pairedItem: { item: i },
						});
					}

				// ─── Poll ──────────────────────────────────────────────────
				} else if (resource === 'poll') {
					const token = this.getNodeParameter('token', i) as string;

					if (operation === 'create') {
						const question = this.getNodeParameter('question', i) as string;
						const resultMode = this.getNodeParameter('resultMode', i) as number;
						const maxVotes = this.getNodeParameter('maxVotes', i) as number;
						const pollOptionsCollection = this.getNodeParameter('pollOptions', i) as {
							option?: Array<{ text: string }>;
						};
						const options = (pollOptionsCollection.option ?? []).map((o) => o.text);

						const response = await nextcloudApiRequest.call(
							this,
							'POST',
							CHAT_API_PATH,
							`/poll/${token}`,
							{ question, options, resultMode, maxVotes },
						);
						returnData.push({
							json: extractOcsData(response) as IDataObject,
							pairedItem: { item: i },
						});
					} else if (operation === 'get') {
						const pollId = this.getNodeParameter('pollId', i) as number;
						const response = await nextcloudApiRequest.call(
							this,
							'GET',
							CHAT_API_PATH,
							`/poll/${token}/${pollId}`,
						);
						returnData.push({
							json: extractOcsData(response) as IDataObject,
							pairedItem: { item: i },
						});
					} else if (operation === 'vote') {
						const pollId = this.getNodeParameter('pollId', i) as number;
						const optionIdsCollection = this.getNodeParameter('optionIds', i) as {
							id?: Array<{ value: number }>;
						};
						const optionIds = (optionIdsCollection.id ?? []).map((o) => o.value);

						const response = await nextcloudApiRequest.call(
							this,
							'POST',
							CHAT_API_PATH,
							`/poll/${token}/${pollId}`,
							{ optionIds },
						);
						returnData.push({
							json: extractOcsData(response) as IDataObject,
							pairedItem: { item: i },
						});
					} else if (operation === 'close') {
						const pollId = this.getNodeParameter('pollId', i) as number;
						const response = await nextcloudApiRequest.call(
							this,
							'DELETE',
							CHAT_API_PATH,
							`/poll/${token}/${pollId}`,
						);
						returnData.push({
							json: extractOcsData(response) as IDataObject,
							pairedItem: { item: i },
						});
					}

				// ─── Reaction ──────────────────────────────────────────────
				} else if (resource === 'reaction') {
					const token = this.getNodeParameter('token', i) as string;
					const messageId = this.getNodeParameter('messageId', i) as number;

					if (operation === 'add') {
						const reaction = this.getNodeParameter('reaction', i) as string;
						const response = await nextcloudApiRequest.call(
							this,
							'POST',
							CHAT_API_PATH,
							`/reaction/${token}/${messageId}`,
							{ reaction },
						);
						// Nextcloud returns { "👍": [{actorId, actorType, ...}], ... }
						const reactionData = extractOcsData(response) as Record<string, IDataObject[]>;
						for (const [emoji, reactions] of Object.entries(reactionData)) {
							if (Array.isArray(reactions)) {
								for (const r of reactions) {
									returnData.push({ json: { ...r, reaction: emoji }, pairedItem: { item: i } });
								}
							}
						}
					} else if (operation === 'remove') {
						const reaction = this.getNodeParameter('reaction', i) as string;
						const response = await nextcloudApiRequest.call(
							this,
							'DELETE',
							CHAT_API_PATH,
							`/reaction/${token}/${messageId}`,
							{ reaction },
						);
						returnData.push({
							json: extractOcsData(response) as IDataObject,
							pairedItem: { item: i },
						});
					} else if (operation === 'get') {
						const reactionFilter = this.getNodeParameter('reaction', i) as string;
						const qs: IDataObject = {};
						if (reactionFilter) qs.reaction = reactionFilter;

						const response = await nextcloudApiRequest.call(
							this,
							'GET',
							CHAT_API_PATH,
							`/reaction/${token}/${messageId}`,
							{},
							qs,
						);
						// Nextcloud returns { "👍": [{actorId, actorType, ...}], ... }
						const reactionData = extractOcsData(response) as Record<string, IDataObject[]>;
						for (const [emoji, reactions] of Object.entries(reactionData)) {
							if (Array.isArray(reactions)) {
								for (const r of reactions) {
									returnData.push({ json: { ...r, reaction: emoji }, pairedItem: { item: i } });
								}
							}
						}
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}

				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
