import type { INodeProperties } from 'n8n-workflow';

export const botOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: { resource: ['bot'] },
		},
		options: [
			{
				name: 'Enable for Conversation',
				value: 'enable',
				description: 'Enable a bot in a conversation',
				action: 'Enable a bot in a conversation',
			},
			{
				name: 'Disable for Conversation',
				value: 'disable',
				description: 'Disable a bot in a conversation',
				action: 'Disable a bot in a conversation',
			},
			{
				name: 'List for Conversation',
				value: 'list',
				description: 'List bots installed in a conversation',
				action: 'List bots in a conversation',
			},
		],
		default: 'enable',
	},
];

export const botFields: INodeProperties[] = [
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
			show: { resource: ['bot'] },
		},
	},
	{
		displayName: 'Bot ID',
		name: 'botId',
		type: 'number',
		required: true,
		default: 0,
		description:
			'The numeric ID of the bot as assigned by Nextcloud. Shown in the output of <code>occ talk:bot:install</code> or <code>occ talk:bot:list</code>.',
		displayOptions: {
			show: { resource: ['bot'], operation: ['enable', 'disable'] },
		},
	},
];
