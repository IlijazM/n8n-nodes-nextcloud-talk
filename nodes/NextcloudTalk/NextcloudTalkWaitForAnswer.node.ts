import {
	NodeConnectionTypes,
	WAIT_INDEFINITELY,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookFunctions,
	type IWebhookResponseData,
} from 'n8n-workflow';

/**
 * Nextcloud Talk — Wait For Answer
 *
 * Second half of the human-in-the-loop gate. It pauses the (sub-)workflow until the user
 * answers the prompt sent by the "Nextcloud Talk Ask" node, then routes to the matching
 * output. Because it is used inside a sub-workflow invoked as an AI-agent tool, the agent's
 * tool call blocks here until the human responds — the confirmation is structural, not a
 * matter of the model's discretion.
 *
 * Resume mechanism (n8n native): execute() calls putExecutionToWait() and returns the
 * Timeout branch as the default output. The Filter workflow, having detected the user's
 * reaction/reply/vote and looked up the stored resume URL, POSTs the answer to that URL;
 * n8n then invokes webhook() whose returned data OVERRIDES the default output and resumes
 * the workflow on the correct branch. If the wait expires first, the Timeout branch fires.
 *
 * Outputs depend on the operation:
 *   approval -> [Approved, Rejected, Timeout]
 *   poll/question -> [Answered, Timeout]
 *
 * The Filter should POST a JSON body to the resume URL, e.g.:
 *   approval -> { "approved": true }   (or false)
 *   question -> { "answer": "next tuesday" }
 *   poll     -> { "optionIds": [1], "answer": "..." }
 */
export class NextcloudTalkWaitForAnswer implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nextcloud Talk Wait For Answer',
		name: 'nextcloudTalkWaitForAnswer',
		icon: { light: 'file:../../icons/nextcloud.svg', dark: 'file:../../icons/nextcloud.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description:
			'Pause the workflow until the user answers a Nextcloud Talk prompt, then route to Approved / Rejected / Answered or Timeout',
		defaults: { name: 'Nextcloud Talk Wait For Answer' },
		inputs: [NodeConnectionTypes.Main],
		// Dynamic outputs based on the operation.
		outputs:
			'={{ $parameter["operation"] === "approval" ? [{ "type": "main", "displayName": "Approved" }, { "type": "main", "displayName": "Rejected" }, { "type": "main", "displayName": "Timeout" }] : [{ "type": "main", "displayName": "Answered" }, { "type": "main", "displayName": "Timeout" }] }}',
		credentials: [{ name: 'nextcloudApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: '={{ $nodeId }}',
				restartWebhook: true,
				isFullPath: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				description: 'Must match the operation used in the preceding "Nextcloud Talk Ask" node',
				options: [
					{ name: 'Approval', value: 'approval' },
					{ name: 'Poll', value: 'poll' },
					{ name: 'Question', value: 'question' },
				],
				default: 'approval',
			},
			{
				displayName: 'Timeout (Minutes)',
				name: 'timeoutMinutes',
				type: 'number',
				default: 0,
				description:
					'How long to wait for an answer before routing to the Timeout output. Use 0 to wait indefinitely.',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const operation = this.getNodeParameter('operation', 0) as string;
		const timeoutMinutes = this.getNodeParameter('timeoutMinutes', 0) as number;
		const items = this.getInputData();

		const waitTill =
			timeoutMinutes > 0
				? new Date(Date.now() + timeoutMinutes * 60 * 1000)
				: WAIT_INDEFINITELY;

		await this.putExecutionToWait(waitTill);

		// Reached only on time-based resume (the webhook path overrides this). Emit the
		// pass-through item on the Timeout output (last slot for both output shapes).
		const timeoutItem: INodeExecutionData[] = items.map((item) => ({
			json: { ...item.json, answered: false, timedOut: true },
			pairedItem: item.pairedItem,
		}));

		return operation === 'approval'
			? [[], [], timeoutItem]
			: [[], timeoutItem];
	}

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const operation = this.getNodeParameter('operation', 0) as string;
		const body = (this.getBodyData() ?? {}) as IDataObject;

		const payload: IDataObject = { ...body, answered: true, timedOut: false };

		let workflowData: INodeExecutionData[][];

		if (operation === 'approval') {
			const approved = body.approved === true || body.approved === 'true';
			workflowData = approved
				? [[{ json: { ...payload, approved: true } }], [], []]
				: [[], [{ json: { ...payload, approved: false } }], []];
		} else {
			workflowData = [[{ json: payload }], []];
		}

		return { workflowData, webhookResponse: { ok: true } };
	}
}
