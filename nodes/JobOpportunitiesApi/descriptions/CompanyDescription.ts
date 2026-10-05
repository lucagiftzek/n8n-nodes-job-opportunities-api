import type { INodeProperties } from 'n8n-workflow';

const showFor = (operation: string[]) => ({ show: { resource: ['company'], operation } });

export const companyOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['company'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a company (employer) by its slug',
				action: 'Get company',
			},
			{
				name: 'Search',
				value: 'search',
				description: 'Search the employers whose live jobs JOA returns',
				action: 'Search companies',
			},
		],
		default: 'search',
	},
];

export const companyFields: INodeProperties[] = [
	/* company:get */
	{
		displayName: 'Company Slug',
		name: 'companySlug',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. stripe',
		description: 'The company slug, as returned in the company_slug field of a job',
		displayOptions: showFor(['get']),
	},

	/* company:search */
	{
		displayName: 'Search Term',
		name: 'query',
		type: 'string',
		default: '',
		placeholder: 'e.g. stripe',
		description: 'Text to search for in company names',
		displayOptions: showFor(['search']),
	},
	{
		displayName: 'Country',
		name: 'country',
		type: 'string',
		default: '',
		placeholder: 'e.g. DE',
		description: 'Two-letter ISO country code',
		displayOptions: showFor(['search']),
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: showFor(['search']),
		default: false,
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		displayOptions: { show: { resource: ['company'], operation: ['search'], returnAll: [false] } },
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
	},
];
