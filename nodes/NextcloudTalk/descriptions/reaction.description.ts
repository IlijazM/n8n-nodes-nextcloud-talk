import type { INodeProperties } from 'n8n-workflow';

export const reactionOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: { resource: ['reaction'] },
		},
		options: [
			{
				name: 'Add',
				value: 'add',
				description: 'Add a reaction to a message',
				action: 'Add a reaction',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get all reactions for a message',
				action: 'Get reactions',
			},
			{
				name: 'Remove',
				value: 'remove',
				description: 'Remove a reaction from a message',
				action: 'Remove a reaction',
			},
		],
		default: 'add',
	},
];

export const reactionFields: INodeProperties[] = [
	// ─── Shared: Conversation Token ───────────────────────────────
	{
		displayName: 'Conversation Token',
		name: 'token',
		type: 'string',
		typeOptions: { password: true },
		required: true,
		default: '',
		description:
			'The token (ID) of the conversation. You can find it in the URL when opening the conversation in Nextcloud Talk.',
		displayOptions: {
			show: { resource: ['reaction'] },
		},
	},
	// ─── Shared: Message ID ───────────────────────────────────────
	{
		displayName: 'Message ID',
		name: 'messageId',
		type: 'number',
		required: true,
		default: 0,
		description: 'The ID of the message',
		displayOptions: {
			show: { resource: ['reaction'] },
		},
	},
	// ─── Add / Remove: emoji ──────────────────────────────────────
	{
		displayName: 'Reaction',
		name: 'reaction',
		type: 'string',
		required: true,
		default: '👍',
		description: 'The emoji reaction',
		displayOptions: {
			show: { resource: ['reaction'], operation: ['add', 'remove'] },
		},
	},
	// ─── Get: optional emoji filter ───────────────────────────────
	{
		displayName: 'Emoji Filter',
		name: 'reaction',
		type: 'string',
		default: '',
		description: 'Filter results to a specific emoji. Leave empty to get all reactions.',
		displayOptions: {
			show: { resource: ['reaction'], operation: ['get'] },
		},
	},
];
