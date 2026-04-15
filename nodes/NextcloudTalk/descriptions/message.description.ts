import type { INodeProperties } from 'n8n-workflow';

export const messageOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: { resource: ['message'] },
		},
		options: [
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a message',
				action: 'Delete a message',
			},
			{
				name: 'Edit',
				value: 'edit',
				description: 'Edit a message',
				action: 'Edit a message',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single message by ID',
				action: 'Get a message',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				description: 'Get messages from a conversation',
				action: 'Get many messages',
			},
			{
				name: 'Mark Read',
				value: 'markRead',
				description: 'Mark messages as read up to a given message',
				action: 'Mark chat as read',
			},
			{
				name: 'React',
				value: 'react',
				description: 'Add a reaction to a message',
				action: 'React to a message',
			},
			{
				name: 'Send',
				value: 'send',
				description: 'Send a message to a conversation',
				action: 'Send a message',
			},
		],
		default: 'send',
	},
];

export const messageFields: INodeProperties[] = [
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
			show: { resource: ['message'] },
		},
	},
	// ─── Get ──────────────────────────────────────────────────────
	{
		displayName: 'Message ID',
		name: 'messageId',
		type: 'number',
		required: true,
		default: 0,
		description: 'The ID of the message to retrieve',
		displayOptions: {
			show: { resource: ['message'], operation: ['get'] },
		},
	},
	// ─── Get Many ─────────────────────────────────────────────────
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: { resource: ['message'], operation: ['getMany'] },
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 200 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: {
			show: { resource: ['message'], operation: ['getMany'], returnAll: [false] },
		},
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: { resource: ['message'], operation: ['getMany'] },
		},
		options: [
			{
				displayName: 'Last Known Message ID',
				name: 'lastKnownMessageId',
				type: 'number',
				default: 0,
				description: 'Return messages older than this message ID. Use for pagination.',
			},
		],
	},
	// ─── Send ─────────────────────────────────────────────────────
	{
		displayName: 'Message',
		name: 'message',
		type: 'string',
		required: true,
		default: '',
		description: 'The message text to send',
		displayOptions: {
			show: { resource: ['message'], operation: ['send'] },
		},
	},
	{
		displayName: 'Reply To Message ID',
		name: 'replyTo',
		type: 'number',
		default: 0,
		description: 'ID of the message to reply to. Leave at 0 to send a standalone message.',
		displayOptions: {
			show: { resource: ['message'], operation: ['send'] },
		},
	},
	{
		displayName: 'Send As',
		name: 'sender',
		type: 'options',
		noDataExpression: true,
		default: 'user',
		options: [
			{
				name: 'User',
				value: 'user',
				description: 'Send as the authenticated Nextcloud account',
			},
			{
				name: 'Bot',
				value: 'bot',
				description:
					'Send as the OCC-registered bot (actorType: bots). Use this to prevent the trigger from reacting to messages sent by this workflow. Requires the bot to be registered with <code>--feature response</code>.',
			},
		],
		displayOptions: {
			show: { resource: ['message'], operation: ['send'] },
		},
	},
	{
		displayName: 'Bot Secret',
		name: 'botSecret',
		type: 'string',
		typeOptions: { password: true },
		required: true,
		default: '',
		description:
			'The secret used when registering the bot with <code>occ talk:bot:install</code>. Requires <code>--feature response</code>.',
		displayOptions: {
			show: { resource: ['message'], operation: ['send'], sender: ['bot'] },
		},
	},
	// ─── React ────────────────────────────────────────────────────
	{
		displayName: 'Message ID',
		name: 'messageId',
		type: 'number',
		required: true,
		default: 0,
		description: 'The ID of the message to react to',
		displayOptions: {
			show: { resource: ['message'], operation: ['react'] },
		},
	},
	{
		displayName: 'Reaction',
		name: 'reaction',
		type: 'string',
		required: true,
		default: '👍',
		description: 'The emoji reaction to add',
		displayOptions: {
			show: { resource: ['message'], operation: ['react'] },
		},
	},
	// ─── Edit ─────────────────────────────────────────────────────
	{
		displayName: 'Message ID',
		name: 'messageId',
		type: 'number',
		required: true,
		default: 0,
		description: 'The ID of the message to edit',
		displayOptions: {
			show: { resource: ['message'], operation: ['edit'] },
		},
	},
	{
		displayName: 'New Message',
		name: 'message',
		type: 'string',
		required: true,
		default: '',
		description: 'The updated message text',
		displayOptions: {
			show: { resource: ['message'], operation: ['edit'] },
		},
	},
	// ─── Delete ───────────────────────────────────────────────────
	{
		displayName: 'Message ID',
		name: 'messageId',
		type: 'number',
		required: true,
		default: 0,
		description: 'The ID of the message to delete',
		displayOptions: {
			show: { resource: ['message'], operation: ['delete'] },
		},
	},
	// ─── Mark Read ────────────────────────────────────────────────
	{
		displayName: 'Last Read Message ID',
		name: 'lastReadMessage',
		type: 'number',
		default: 0,
		description:
			'Mark all messages up to and including this ID as read. Set to 0 to mark all messages as read.',
		displayOptions: {
			show: { resource: ['message'], operation: ['markRead'] },
		},
	},
];
