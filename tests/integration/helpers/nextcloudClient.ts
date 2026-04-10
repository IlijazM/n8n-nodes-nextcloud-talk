/**
 * Direct Nextcloud API client used for test setup/teardown.
 * This is intentionally separate from the n8n node being tested.
 */
import axios, { type AxiosInstance } from 'axios';

function createClient(): AxiosInstance {
	return axios.create({
		baseURL: process.env.NEXTCLOUD_URL,
		auth: {
			username: process.env.NEXTCLOUD_USER ?? 'admin',
			password: process.env.NEXTCLOUD_PASS ?? 'testpassword123',
		},
		headers: {
			'OCS-APIRequest': 'true',
		},
	});
}

// Lazily-created so it picks up process.env values set by globalSetup
let _client: AxiosInstance | null = null;
export function client(): AxiosInstance {
	if (!_client) _client = createClient();
	return _client;
}

export async function createConversation(name: string): Promise<string> {
	const res = await client().post('/ocs/v2.php/apps/spreed/api/v4/room', {
		roomType: 3,
		roomName: name,
	});
	return res.data.ocs.data.token as string;
}

export async function deleteConversation(token: string): Promise<void> {
	await client().delete(`/ocs/v2.php/apps/spreed/api/v4/room/${token}`);
}

export async function sendMessage(token: string, message: string): Promise<number> {
	const res = await client().post(`/ocs/v2.php/apps/spreed/api/v1/chat/${token}`, { message });
	return res.data.ocs.data.id as number;
}
