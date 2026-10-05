import type {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { buildJobSearchQuery, jobFilterProperties } from '../JobOpportunitiesApi/shared/jobFilters';
import { joaApiRequest, joaApiRequestAllItems } from '../JobOpportunitiesApi/shared/transport';

/** How many job ids the "New Job Matching Search" event remembers to avoid emitting a job twice. */
export const SEEN_IDS_CAP = 2000;
/** How many sample items a manual test ("Fetch Test Event") returns. */
export const SAMPLE_SIZE = 5;
export const MAX_JOBS_PER_POLL = 50;

export const CHANGE_TYPES = ['created', 'updated', 'withdrawn', 'delisted'] as const;

interface NewJobState extends IDataObject {
	lastPollAt?: string;
	seenIds?: string[];
}

interface CursorState extends IDataObject {
	cursor?: string;
}

function isTestRun(this: IPollFunctions): boolean {
	const mode = this.getMode();
	return mode === 'manual' || mode === 'cli';
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
	const n = Math.floor(Number(value));
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, n));
}

export class JobOpportunitiesApiTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Job Opportunities API Trigger',
		name: 'jobOpportunitiesApiTrigger',
		icon: { light: 'file:../../icons/joa.svg', dark: 'file:../../icons/joa.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description:
			'Starts the workflow when new jobs match a search, or when jobs change or close in the Job Opportunities API (JOA)',
		defaults: {
			name: 'Job Opportunities API Trigger',
		},
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'jobOpportunitiesApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Job Change (Change Feed)',
						value: 'jobChange',
						description:
							'Each job created, updated, withdrawn or delisted, in change order. Needs the Growth plan or above.',
					},
					{
						name: 'Job Closed',
						value: 'jobClosed',
						description:
							'The ID, closing time and reason of each job that closes. Needs the Growth plan or above.',
					},
					{
						name: 'New Job Matching Search',
						value: 'newJob',
						description: 'New jobs that match your filters. Works on every plan.',
					},
				],
				default: 'newJob',
			},
			{
				displayName:
					'This event uses an endpoint available on the Growth plan and above. On other plans each poll fails with a plan error.',
				name: 'growthNotice',
				type: 'notice',
				default: '',
				displayOptions: { show: { event: ['jobChange', 'jobClosed'] } },
			},
			...jobFilterProperties({ event: ['newJob'] }),
			{
				displayName: 'Max Jobs per Poll',
				name: 'maxJobs',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: MAX_JOBS_PER_POLL },
				default: 20,
				description:
					'Max number of newest matching jobs to check on each poll (up to 50). Every job returned counts towards your monthly record allowance.',
				displayOptions: { show: { event: ['newJob'] } },
			},
			{
				displayName: 'Change Types',
				name: 'changeTypes',
				type: 'multiOptions',
				options: [
					{ name: 'Created', value: 'created' },
					{ name: 'Delisted', value: 'delisted' },
					{ name: 'Updated', value: 'updated' },
					{ name: 'Withdrawn', value: 'withdrawn' },
				],
				default: [],
				description:
					'Which changes start the workflow. Leave empty for all. Treat withdrawn like delisted: stop showing the job.',
				displayOptions: { show: { event: ['jobChange'] } },
			},
			{
				displayName: 'Max Changes per Poll',
				name: 'maxChanges',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 5000 },
				default: 100,
				description:
					'Max number of changes to read on each poll. The rest are picked up on the next poll.',
				displayOptions: { show: { event: ['jobChange'] } },
			},
			{
				displayName: 'Max Closed Jobs per Poll',
				name: 'maxClosed',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 10000 },
				default: 100,
				description:
					'Max number of closed jobs to read on each poll. The rest are picked up on the next poll.',
				displayOptions: { show: { event: ['jobClosed'] } },
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { event: ['newJob'] } },
				options: [
					{
						displayName: 'Overlap (Minutes)',
						name: 'overlapMinutes',
						type: 'number',
						typeOptions: { minValue: 0, maxValue: 10080 },
						default: 60,
						description:
							'How far before the previous poll to look again, so that jobs indexed late are not missed. Jobs already emitted are never emitted twice.',
					},
				],
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const event = this.getNodeParameter('event') as string;
		const staticData = this.getWorkflowStaticData('node');
		let items: IDataObject[] | null;

		if (event === 'jobChange') items = await pollChanges.call(this, staticData);
		else if (event === 'jobClosed') items = await pollClosed.call(this, staticData);
		else items = await pollNewJobs.call(this, staticData, new Date());

		if (!items || items.length === 0) return null;
		return [this.helpers.returnJsonArray(items)];
	}
}

