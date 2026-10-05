import { describe, expect, it } from 'vitest';

import {
	JobOpportunitiesApiTrigger,
	SEEN_IDS_CAP,
} from '../nodes/JobOpportunitiesApiTrigger/JobOpportunitiesApiTrigger.node';
import { page, pollContext, sequence } from './helpers';

const trigger = new JobOpportunitiesApiTrigger();
const poll = (ctx: unknown) => trigger.poll.call(ctx as never);
const ids = (out: Awaited<ReturnType<typeof poll>>) => (out ? out[0].map((item) => item.json.id) : null);

describe('trigger description', () => {
	it('is a polling trigger', () => {
		expect(trigger.description.polling).toBe(true);
		expect(trigger.description.name).toBe('jobOpportunitiesApiTrigger');
	});
});

describe('New Job Matching Search', () => {
	const params = { event: 'newJob', country: 'DE', maxJobs: 10 };

	it('emits nothing on the first poll after activation but remembers what exists', async () => {
		const { ctx, http, staticData } = pollContext({
			params,
			responder: sequence(page(['a', 'b'], null, false)),
		});
		expect(await poll(ctx)).toBeNull();
		expect(http).toHaveBeenCalledTimes(1);
		expect(http.mock.calls[0][1].qs).toMatchObject({ country: 'DE', limit: 10 });
		expect(staticData.newJob).toMatchObject({ seenIds: ['a', 'b'] });
	});

	it('emits only unseen jobs and looks back from the previous poll minus the overlap', async () => {
		const lastPollAt = '2026-10-05T10:00:00.000Z';
		const { ctx, http, staticData } = pollContext({
			params: { ...params, options: { overlapMinutes: 30 } },
			responder: sequence(page(['c', 'a', 'b'], null, false)),
			staticData: { newJob: { lastPollAt, seenIds: ['a', 'b'] } },
		});
		expect(ids(await poll(ctx))).toEqual(['c']);
		expect(http.mock.calls[0][1].qs.posted_after).toBe('2026-10-05T09:30:00.000Z');
		const state = staticData.newJob as { seenIds: string[]; lastPollAt: string };
		expect(state.seenIds).toEqual(['c', 'a', 'b']);
		expect(state.lastPollAt).not.toBe(lastPollAt);
	});

	it('returns null when nothing new arrived', async () => {
		const { ctx } = pollContext({
			params,
			responder: sequence(page(['a'], null, false)),
			staticData: { newJob: { lastPollAt: '2026-10-05T10:00:00.000Z', seenIds: ['a'] } },
		});
		expect(await poll(ctx)).toBeNull();
	});

	it('keeps the later of the window start and a user Posted After filter', async () => {
		const { ctx, http } = pollContext({
			params: { ...params, postedAfter: '2026-10-05T09:59:00.000Z' },
			responder: sequence(page([], null, false)),
			staticData: { newJob: { lastPollAt: '2026-10-05T10:00:00.000Z', seenIds: [] } },
		});
		await poll(ctx);
		expect(http.mock.calls[0][1].qs.posted_after).toBe('2026-10-05T09:59:00.000Z');
	});

	it('caps the remembered ids', async () => {
		const old = Array.from({ length: SEEN_IDS_CAP }, (_, i) => `old${i}`);
		const { ctx, staticData } = pollContext({
			params,
			responder: sequence(page(['new1', 'new2'], null, false)),
			staticData: { newJob: { lastPollAt: '2026-10-05T10:00:00.000Z', seenIds: old } },
		});
		expect(ids(await poll(ctx))).toEqual(['new1', 'new2']);
		const seen = (staticData.newJob as { seenIds: string[] }).seenIds;
		expect(seen).toHaveLength(SEEN_IDS_CAP);
		expect(seen.slice(0, 3)).toEqual(['new1', 'new2', 'old0']);
	});

	it('clamps Max Jobs per Poll to 50', async () => {
		const { ctx, http } = pollContext({
			params: { ...params, maxJobs: 500 },
			responder: sequence(page([], null, false)),
			staticData: { newJob: { lastPollAt: '2026-10-05T10:00:00.000Z', seenIds: [] } },
		});
		await poll(ctx);
		expect(http.mock.calls[0][1].qs.limit).toBe(50);
	});

	it('returns a sample of the latest jobs in manual test mode without changing state', async () => {
		const { ctx, http, staticData } = pollContext({
			params,
			mode: 'manual',
			responder: sequence(page(['a', 'b', 'c', 'd', 'e', 'f'], null, false)),
		});
		const out = await poll(ctx);
		expect(ids(out)).toEqual(['a', 'b', 'c', 'd', 'e']);
		expect(http.mock.calls[0][1].qs).toEqual({ country: 'DE', limit: 5 });
		expect(staticData).toEqual({});
	});
});

