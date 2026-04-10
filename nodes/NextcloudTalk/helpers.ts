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

export function extractOcsData(response: unknown): unknown {
	const res = response as { ocs?: { data?: unknown } };
	return res?.ocs?.data ?? response;
}
