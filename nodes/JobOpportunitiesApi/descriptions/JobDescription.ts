import type { INodeProperties } from 'n8n-workflow';
import { CLOSED_REASON_OPTIONS, jobFilterProperties } from '../shared/jobFilters';

const showFor = (operation: string[]) => ({ show: { resource: ['job'], operation } });

export const jobOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['job'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a job by its ID or slug, including its description',
				action: 'Get job',
			},
			{
				name: 'Get Closed',
				value: 'getClosed',
				description: 'Retrieve jobs that have closed, most recently closed first',
				action: 'Get closed jobs',
			},
			{
				name: 'Search',
				value: 'search',
				description: 'Search live employer-direct jobs with filters, newest first',
				action: 'Search jobs',
			},
		],
		default: 'search',
	},
];

const returnAllAndLimit = (operation: string[]): INodeProperties[] => [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: showFor(operation),
		default: false,
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		displayOptions: { show: { resource: ['job'], operation, returnAll: [false] } },
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
	},
	{
		displayName:
			'Every job returned counts towards your monthly record allowance. Use filters with Return All.',
		name: 'returnAllNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { resource: ['job'], operation, returnAll: [true] } },
	},
];

const simplify = (operation: string[]): INodeProperties => ({
	displayName: 'Simplify',
	name: 'simplify',
	type: 'boolean',
	displayOptions: showFor(operation),
	default: false,
	description: 'Whether to return a simplified version of the response instead of the raw data',
});

export const jobFields: INodeProperties[] = [
	/* job:get */
	{
		displayName: 'Job ID or Slug',
		name: 'jobId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. c19c614c-4f48-4f31-b910-25e1d924f05e',
		description: 'The job ID (UUID) or its public slug',
		displayOptions: showFor(['get']),
	},
	{
		displayName: 'Include Closed',
		name: 'includeClosed',
		type: 'boolean',
		default: false,
		description:
			'Whether to return the job even if it has closed (it then has status "closed") instead of a not found error',
		displayOptions: showFor(['get']),
	},
	simplify(['get']),

	/* job:search */
	...jobFilterProperties({ resource: ['job'], operation: ['search'] }),
	...returnAllAndLimit(['search']),
	simplify(['search']),

	/* job:getClosed */
	{
		displayName: 'Closed After',
		name: 'closedAfter',
		type: 'dateTime',
		default: '',
		description: 'Only return jobs that closed after this date and time',
		displayOptions: showFor(['getClosed']),
	},
	{
		displayName: 'Closed Before',
		name: 'closedBefore',
		type: 'dateTime',
		default: '',
		description: 'Only return jobs that closed before this date and time',
		displayOptions: showFor(['getClosed']),
	},
	{
		displayName: 'Additional Filters',
		name: 'closedFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: showFor(['getClosed']),
		options: [
			{
				displayName: 'Closed Reason',
				name: 'closedReason',
				type: 'options',
				options: CLOSED_REASON_OPTIONS,
				default: 'expired_upstream',
				description: 'Only return jobs that closed for this reason',
			},
			{
				displayName: 'Company Slugs',
				name: 'company',
				type: 'string',
				default: '',
				placeholder: 'e.g. stripe,figma',
				description: 'Company slugs, separated by commas',
			},
			{
				displayName: 'Country',
				name: 'country',
				type: 'string',
				default: '',
				placeholder: 'e.g. DE,AT',
				description: 'Two-letter ISO country codes, separated by commas',
			},
		],
	},
	...returnAllAndLimit(['getClosed']),
	simplify(['getClosed']),
];