export async function pollNewJobs(
	this: IPollFunctions,
	staticData: IDataObject,
	now: Date,
): Promise<IDataObject[] | null> {
	const query = buildJobSearchQuery((name, fallback) => this.getNodeParameter(name, fallback));
	const maxJobs = clamp(this.getNodeParameter('maxJobs', 20), 1, MAX_JOBS_PER_POLL, 20);
	const options = this.getNodeParameter('options', {}) as IDataObject;
	const overlapMs = clamp(options.overlapMinutes ?? 60, 0, 10080, 60) * 60_000;

	if (isTestRun.call(this)) {
		// Manual test: show the latest few matching jobs as sample data, change no state.
		return await joaApiRequestAllItems.call(this, '/v1/jobs', query, Math.min(maxJobs, SAMPLE_SIZE));
	}

	const state = (staticData.newJob ?? {}) as NewJobState;
	const seen = new Set(state.seenIds ?? []);
	const userPostedAfter = typeof query.posted_after === 'string' ? Date.parse(query.posted_after) : NaN;

	const lastPoll = state.lastPollAt ? Date.parse(state.lastPollAt) : NaN;
	const windowStart = Number.isNaN(lastPoll) ? now.getTime() - overlapMs : lastPoll - overlapMs;
	const since = Number.isNaN(userPostedAfter) ? windowStart : Math.max(windowStart, userPostedAfter);

	const jobs = await joaApiRequestAllItems.call(
		this,
		'/v1/jobs',
		{ ...query, posted_after: new Date(since).toISOString() },
		maxJobs,
	);

	const fresh = jobs.filter((job) => typeof job.id === 'string' && !seen.has(job.id));
	const isFirstPoll = Number.isNaN(lastPoll);

	staticData.newJob = {
		lastPollAt: now.toISOString(),
		seenIds: [...fresh.map((job) => job.id as string), ...(state.seenIds ?? [])].slice(
			0,
			SEEN_IDS_CAP,
		),
	} as NewJobState;

	// First poll after activation only records what already exists, so nothing old is emitted.
	if (isFirstPoll) return null;
	return fresh;
}

async function pollFeed(
	this: IPollFunctions,
	staticData: IDataObject,
	stateKey: 'jobChange' | 'jobClosed',
	endpoint: string,
	limit: number,
): Promise<IDataObject[] | null> {
	if (isTestRun.call(this)) {
		// Manual test: the last hour of the feed as sample data, change no state.
		const since = new Date(Date.now() - 60 * 60_000).toISOString();
		const response = await joaApiRequest.call(this, 'GET', endpoint, {
			since,
			limit: Math.min(limit, SAMPLE_SIZE),
		});
		return Array.isArray(response.data) ? (response.data as IDataObject[]) : [];
	}

	const state = (staticData[stateKey] ?? {}) as CursorState;
	if (!state.cursor) {
		// First poll after activation: start the feed from now, emit nothing.
		staticData[stateKey] = { cursor: new Date().toISOString() } as CursorState;
		return null;
	}

	const response = await joaApiRequest.call(this, 'GET', endpoint, {
		since: state.cursor,
		limit,
	});
	if (typeof response.next_since === 'string' && response.next_since !== '') {
		staticData[stateKey] = { cursor: response.next_since } as CursorState;
	}
	return Array.isArray(response.data) ? (response.data as IDataObject[]) : [];
}

export async function pollChanges(
	this: IPollFunctions,
	staticData: IDataObject,
): Promise<IDataObject[] | null> {
	const limit = clamp(this.getNodeParameter('maxChanges', 100), 1, 5000, 100);
	const wanted = (this.getNodeParameter('changeTypes', []) as string[]) ?? [];
	const rows = await pollFeed.call(this, staticData, 'jobChange', '/v1/changes', limit);
	if (!rows) return null;
	return rows
		.filter((row) => wanted.length === 0 || wanted.includes(String(row.change)))
		.map((row) => ({
			change: row.change,
			job: row.job,
			removed: row.change === 'withdrawn' || row.change === 'delisted',
		}));
}

export async function pollClosed(
	this: IPollFunctions,
	staticData: IDataObject,
): Promise<IDataObject[] | null> {
	const limit = clamp(this.getNodeParameter('maxClosed', 100), 1, 10000, 100);
	const rows = await pollFeed.call(this, staticData, 'jobClosed', '/v1/jobs/expired', limit);
	if (!rows) return null;
	return rows.map((row) => ({
		id: row.id,
		closed_at: row.closed_at,
		closed_reason: row.closed_reason,
	}));
}
