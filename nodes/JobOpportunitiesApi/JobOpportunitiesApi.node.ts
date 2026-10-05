import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { accountOperations } from './descriptions/AccountDescription';
import { companyFields, companyOperations } from './descriptions/CompanyDescription';
import { jobFields, jobOperations } from './descriptions/JobDescription';
import { buildJobSearchQuery, simplifyJob, toApiDate } from './shared/jobFilters';
import { joaApiRequest, joaApiRequestAllItems, toNodeError } from './shared/transport';

/*
 * Programmatic style (not declarative) because the node needs: cursor pagination that stops
 * exactly at "Limit" across pages the API may cap per key, per-status error messages
 * (401/403/429 with Retry-After), and output unwrapping/simplifying that stays unit-testable.
 */
export class JobOpportunitiesApi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Job Opportunities API',
		name: 'jobOpportunitiesApi',
		icon: { light: 'file:../../icons/joa.svg', dark: 'file:../../icons/joa.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Search employer-direct job postings and companies from the Job Opportunities API (JOA)',
		defaults: {
			name: 'Job Opportunities API',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'jobOpportunitiesApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Account', value: 'account' },
					{ name: 'Company', value: 'company' },
					{ name: 'Job', value: 'job' },
				],
				default: 'job',
			},
			...jobOperations,
			...jobFields,
			...companyOperations,
			...companyFields,
			...accountOperations,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const results = await runOperation.call(this, resource, operation, i);
				for (const json of results) {
					returnData.push({ json, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw toNodeError(this.getNode(), error, i);
			}
		}

		return [returnData];
	}
}

function limitFor(this: IExecuteFunctions, i: number): number | undefined {
	const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
	return returnAll ? undefined : (this.getNodeParameter('limit', i, 50) as number);
}

export async function runOperation(
	this: IExecuteFunctions,
	resource: string,
	operation: string,
	i: number,
): Promise<IDataObject[]> {
	if (resource === 'job') {
		const simplify = this.getNodeParameter('simplify', i, false) as boolean;
		const shape = (job: IDataObject) => (simplify ? simplifyJob(job) : job);

		if (operation === 'search') {
			const qs = buildJobSearchQuery((name, fallback) => this.getNodeParameter(name, i, fallback));
			const jobs = await joaApiRequestAllItems.call(this, '/v1/jobs', qs, limitFor.call(this, i), i);
			return jobs.map(shape);
		}

		if (operation === 'get') {
			const jobId = String(this.getNodeParameter('jobId', i)).trim();
			if (jobId === '') {
				throw new NodeOperationError(this.getNode(), 'Job ID or Slug must not be empty', {
					itemIndex: i,
				});
			}
			const includeClosed = this.getNodeParameter('includeClosed', i, false) as boolean;
			const response = await joaApiRequest.call(
				this,
				'GET',
				`/v1/jobs/${encodeURIComponent(jobId)}`,
				includeClosed ? { include_closed: true } : {},
				i,
			);
			const job = { ...((response.data as IDataObject) ?? {}) };
			if (response.description !== undefined) job.description = response.description;
			return [shape(job)];
		}

		if (operation === 'getClosed') {
			const filters = this.getNodeParameter('closedFilters', i, {}) as IDataObject;
			const qs: IDataObject = {
				closed_after: toApiDate(this.getNodeParameter('closedAfter', i, '')),
				closed_before: toApiDate(this.getNodeParameter('closedBefore', i, '')),
				closed_reason: filters.closedReason,
				company: filters.company,
				country: typeof filters.country === 'string' ? filters.country.toUpperCase() : undefined,
			};
			const jobs = await joaApiRequestAllItems.call(
				this,
				'/v1/jobs/closed',
				qs,
				limitFor.call(this, i),
				i,
			);
			return jobs.map(shape);
		}
	}

	if (resource === 'company') {
		if (operation === 'search') {
			const country = String(this.getNodeParameter('country', i, '')).trim().toUpperCase();
			const qs: IDataObject = {
				q: String(this.getNodeParameter('query', i, '')).trim(),
				country,
			};
			return await joaApiRequestAllItems.call(this, '/v1/companies', qs, limitFor.call(this, i), i);
		}

		if (operation === 'get') {
			const slug = String(this.getNodeParameter('companySlug', i)).trim();
			if (slug === '') {
				throw new NodeOperationError(this.getNode(), 'Company Slug must not be empty', {
					itemIndex: i,
				});
			}
			const response = await joaApiRequest.call(
				this,
				'GET',
				`/v1/companies/${encodeURIComponent(slug)}`,
				{},
				i,
			);
			return [(response.data as IDataObject) ?? response];
		}
	}

	if (resource === 'account' && operation === 'getPlan') {
		return [await joaApiRequest.call(this, 'GET', '/v1/me', {}, i)];
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for resource "${resource}"`,
		{ itemIndex: i },
	);
}
