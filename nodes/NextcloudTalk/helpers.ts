import crypto from 'crypto';
import type {
	IAllExecuteFunctions,
	IDataObject,
	IHttpRequestMethods,
	IHttpRequestOptions,
} from 'n8n-workflow';

// Chat and reaction endpoints live under API v1.
// Room/conversation management lives under API v4.
export const CHAT_API_PATH = '/ocs/v2.php/apps/spreed/api/v1';
export const ROOM_API_PATH = '/ocs/v2.php/apps/spreed/api/v4';

export async function nextcloudApiRequest(
	this: IAllExecuteFunctions,
	method: IHttpRequestMethods,
	apiPath: string,
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
): Promise<unknown> {
	const credentials = await this.getCredentials('nextcloudApi');
	const serverUrl = (credentials.serverUrl as string).replace(/\/$/, '');

	const options: IHttpRequestOptions = {
		method,
		url: `${serverUrl}${apiPath}${endpoint}`,
		headers: {
			Accept: 'application/json',
		},
		qs,
		body,
		json: true,
	};

	// httpRequestWithAuthentication requires `this` to be the full execution
	// context (IAllExecuteFunctions) so n8n can resolve credentials and access
	// getExecutionCancelSignal. We must call it via .call(this) rather than
	// extracting the function reference, which would lose the context.
	return this.helpers.httpRequestWithAuthentication.call(this, 'nextcloudApi', options);
}

// Sends a message as a registered bot using HMAC-signed authentication.
// The message will appear with actorType "bots" in Nextcloud Talk.
// serverUrl must be passed by the caller (already retrieved from credentials).
export async function nextcloudBotRequest(
	this: IAllExecuteFunctions,
	serverUrl: string,
	conversationToken: string,
	botSecret: string,
	body: IDataObject,
): Promise<unknown> {
	const message = body.message as string;
	const random = crypto.randomBytes(32).toString('hex');
	// Nextcloud Talk verifies the signature against the extracted message text only,
	// not the full JSON body. See ChecksumVerificationService.php:
	//   hash_hmac('sha256', $random . $data, $secret)
	// where $data is the "message" parameter value, not the raw request body.
	const signature = crypto.createHmac('sha256', botSecret).update(random + message).digest('hex');
	const rawBody = JSON.stringify(body);
	const url = `${serverUrl}${CHAT_API_PATH}/bot/${conversationToken}/message`;

	const options: IHttpRequestOptions = {
		method: 'POST',
		url,
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'OCS-APIRequest': 'true',
			'X-Nextcloud-Talk-Bot-Random': random,
			'X-Nextcloud-Talk-Bot-Signature': signature,
		},
		body: rawBody,
		json: false,
	};

	let response: unknown;
	try {
		response = await this.helpers.httpRequest(options);
	} catch (error) {
		const status = (error as { response?: { status?: number } }).response?.status;
		if (status === 429) {
			throw new Error('Nextcloud Talk bot rate limit reached (429). Wait a moment before sending another message.');
		}
		throw error;
	}
	return typeof response === 'string' ? JSON.parse(response) : response;
}

export function extractOcsData(response: unknown): unknown {
	const res = response as { ocs?: { data?: unknown } };
	return res?.ocs?.data ?? response;
}
