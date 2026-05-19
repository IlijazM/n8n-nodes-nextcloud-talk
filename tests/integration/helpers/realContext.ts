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
	IWebhookFunctions,
	IHttpRequestOptions,
	IDataObject,
	INodeExecutionData,
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
	globalData: Record<string, unknown> = {},
	mode: 'manual' | 'trigger' = 'trigger',
): IPollFunctions {
	const nodeData: Record<string, unknown> = {};
	return {
		getNodeParameter: (name: string) => params[name],
		getWorkflowStaticData: (scope: string) => scope === 'global' ? globalData : nodeData,
		getMode: () => mode,
		getNode: () => ({ name: 'NextcloudTalkPollTrigger', type: 'nextcloudTalkPollTrigger' } as ReturnType<IPollFunctions['getNode']>),
		getCredentials: async () => getCredentials(),
		helpers: {
			httpRequestWithAuthentication: (_credName: string, opts: IHttpRequestOptions) =>
				realHttpRequest(opts),
		},
	} as unknown as IPollFunctions;
}

/**
 * Captured response from a mock webhook context. The webhook node calls
 * `getResponseObject().status(code).json(body)` for error replies; the
 * captured values let tests assert on the rejection path.
 */
export interface CapturedWebhookResponse {
	status?: number;
	body?: unknown;
}

/**
 * Build a default OCS-shaped chat response derived from the ActivityPub event,
 * so existing tests keep matching even though the trigger now enriches via the
 * Chat API. Tests that care about specific enrichment fields (e.g. `parent`,
 * `referenceId`) should pass an explicit `httpResponse`.
 */
function defaultChatResponse(body: IDataObject): unknown {
	const obj = (body.object ?? {}) as IDataObject;
	const actor = (body.actor ?? {}) as IDataObject;
	const target = (body.target ?? {}) as IDataObject;
	const id = typeof obj.id === 'number' ? obj.id : Number(obj.id);
	const actorIdRaw = (actor.id as string | undefined) ?? '';
	const slashIdx = actorIdRaw.indexOf('/');
	const actorType = slashIdx >= 0 ? actorIdRaw.slice(0, slashIdx) : actorIdRaw;
	const actorId = slashIdx >= 0 ? actorIdRaw.slice(slashIdx + 1) : actorIdRaw;
	let parsed: { message?: string; parameters?: unknown } = {};
	try {
		parsed = JSON.parse((obj.content as string) ?? '{}');
	} catch {
		// keep parsed empty
	}
	const isNote = obj.type === 'Note';
	return {
		ocs: {
			meta: { status: 'ok', statuscode: 200 },
			data: [
				{
					id,
					token: target.id,
					actorType,
					actorId,
					actorDisplayName: actor.name,
					timestamp: 1700000000,
					message: parsed.message ?? '',
					messageParameters: parsed.parameters ?? [],
					systemMessage: '',
					messageType: isNote ? 'comment' : 'system',
					isReplyable: isNote,
					referenceId: `ref-${id}`,
					reactions: {},
					expirationTimestamp: 0,
					markdown: true,
					threadId: id,
				},
			],
		},
	};
}

/**
 * Pure in-process mock of IWebhookFunctions. Used to drive `webhook()` from
 * tests with fully-controlled headers, body, and rawBody. No HTTP server,
 * no Nextcloud round-trip — these tests exist to exercise the trigger's own
 * signature/filter/normalization logic.
 *
 * `httpResponse` controls what the (mocked) Chat API enrichment call returns.
 * Default: an OCS envelope derived from the ActivityPub body.
 * Pass a function to inspect the request options or throw to simulate failure.
 */
export function createMockWebhookContext(args: {
	params: Record<string, unknown>;
	headers: Record<string, string>;
	body: IDataObject;
	rawBody?: string;
	globalData?: Record<string, unknown>;
	httpResponse?: unknown | ((opts: IHttpRequestOptions) => unknown);
}): { ctx: IWebhookFunctions; response: CapturedWebhookResponse; httpCalls: IHttpRequestOptions[] } {
	const response: CapturedWebhookResponse = {};
	const globalData = args.globalData ?? {};
	const nodeData: Record<string, unknown> = {};
	const httpCalls: IHttpRequestOptions[] = [];

	const responseObject = {
		status(code: number) {
			response.status = code;
			return {
				json(payload: unknown) {
					response.body = payload;
				},
			};
		},
	};

	const requestObject = {
		rawBody: Buffer.from(args.rawBody ?? JSON.stringify(args.body), 'utf8'),
	};

	const ctx = {
		getNodeParameter: (name: string) => args.params[name],
		getHeaderData: () => args.headers,
		getRequestObject: () => requestObject,
		getResponseObject: () => responseObject,
		getBodyData: () => args.body,
		getWorkflowStaticData: (scope: string) => (scope === 'global' ? globalData : nodeData),
		getMode: () => 'trigger',
		getNode: () => ({ name: 'NextcloudTalkWebhookTrigger', type: 'nextcloudTalkWebhookTrigger' } as ReturnType<IWebhookFunctions['getNode']>),
		getCredentials: async () => ({
			serverUrl: 'http://mock-nextcloud.local',
			username: 'mock',
			appPassword: 'mock',
		}),
		logger: { warn: () => {}, info: () => {}, error: () => {}, debug: () => {} },
		helpers: {
			returnJsonArray: (items: IDataObject | IDataObject[]): INodeExecutionData[] => {
				const arr = Array.isArray(items) ? items : [items];
				return arr.map((json) => ({ json }));
			},
			httpRequestWithAuthentication: async (_credName: string, opts: IHttpRequestOptions) => {
				httpCalls.push(opts);
				if (typeof args.httpResponse === 'function') {
					return (args.httpResponse as (o: IHttpRequestOptions) => unknown)(opts);
				}
				if (args.httpResponse !== undefined) return args.httpResponse;
				return defaultChatResponse(args.body);
			},
		},
	} as unknown as IWebhookFunctions;

	return { ctx, response, httpCalls };
}
