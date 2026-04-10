import type { INodeProperties } from 'n8n-workflow';

export const conversationOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: { resource: ['conversation'] },
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new conversation',
				action: 'Create a conversation',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a conversation',
				action: 'Delete a conversation',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single conversation by token',
				action: 'Get a conversation',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				description: "Get all of the user's conversations",
				action: 'Get many conversations',
			},
			{
				name: 'Rename',
				value: 'rename',
				description: 'Rename a conversation',
				action: 'Rename a conversation',
			},
			{
				name: 'Set Description',
				value: 'setDescription',
				description: 'Set the description of a conversation',
				action: 'Set conversation description',
			},
			{
				name: 'Set Favorite',
				value: 'setFavorite',
				description: 'Add or remove a conversation from favorites',
				action: 'Set conversation favorite',
			},
			{
				name: 'Set Guest Access',
				value: 'setGuestAccess',
				description: 'Allow or disallow guests from joining a conversation',
				action: 'Set guest access',
			},
			{
				name: 'Set Notification Level',
				value: 'setNotificationLevel',
				description: 'Set the notification preference for a conversation',
				action: 'Set notification level',
			},
			{
				name: 'Set Read-Only',
				value: 'setReadOnly',
				description: 'Set the read-only state of a conversation',
				action: 'Set read only state',
			},
		],
		default: 'getMany',
	},
];

export const conversationFields: INodeProperties[] = [
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
			show: {
				resource: ['conversation'],
				operation: [
					'get',
					'delete',
					'rename',
					'setDescription',
					'setGuestAccess',
					'setFavorite',
					'setNotificationLevel',
					'setReadOnly',
				],
			},
		},
	},
	// ─── Create ───────────────────────────────────────────────────
	{
		displayName: 'Room Type',
		name: 'roomType',
		type: 'options',
		required: true,
		default: 3,
		options: [
			{
				name: 'One-to-One',
				value: 1,
				description: 'Private conversation with a single user',
			},
			{
				name: 'Group',
				value: 2,
				description: 'Private group conversation',
			},
			{
				name: 'Public',
				value: 3,
				description: 'Conversation open to anyone with the link',
			},
		],
		displayOptions: {
			show: { resource: ['conversation'], operation: ['create'] },
		},
	},
	{
		displayName: 'Invite',
		name: 'invite',
		type: 'string',
		default: '',
		description:
			'User ID for one-to-one conversations, or group/circle ID for group conversations',
		displayOptions: {
			show: {
				resource: ['conversation'],
				operation: ['create'],
				roomType: [1, 2],
			},
		},
	},
	{
		displayName: 'Source',
		name: 'source',
		type: 'options',
		default: 'groups',
		options: [
			{ name: 'Group', value: 'groups' },
			{ name: 'Circle', value: 'circles' },
		],
		description: 'Whether the invite ID refers to a group or a circle',
		displayOptions: {
			show: {
				resource: ['conversation'],
				operation: ['create'],
				roomType: [2],
			},
		},
	},
	{
		displayName: 'Room Name',
		name: 'roomName',
		type: 'string',
		default: '',
		description: 'Name of the conversation (not applicable to one-to-one conversations)',
		displayOptions: {
			show: {
				resource: ['conversation'],
				operation: ['create'],
				roomType: [2, 3],
			},
		},
	},
	// ─── Rename ───────────────────────────────────────────────────
	{
		displayName: 'New Name',
		name: 'roomName',
		type: 'string',
		required: true,
		default: '',
		description: 'New name for the conversation (max 255 characters)',
		displayOptions: {
			show: { resource: ['conversation'], operation: ['rename'] },
		},
	},
	// ─── Set Description ──────────────────────────────────────────
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		required: true,
		default: '',
		description: 'Description for the conversation (max 2,000 characters)',
		displayOptions: {
			show: { resource: ['conversation'], operation: ['setDescription'] },
		},
	},
	// ─── Set Guest Access ─────────────────────────────────────────
	{
		displayName: 'Allow Guests',
		name: 'allowGuests',
		type: 'boolean',
		required: true,
		default: true,
		description: 'Whether to allow guests to join the conversation via a public link',
		displayOptions: {
			show: { resource: ['conversation'], operation: ['setGuestAccess'] },
		},
	},
	// ─── Set Favorite ─────────────────────────────────────────────
	{
		displayName: 'Favorite',
		name: 'favorite',
		type: 'boolean',
		required: true,
		default: true,
		description: 'Whether to mark the conversation as a favorite',
		displayOptions: {
			show: { resource: ['conversation'], operation: ['setFavorite'] },
		},
	},
	// ─── Set Notification Level ───────────────────────────────────
	{
		displayName: 'Notification Level',
		name: 'notificationLevel',
		type: 'options',
		required: true,
		default: 0,
		options: [
			{ name: 'Default', value: 0, description: 'Use global notification settings' },
			{ name: 'All Messages', value: 1, description: 'Notify on every message' },
			{ name: 'Mentions Only', value: 2, description: 'Notify only on @-mentions' },
			{ name: 'Off', value: 3, description: 'No notifications' },
		],
		displayOptions: {
			show: { resource: ['conversation'], operation: ['setNotificationLevel'] },
		},
	},
	// ─── Set Read-Only ────────────────────────────────────────────
	{
		displayName: 'Read-Only',
		name: 'readOnly',
		type: 'boolean',
		required: true,
		default: true,
		description: 'Whether to set the conversation to read-only (participants cannot post messages)',
		displayOptions: {
			show: { resource: ['conversation'], operation: ['setReadOnly'] },
		},
	},
];
