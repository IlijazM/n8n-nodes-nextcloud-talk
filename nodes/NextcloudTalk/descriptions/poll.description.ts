import type { INodeProperties } from 'n8n-workflow';

export const pollOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: { resource: ['poll'] },
		},
		options: [
			{
				name: 'Close',
				value: 'close',
				description: 'Close a poll (moderator only)',
				action: 'Close a poll',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a poll in a conversation',
				action: 'Create a poll',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get the current state and results of a poll',
				action: 'Get a poll',
			},
			{
				name: 'Vote',
				value: 'vote',
				description: 'Cast votes on a poll',
				action: 'Vote on a poll',
			},
		],
		default: 'create',
	},
];

export const pollFields: INodeProperties[] = [
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
			show: { resource: ['poll'] },
		},
	},
	// ─── Shared: Poll ID ──────────────────────────────────────────
	{
		displayName: 'Poll ID',
		name: 'pollId',
		type: 'number',
		required: true,
		default: 0,
		description: 'The ID of the poll',
		displayOptions: {
			show: { resource: ['poll'], operation: ['get', 'vote', 'close'] },
		},
	},
	// ─── Create ───────────────────────────────────────────────────
	{
		displayName: 'Question',
		name: 'question',
		type: 'string',
		required: true,
		default: '',
		description: 'The poll question',
		displayOptions: {
			show: { resource: ['poll'], operation: ['create'] },
		},
	},
	{
		displayName: 'Options',
		name: 'pollOptions',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		required: true,
		default: { option: [{ text: '' }] },
		description: 'The answer options for the poll',
		displayOptions: {
			show: { resource: ['poll'], operation: ['create'] },
		},
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
		displayName: 'Result Mode',
		name: 'resultMode',
		type: 'options',
		required: true,
		default: 0,
		options: [
			{
				name: 'Public',
				value: 0,
				description: 'Results are visible to all participants while the poll is open',
			},
			{
				name: 'Hidden Until Closed',
				value: 1,
				description: 'Results are only revealed after the poll is closed',
			},
		],
		displayOptions: {
			show: { resource: ['poll'], operation: ['create'] },
		},
	},
	{
		displayName: 'Max Votes',
		name: 'maxVotes',
		type: 'number',
		required: true,
		default: 1,
		description: 'Maximum number of options a participant can vote for. Use 0 for unlimited.',
		displayOptions: {
			show: { resource: ['poll'], operation: ['create'] },
		},
	},
	// ─── Vote ─────────────────────────────────────────────────────
	{
		displayName: 'Option IDs',
		name: 'optionIds',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		required: true,
		default: { id: [{ value: 0 }] },
		description: 'The IDs of the options to vote for (0-based index)',
		displayOptions: {
			show: { resource: ['poll'], operation: ['vote'] },
		},
		options: [
			{
				name: 'id',
				displayName: 'ID',
				values: [
					{
						displayName: 'Option ID',
						name: 'value',
						type: 'number',
						default: 0,
						description: '0-based index of the option to vote for',
					},
				],
			},
		],
	},
];
