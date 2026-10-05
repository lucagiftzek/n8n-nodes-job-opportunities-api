import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class JobOpportunitiesApi implements ICredentialType {
	name = 'jobOpportunitiesApi';

	displayName = 'Job Opportunities API';

	icon: Icon = { light: 'file:../icons/joa.svg', dark: 'file:../icons/joa.dark.svg' };

	documentationUrl = 'https://jobopportunitiesapi.org/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'Your Job Opportunities API (JOA) key. Get a free key (no card required) at https://jobopportunitiesapi.org/register.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			required: true,
			default: 'https://api.jobopportunitiesapi.org',
			description: 'Leave this unchanged unless JOA support has given you a different API address',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}',
			url: '/v1/me',
			method: 'GET',
		},
	};
}
