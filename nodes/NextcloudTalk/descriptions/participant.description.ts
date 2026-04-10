import type { INodeProperties } from 'n8n-workflow';

export const participantOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: { resource: ['participant'] },
		},
		options: [
			{
				name: 'Add',
				value: 'add',
				description: 'Add a participant to a conversation',
				action: 'Add a participant',
			},
			{
				name: 'Demote',
				value: 'demote',
				description: 'Demote a moderator to a regular participant',
				action: 'Demote a moderator',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				description: 'Get all participants in a conversation',
				action: 'Get many participants',
			},
			{
				name: 'Promote',
				value: 'promote',
				description: 'Promote a participant to moderator',
				action: 'Promote to moderator',
			},
			{
				name: 'Remove',
				value: 'remove',
				description: 'Remove a participant from a conversation',
				action: 'Remove a participant',
			},
		],
		default: 'getMany',
	},
];

export const participantFields: INodeProperties[] = [
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
			show: { resource: ['participant'] },
		},
	},
	// ─── Add ──────────────────────────────────────────────────────
	{
		displayName: 'Participant',
		name: 'newParticipant',
		type: 'string',
		required: true,
		default: '',
		description:
			'The user ID, group ID, email address, or phone number of the participant to add',
		displayOptions: {
			show: { resource: ['participant'], operation: ['add'] },
		},
	},
	{
		displayName: 'Source',
		name: 'source',
		type: 'options',
		default: 'users',
		options: [
			{ name: 'User', value: 'users' },
			{ name: 'Group', value: 'groups' },
			{ name: 'Circle', value: 'circles' },
			{ name: 'Email', value: 'emails' },
		],
		description: 'The type of the participant being added',
		displayOptions: {
			show: { resource: ['participant'], operation: ['add'] },
		},
	},
	// ─── Remove / Promote / Demote: attendeeId ────────────────────
	{
		displayName: 'Attendee ID',
		name: 'attendeeId',
		type: 'number',
		required: true,
		default: 0,
		description:
			'The attendee ID of the participant. Retrieve it from the Get Many operation.',
		displayOptions: {
			show: { resource: ['participant'], operation: ['remove', 'promote', 'demote'] },
		},
	},
];
