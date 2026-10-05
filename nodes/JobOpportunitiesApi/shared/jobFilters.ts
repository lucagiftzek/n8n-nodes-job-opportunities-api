import type { IDataObject, IDisplayOptions, INodeProperties, INodePropertyOptions } from 'n8n-workflow';

export const CATEGORY_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Consulting & Strategy', value: 'Consulting & Strategy' },
	{ name: 'Construction & Trades', value: 'Construction & Trades' },
	{ name: 'Customer Support', value: 'Customer Support' },
	{ name: 'Data & Analytics', value: 'Data & Analytics' },
	{ name: 'Design', value: 'Design' },
	{ name: 'Education', value: 'Education' },
	{ name: 'Engineering', value: 'Engineering' },
	{ name: 'Finance', value: 'Finance' },
	{ name: 'Healthcare', value: 'Healthcare' },
	{ name: 'Hospitality', value: 'Hospitality' },
	{ name: 'HR & Recruiting', value: 'HR & Recruiting' },
	{ name: 'Legal & Compliance', value: 'Legal & Compliance' },
	{ name: 'Logistics & Transport', value: 'Logistics & Transport' },
	{ name: 'Manufacturing', value: 'Manufacturing' },
	{ name: 'Marketing', value: 'Marketing' },
	{ name: 'Operations & Admin', value: 'Operations & Admin' },
	{ name: 'Procurement', value: 'Procurement' },
	{ name: 'Product', value: 'Product' },
	{ name: 'Retail', value: 'Retail' },
	{ name: 'Safety & Environment', value: 'Safety & Environment' },
	{ name: 'Sales', value: 'Sales' },
	{ name: 'Science & Research', value: 'Science & Research' },
	{ name: 'Security', value: 'Security' },
	{ name: 'Skilled Technician', value: 'Skilled Technician' },
	{ name: 'Uncategorised', value: 'uncategorised' },
];

export const EMPLOYMENT_TYPE_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Contract', value: 'Contract' },
	{ name: 'Full-Time', value: 'Full-time' },
	{ name: 'Internship', value: 'Internship' },
	{ name: 'Not Stated', value: 'not_stated' },
	{ name: 'Part-Time', value: 'Part-time' },
	{ name: 'Temporary', value: 'Temporary' },
];

export const SENIORITY_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Director', value: 'Director' },
	{ name: 'Entry', value: 'Entry' },
	{ name: 'Executive', value: 'Executive' },
	{ name: 'Intern', value: 'Intern' },
	{ name: 'Lead', value: 'Lead' },
	{ name: 'Manager', value: 'Manager' },
	{ name: 'Mid', value: 'Mid' },
	{ name: 'Not Stated', value: 'not_stated' },
	{ name: 'Senior', value: 'Senior' },
];

export const REMOTE_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Hybrid', value: 'hybrid' },
	{ name: 'Not Stated', value: 'not_stated' },
	{ name: 'On-Site', value: 'on_site' },
	{ name: 'Remote', value: 'remote' },
];

export const SOURCE_TYPE_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Applicant Tracking System', value: 'ats' },
	{ name: 'Career Site', value: 'career_site' },
	{ name: 'Public Agency', value: 'public_agency' },
];

export const REQUIRE_FIELD_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Description', value: 'description' },
	{ name: 'Employment Type', value: 'employment_type' },
	{ name: 'Location', value: 'location' },
	{ name: 'Posted At', value: 'posted_at' },
	{ name: 'Remote', value: 'remote' },
	{ name: 'Salary', value: 'salary' },
	{ name: 'Source Type', value: 'source_type' },
];

export const CLOSED_REASON_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Deadline Passed', value: 'deadline_passed' },
	{ name: 'Employer Closed', value: 'employer_closed' },
	{ name: 'Expired Upstream', value: 'expired_upstream' },
	{ name: 'Not Seen', value: 'not_seen' },
];

/**
 * Search filters shared by the Job > Search operation and the "New Job Matching Search" trigger event.
 * The most common filters sit at the top level, the rest under "Additional Filters".
 */