describe('Job Change (Change Feed)', () => {
	const change = (kind: string, id: string) => ({ change: kind, job: { id } });

	it('starts from the activation time without calling the API', async () => {
		const { ctx, http, staticData } = pollContext({
			params: { event: 'jobChange' },
			responder: sequence({ body: {} }),
		});
		expect(await poll(ctx)).toBeNull();
		expect(http).not.toHaveBeenCalled();
		expect(typeof (staticData.jobChange as { cursor: string }).cursor).toBe('string');
	});

	it('reads from the stored cursor, advances it and filters change types', async () => {
		const { ctx, http, staticData } = pollContext({
			params: { event: 'jobChange', changeTypes: ['withdrawn', 'delisted'], maxChanges: 3 },
			responder: sequence({
				body: {
					data: [change('created', '1'), change('withdrawn', '2'), change('delisted', '3')],
					next_since: 'cursor-2',
					count: 3,
				},
			}),
			staticData: { jobChange: { cursor: 'cursor-1' } },
		});
		const out = await poll(ctx);
		expect(http.mock.calls[0][1].url).toBe('https://api.example.test/v1/changes');
		expect(http.mock.calls[0][1].qs).toEqual({ since: 'cursor-1', limit: 3 });
		expect(out?.[0].map((item) => item.json)).toEqual([
			{ change: 'withdrawn', job: { id: '2' }, removed: true },
			{ change: 'delisted', job: { id: '3' }, removed: true },
		]);
		expect(staticData.jobChange).toEqual({ cursor: 'cursor-2' });
	});

	it('keeps the cursor when an empty page echoes it', async () => {
		const { ctx, staticData } = pollContext({
			params: { event: 'jobChange' },
			responder: sequence({ body: { data: [], next_since: 'cursor-1', count: 0 } }),
			staticData: { jobChange: { cursor: 'cursor-1' } },
		});
		expect(await poll(ctx)).toBeNull();
		expect(staticData.jobChange).toEqual({ cursor: 'cursor-1' });
	});

	it('surfaces the plan error on 403', async () => {
		const { ctx } = pollContext({
			params: { event: 'jobChange' },
			responder: sequence({ statusCode: 403, body: { error: 'plan', message: 'Growth only' } }),
			staticData: { jobChange: { cursor: 'cursor-1' } },
		});
		await expect(poll(ctx)).rejects.toThrow(
			'Your JOA plan does not include this endpoint (the change feed needs Growth or above)',
		);
	});

	it('returns sample changes from the last hour in manual mode', async () => {
		const { ctx, http, staticData } = pollContext({
			params: { event: 'jobChange' },
			mode: 'manual',
			responder: sequence({ body: { data: [change('updated', '9')], next_since: 'x' } }),
		});
		const out = await poll(ctx);
		expect(out?.[0][0].json).toEqual({ change: 'updated', job: { id: '9' }, removed: false });
		expect(http.mock.calls[0][1].qs.limit).toBe(5);
		expect(staticData).toEqual({});
	});
});

describe('Job Closed', () => {
	it('emits id, closed_at and closed_reason and advances the cursor', async () => {
		const { ctx, http, staticData } = pollContext({
			params: { event: 'jobClosed', maxClosed: 2 },
			responder: sequence({
				body: {
					data: [{ id: 'j1', closed_at: '2026-10-05T00:51:19Z', closed_reason: 'not_seen', extra: 1 }],
					next_since: 'next',
					count: 1,
				},
			}),
			staticData: { jobClosed: { cursor: 'start' } },
		});
		const out = await poll(ctx);
		expect(http.mock.calls[0][1].url).toBe('https://api.example.test/v1/jobs/expired');
		expect(http.mock.calls[0][1].qs).toEqual({ since: 'start', limit: 2 });
		expect(out?.[0][0].json).toEqual({ id: 'j1', closed_at: '2026-10-05T00:51:19Z', closed_reason: 'not_seen' });
		expect(staticData.jobClosed).toEqual({ cursor: 'next' });
	});
});
