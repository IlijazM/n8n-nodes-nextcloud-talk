import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class NextcloudApi implements ICredentialType {
	name = 'nextcloudApi';

	displayName = 'Nextcloud API';

	icon: Icon = { light: 'file:../icons/nextcloud.svg', dark: 'file:../icons/nextcloud.dark.svg' };

	documentationUrl = 'https://docs.nextcloud.com/server/latest/developer_manual/client_apis/';

	properties: INodeProperties[] = [
		{
			displayName: 'Server URL',
			name: 'serverUrl',
			type: 'string',
			default: '',
			placeholder: 'https://cloud.example.com',
			description: 'The URL of your Nextcloud instance',
			required: true,
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			required: true,
		},
		{
			displayName: 'App Password',
			name: 'appPassword',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'App password generated in Nextcloud under User Settings → Security → App passwords',
			required: true,
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			auth: {
				username: '={{$credentials.username}}',
				password: '={{$credentials.appPassword}}',
			},
			headers: {
				'OCS-APIRequest': 'true',
				'Content-Type': 'application/json',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.serverUrl}}',
			url: '/ocs/v2.php/apps/spreed/api/v4/room',
			method: 'GET',
		},
	};
}
