/**
 * Factories for real n8n execution contexts that make actual HTTP calls.
 *
 * Instead of mocking httpRequestWithAuthentication, these provide a real
 * axios implementation so the node code exercises genuine Nextcloud API
 * endpoints.
 */
import axios from 'axios';
import type {
	IExecuteFunctions,
	IPollFunctions,
	IHttpRequestOptions,
	IDataObject,
} from 'n8n-workflow';

function getCredentials() {
	return {
		serverUrl: process.env.NEXTCLOUD_URL ?? 'http://localhost:8080',
		username: process.env.NEXTCLOUD_USER ?? 'admin',
		appPassword: process.env.NEXTCLOUD_PASS ?? 'testpassword123',
	};
}

async function realHttpRequest(options: IHttpRequestOptions): Promise<unknown> {
	const { username, appPassword } = getCredentials();
	const authHeader = Buffer.from(`${username}:${appPassword}`).toString('base64');

	const body = options.body as Record<string, unknown> | undefined;
	const hasBody = body !== undefined && Object.keys(body).length > 0;

	const defaultHeaders: Record<string, string> = {
		Authorization: `Basic ${authHeader}`,
		'OCS-APIRequest': 'true',
		'Content-Type': 'application/json',
		Accept: 'application/json',
	};

	const response = await axios.request({
		method: options.method as string,
		url: options.url as string,
		data: hasBody ? body : undefined,
		params: options.qs as Record<string, unknown> | undefined,
		headers: {
			...defaultHeaders,
			...(options.headers as Record<string, string> | undefined),
		},
		// Do not let axios throw on HTTP errors — propagate them as structured errors
		// so the node's own error handling (e.g. statusCode === 304) can inspect them.
		validateStatus: () => true,
	});

	if (response.status >= 400 || response.status === 304) {
		const err = new Error(`HTTP ${response.status}: ${response.statusText}`);
		(err as NodeJS.ErrnoException & { statusCode?: number }).statusCode = response.status;
		throw err;
	}

	return options.returnFullResponse ? response : response.data;
}

export function createRealExecutionContext(
	params: Record<string, unknown>,
	inputItems: Array<{ json: IDataObject }> = [{ json: {} }],
): IExecuteFunctions {
	return {
		getInputData: () => inputItems,
		getNodeParameter: (name: string) => params[name],
		continueOnFail: () => false,
		getNode: () => ({ name: 'NextcloudTalk', type: 'nextcloudTalk' } as ReturnType<IExecuteFunctions['getNode']>),
		getCredentials: async () => getCredentials(),
		helpers: {
			httpRequestWithAuthentication: (_credName: string, opts: IHttpRequestOptions) =>
				realHttpRequest(opts),
		},
	} as unknown as IExecuteFunctions;
}

export function createRealPollContext(
	params: Record<string, unknown>,
	staticData: Record<string, unknown> = {},
): IPollFunctions {
	return {
		getNodeParameter: (name: string) => params[name],
		getWorkflowStaticData: () => staticData,
		getNode: () => ({ name: 'NextcloudTalkTrigger', type: 'nextcloudTalkTrigger' } as ReturnType<IPollFunctions['getNode']>),
		getCredentials: async () => getCredentials(),
		helpers: {
			httpRequestWithAuthentication: (_credName: string, opts: IHttpRequestOptions) =>
				realHttpRequest(opts),
		},
	} as unknown as IPollFunctions;
}
