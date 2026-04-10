export const NEXTCLOUD_TALK_CURSORS_KEY = 'nextcloudTalkCursors';

export interface NextcloudTalkMessage {
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

export interface NextcloudTalkRoom {
	token: string;
	[key: string]: unknown;
}

export interface NextcloudTalkBotEntry {
	id: number;
	state: number;
	[key: string]: unknown;
}

