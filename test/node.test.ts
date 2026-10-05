import { describe, expect, it } from 'vitest';

import { JobOpportunitiesApi } from '../nodes/JobOpportunitiesApi/JobOpportunitiesApi.node';
import { executeContext, job, page, sequence } from './helpers';

const node = new JobOpportunitiesApi();
const run = (ctx: unknown) => node.execute.call(ctx as never);

describe('JobOpportunitiesApi node description', () => {
	it('is usable as an AI tool and uses the JOA credential', () => {
		expect(node.description.usableAsTool).toBe(true);
		expect(node.description.credentials).toEqual([{ name: 'jobOpportunitiesApi', required: true }]);
	});
});

describe('Job > Search', () => {
	it('sends the filters, paginates and outputs one item per job', async () => {
		const { ctx, http } = executeContext({
			params: {
				resource: 'job',
				operation: 'search',
				country: 'DE',
				remote: ['remote'],
				returnAll: false,
				limit: 3,
			},
			responder: sequence(page(['a', 'b'], 'c1', true), page(['c', 'd'], 'c2', true)),
		});
		const [out] = await run(ctx);
		expect(out.map((item) => item.json.id)).toEqual(['a', 'b', 'c']);
		expect(out.every((item) => (item.pairedItem as { item: number }).item === 0)).toBe(true);
		expect(http.mock.calls[0][1].url).toBe('https://api.example.test/v1/jobs');
		expect(http.mock.calls[0][1].qs).toEqual({ country: 'DE', remote: 'remote', limit: 3 });
		expect(http.mock.calls[1][1].qs).toEqual({ country: 'DE', remote: 'remote', limit: 1, cursor: 'c1' });
	});

	it('returns simplified jobs when Simplify is on', async () => {
		const { ctx } = executeContext({
			params: { resource: 'job', operation: 'search', limit: 1, simplify: true },
			responder: sequence(page(['a'], null, false)),
		});
		const [out] = await run(ctx);
		expect(Object.keys(out[0].json)).not.toContain('seniority');
		expect(out[0].json.apply_url).toBe('https://jobs.example.test/a');
	});

	it('runs once per input item', async () => {
		const { ctx, http } = executeContext({
			params: { resource: 'job', operation: 'search', limit: 1 },
			responder: sequence(page(['a'], null, false)),
			items: 2,
		});
		const [out] = await run(ctx);
		expect(out).toHaveLength(2);
		expect(http).toHaveBeenCalledTimes(2);
		expect(out[1].pairedItem).toEqual({ item: 1 });
	});
});

describe('Job > Get', () => {
	it('requests the job by id, merges the description and honours Include Closed', async () => {
		const { ctx, http } = executeContext({
			params: { resource: 'job', operation: 'get', jobId: ' some slug/1 ', includeClosed: true },
			responder: sequence({ body: { data: job('x'), description: 'Line 1\nLine 2' } }),
		});
		const [out] = await run(ctx);
		expect(http.mock.calls[0][1].url).toBe('https://api.example.test/v1/jobs/some%20slug%2F1');
		expect(http.mock.calls[0][1].qs).toEqual({ include_closed: true });
		expect(out).toHaveLength(1);
		expect(out[0].json.id).toBe('x');
		expect(out[0].json.description).toBe('Line 1\nLine 2');
	});

	it('reports a not found job with the API message', async () => {
		const { ctx } = executeContext({
			params: { resource: 'job', operation: 'get', jobId: 'nope' },
			responder: sequence({ statusCode: 404, body: { error: 'not_found', message: 'No listing with that id.' } }),
		});
		await expect(run(ctx)).rejects.toThrow('No listing with that id.');
	});
});

describe('Job > Get Closed', () => {
	it('maps the closed filters', async () => {
		const { ctx, http } = executeContext({
			params: {
				resource: 'job',
				operation: 'getClosed',
				closedAfter: '2026-10-01T00:00:00.000Z',
				closedBefore: '',
				closedFilters: { closedReason: 'employer_closed', country: 'de' },
				limit: 2,
			},
			responder: sequence(page(['a', 'b'], 'c', true)),
		});
		const [out] = await run(ctx);
		expect(out).toHaveLength(2);
		expect(http.mock.calls[0][1].url).toBe('https://api.example.test/v1/jobs/closed');
		expect(http.mock.calls[0][1].qs).toEqual({
			closed_after: '2026-10-01T00:00:00.000Z',
			closed_reason: 'employer_closed',
			country: 'DE',
			limit: 2,
		});
	});
});

describe('Company', () => {
	it('searches companies with Return All following the cursor', async () => {
		const { ctx, http } = executeContext({
			params: { resource: 'company', operation: 'search', query: 'stripe', country: 'us', returnAll: true },
			responder: sequence(
				{ body: { data: [{ slug: 's1' }], next_cursor: 'n1', has_more: true } },
				{ body: { data: [{ slug: 's2' }], next_cursor: null, has_more: false } },
			),
		});
		const [out] = await run(ctx);
		expect(out.map((item) => item.json.slug)).toEqual(['s1', 's2']);
		expect(http.mock.calls[0][1].qs).toEqual({ q: 'stripe', country: 'US', limit: 100 });
		expect(http.mock.calls[1][1].qs).toEqual({ q: 'stripe', country: 'US', limit: 100, cursor: 'n1' });
	});

	it('gets one company by slug and unwraps data', async () => {
		const { ctx, http } = executeContext({
			params: { resource: 'company', operation: 'get', companySlug: 'stripe' },
			responder: sequence({ body: { data: { slug: 'stripe', name: 'Stripe' } } }),
		});
		const [out] = await run(ctx);
		expect(http.mock.calls[0][1].url).toBe('https://api.example.test/v1/companies/stripe');
		expect(out[0].json).toEqual({ slug: 'stripe', name: 'Stripe' });
	});
});

describe('Account > Get Plan and Quota', () => {
	it('returns the /v1/me object', async () => {
		const me = { plan: 'explore', status: 'active', limits: { max_page_size: 20 } };
		const { ctx, http } = executeContext({
			params: { resource: 'account', operation: 'getPlan' },
			responder: sequence({ body: me }),
		});
		const [out] = await run(ctx);
		expect(http.mock.calls[0][1].url).toBe('https://api.example.test/v1/me');
		expect(out[0].json).toEqual(me);
	});
});

describe('errors', () => {
	it('throws the 403 plan message', async () => {
		const { ctx } = executeContext({
			params: { resource: 'job', operation: 'search', limit: 1 },
			responder: sequence({ statusCode: 403, body: { error: 'plan_required', message: 'x' } }),
		});
		await expect(run(ctx)).rejects.toThrow('Your JOA plan does not include this endpoint');
	});

	it('returns an error item instead of failing when Continue On Fail is on', async () => {
		const { ctx } = executeContext({
			params: { resource: 'account', operation: 'getPlan' },
			responder: sequence({ statusCode: 429, headers: { 'retry-after': '7' }, body: {} }),
			continueOnFail: true,
		});
		const [out] = await run(ctx);
		expect(out).toEqual([
			{ json: { error: 'Rate limit reached, retry after 7 seconds' }, pairedItem: { item: 0 } },
		]);
	});
});