export function jobFilterProperties(show: IDisplayOptions['show']): INodeProperties[] {
	const displayOptions: IDisplayOptions = { show };
	return [
		{
			displayName: 'Keywords',
			name: 'keywords',
			type: 'string',
			default: '',
			placeholder: 'e.g. data engineer',
			description:
				'Full-text search over job title, company name and location (not the job description)',
			displayOptions,
		},
		{
			displayName: 'Country',
			name: 'country',
			type: 'string',
			default: '',
			placeholder: 'e.g. DE,AT,CH',
			description: 'Two-letter ISO country codes, separated by commas',
			displayOptions,
		},
		{
			displayName: 'Remote',
			name: 'remote',
			type: 'multiOptions',
			options: REMOTE_OPTIONS,
			default: [],
			description: 'Workplace types to include. Leave empty for all.',
			displayOptions,
		},
		{
			displayName: 'Employment Type',
			name: 'employmentType',
			type: 'multiOptions',
			options: EMPLOYMENT_TYPE_OPTIONS,
			default: [],
			description: 'Employment types to include. Leave empty for all.',
			displayOptions,
		},
		{
			displayName: 'Seniority',
			name: 'seniority',
			type: 'multiOptions',
			options: SENIORITY_OPTIONS,
			default: [],
			description: 'Seniority levels to include. Leave empty for all.',
			displayOptions,
		},
		{
			displayName: 'Category',
			name: 'category',
			type: 'multiOptions',
			options: CATEGORY_OPTIONS,
			default: [],
			description: 'Job categories to include. Leave empty for all.',
			displayOptions,
		},
		{
			displayName: 'Company Slugs',
			name: 'company',
			type: 'string',
			default: '',
			placeholder: 'e.g. stripe,figma',
			description:
				'Company slugs, separated by commas. Use the Company > Search operation to find a slug.',
			displayOptions,
		},
		{
			displayName: 'Posted After',
			name: 'postedAfter',
			type: 'dateTime',
			default: '',
			description: 'Only return jobs posted after this date and time',
			displayOptions,
		},
		{
			displayName: 'Include Description',
			name: 'includeDescription',
			type: 'boolean',
			default: false,
			description:
				'Whether to include the full job description text. Descriptions make each record larger.',
			displayOptions,
		},
		{
			displayName: 'Additional Filters',
			name: 'additionalFilters',
			type: 'collection',
			placeholder: 'Add Filter',
			default: {},
			displayOptions,
			options: [
				{
					displayName: 'City',
					name: 'city',
					type: 'string',
					default: '',
					placeholder: 'e.g. Berlin',
				},
				{
					displayName: 'Company Domains',
					name: 'companyDomain',
					type: 'string',
					default: '',
					placeholder: 'e.g. stripe.com,figma.com',
					description: 'Bare company domains, separated by commas (no https:// and no path)',
				},
				{
					displayName: 'Description Contains',
					name: 'descriptionContains',
					type: 'string',
					default: '',
					placeholder: 'e.g. kubernetes',
					description:
						'Full-text search over the job description. Only matches jobs that have a description.',
				},
				{
					displayName: 'Exclude Categories',
					name: 'excludeCategory',
					type: 'multiOptions',
					options: CATEGORY_OPTIONS,
					default: [],
				},
				{
					displayName: 'Exclude Company Domains',
					name: 'excludeCompanyDomain',
					type: 'string',
					default: '',
					placeholder: 'e.g. example.com',
					description: 'Bare company domains to leave out, separated by commas',
				},
				{
					displayName: 'Exclude Countries',
					name: 'excludeCountry',
					type: 'string',
					default: '',
					placeholder: 'e.g. US,GB',
					description: 'Two-letter ISO country codes to leave out, separated by commas',
				},
				{
					displayName: 'Exclude Providers',
					name: 'excludeProvider',
					type: 'string',
					default: '',
					placeholder: 'e.g. workday',
					description: 'Source systems to leave out, separated by commas',
				},
				{
					displayName: 'Has Description',
					name: 'hasDescription',
					type: 'boolean',
					default: false,
					description: 'Whether to return only jobs that carry a description',
				},
				{
					displayName: 'Has Salary',
					name: 'hasSalary',
					type: 'options',
					options: [
						{
							name: 'Any',
							value: 'any',
							description: 'Return jobs with or without salary information',
						},
						{
							name: 'Published by Employer',
							value: 'true',
							description: 'Only jobs whose salary the employer published',
						},
						{
							name: 'Structured Salary',
							value: 'structured',
							description: 'Only jobs with a structured, published salary',
						},
					],
					default: 'any',
				},
				{
					displayName: 'Maximum Salary (EUR per Year)',
					name: 'maxSalary',
					type: 'number',
					typeOptions: { minValue: 0 },
					default: 0,
					description:
						'Upper bound on the annual salary in EUR. Only matches jobs with a structured salary. 0 means no bound.',
				},
				{
					displayName: 'Minimum Salary (EUR per Year)',
					name: 'minSalary',
					type: 'number',
					typeOptions: { minValue: 0 },
					default: 0,
					description:
						'Lower bound on the annual salary in EUR. Only matches jobs with a structured salary. 0 means no bound.',
				},
				{
					displayName: 'Providers',
					name: 'provider',
					type: 'string',
					default: '',
					placeholder: 'e.g. greenhouse,lever,workday',
					description: 'Source systems (applicant tracking systems or sites) to include, separated by commas',
				},
				{
					displayName: 'Remote Confirmed by Employer',
					name: 'remoteConfirmed',
					type: 'boolean',
					default: false,
					description: 'Whether to return only jobs whose remote status the employer stated',
				},
				{
					displayName: 'Require Published Fields',
					name: 'requireFields',
					type: 'multiOptions',
					options: REQUIRE_FIELD_OPTIONS,
					default: [],
					description: 'Only return jobs where every selected field was published by the employer',
				},
				{
					displayName: 'Source Types',
					name: 'sourceType',
					type: 'multiOptions',
					options: SOURCE_TYPE_OPTIONS,
					default: [],
				},
				{
					displayName: 'State (US)',
					name: 'state',
					type: 'string',
					default: '',
					placeholder: 'e.g. OH,TX',
					description: 'Two-letter US state codes, separated by commas',
				},
				{
					displayName: 'Status',
					name: 'status',
					type: 'options',
					options: [
						{ name: 'Any', value: 'any', description: 'Open and closed jobs' },
						{ name: 'Closed', value: 'closed', description: 'Only jobs that have closed' },
						{ name: 'Live', value: 'live', description: 'Only open jobs' },
					],
					default: 'live',
				},
				{
					displayName: 'Title',
					name: 'title',
					type: 'string',
					default: '',
					placeholder: 'e.g. engineer',
					description: 'Full-text search over the job title only',
				},
				{
					displayName: 'Title Excludes',
					name: 'titleExclude',
					type: 'string',
					default: '',
					placeholder: 'e.g. intern',
					description: 'Leave out jobs whose title matches these words',
				},
				{
					displayName: 'Verified After',
					name: 'verifiedAfter',
					type: 'dateTime',
					default: '',
					description: 'Only return jobs re-confirmed at their source after this date and time',
				},
			],
		},
	];
}

