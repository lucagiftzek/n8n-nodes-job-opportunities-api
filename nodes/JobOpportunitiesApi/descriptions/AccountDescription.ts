import type { INodeProperties } from 'n8n-workflow';

export const accountOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['account'] } },
		options: [
			{
				name: 'Get Plan and Quota',
				value: 'getPlan',
				description: 'Retrieve the plan, limits and usage of your API key',
				action: 'Get account plan and quota',
			},
		],
		default: 'getPlan',
	},
];