/** Convert an n8n date/time value to an RFC 3339 timestamp the API accepts. */
export function toApiDate(value: unknown): string | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	const text = String(value).trim();
	if (text === '') return undefined;
	if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
	const parsed = Date.parse(text);
	return Number.isNaN(parsed) ? text : new Date(parsed).toISOString();
}

function list(value: unknown, upper = false): string | undefined {
	const items = (Array.isArray(value) ? value.map(String) : String(value ?? '').split(','))
		.map((entry) => entry.trim())
		.filter((entry) => entry !== '')
		.map((entry) => (upper ? entry.toUpperCase() : entry));
	return items.length ? items.join(',') : undefined;
}

export type ParameterGetter = (name: string, fallback: unknown) => unknown;

/** Build the GET /v1/jobs query string from the node's filter parameters. */
export function buildJobSearchQuery(get: ParameterGetter): IDataObject {
	const extra = (get('additionalFilters', {}) ?? {}) as IDataObject;
	const qs: IDataObject = {
		q: String(get('keywords', '') ?? '').trim() || undefined,
		country: list(get('country', ''), true),
		remote: list(get('remote', [])),
		employment_type: list(get('employmentType', [])),
		seniority: list(get('seniority', [])),
		category: list(get('category', [])),
		company: list(get('company', '')),
		posted_after: toApiDate(get('postedAfter', '')),
		include_description: get('includeDescription', false) === true ? true : undefined,

		city: list(extra.city),
		company_domain: list(extra.companyDomain),
		description_contains: String(extra.descriptionContains ?? '').trim() || undefined,
		exclude_category: list(extra.excludeCategory),
		exclude_company_domain: list(extra.excludeCompanyDomain),
		exclude_country: list(extra.excludeCountry, true),
		exclude_provider: list(extra.excludeProvider),
		has_description: extra.hasDescription === true ? true : undefined,
		has_salary: extra.hasSalary && extra.hasSalary !== 'any' ? extra.hasSalary : undefined,
		max_salary: Number(extra.maxSalary) > 0 ? Number(extra.maxSalary) : undefined,
		min_salary: Number(extra.minSalary) > 0 ? Number(extra.minSalary) : undefined,
		provider: list(extra.provider),
		remote_confirmed: extra.remoteConfirmed === true ? true : undefined,
		require_fields: list(extra.requireFields),
		source_type: list(extra.sourceType),
		state: list(extra.state, true),
		status: extra.status && extra.status !== 'live' ? extra.status : undefined,
		title: String(extra.title ?? '').trim() || undefined,
		title_exclude: String(extra.titleExclude ?? '').trim() || undefined,
		verified_after: toApiDate(extra.verifiedAfter),
	};
	for (const key of Object.keys(qs)) if (qs[key] === undefined) delete qs[key];
	return qs;
}

/**
 * A compact job record with at most 10 fields. The attribution and canonical link are kept
 * whenever JOA returns them, because they must be shown with the listing.
 */
export function simplifyJob(job: IDataObject): IDataObject {
	const simple: IDataObject = {
		id: job.id,
		title: job.title,
		company: job.company,
		location: job.location,
		remote: job.remote,
		employment_type: job.employment_type ?? null,
		posted_at: job.posted_at ?? null,
		apply_url: job.apply_url,
	};
	if (job.attribution !== undefined && job.attribution !== null) simple.attribution = job.attribution;
	if (job.canonical_url !== undefined && job.canonical_url !== null) simple.canonical_url = job.canonical_url;
	return simple;
}
