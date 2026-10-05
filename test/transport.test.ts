import { describe, expect, it } from 'vitest';
import { NodeApiError } from 'n8n-workflow';

import {
	buildApiError,
	cleanQuery,
	joaApiRequest,
	joaApiRequestAllItems,
	MAX_PAGE_SIZE,
	parseRetryAfter,
} from '../nodes/JobOpportunitiesApi/shared/transport';
import { executeContext, fakeNode, page, sequence } from './helpers';

describe('cleanQuery', () => {
	it('drops empty values and joins arrays', () => {
		expect(
			cleanQuery({ a: '', b: undefined, c: null, d: [], e: ['x', 'y'], f: 0, g: false, h: 'v' }),
		).toEqual({ e: 'x,y', f: 0, g: false, h: 'v' });
	});
});

describe('parseRetryAfter', () => {
	it('reads seconds and HTTP dates', () => {
		expect(parseRetryAfter('30')).toBe(30);
		expect(parseRetryAfter('1.2')).toBe(2);
		const now = Date.parse('2026-10-05T10:00:00Z');
		expect(parseRetryAfter('Mon, 05 Oct 2026 10:01:00 GMT', now)).toBe(60);
		expect(parseRetryAfter(undefined)).toBeUndefined();
		expect(parseRetryAfter('soon')).toBeUndefined();
	});
});

describe('buildApiError', () => {
	it('maps 401 to "Invalid API key"', () => {
		const error = buildApiError(fakeNode, 401, {}, {
			error: 'invalid_key',
			message: 'That key is not valid, or is no longer active.',
		});
		expect(error).toBeInstanceOf(NodeApiError);
		expect(error.message).toBe('Invalid API key');
		expect(error.httpCode).toBe('401');
		expect(error.description).toContain('jobopportunitiesapi.org/register');
	});

	it('maps 403 to the plan message', () => {
		const error = buildApiError(fakeNode, 403, {}, { error: 'plan', message: 'Growth only' });
		expect(error.message).toBe(
			'Your JOA plan does not include this endpoint (the change feed needs Growth or above)',
		);
		expect(error.httpCode).toBe('403');
	});

	it('surfaces Retry-After on 429', () => {
		const error = buildApiError(fakeNode, 429, { 'Retry-After': '42' }, { error: 'rate_limited' });
		expect(error.message).toBe('Rate limit reached, retry after 42 seconds');
		expect(error.description).toContain('42 seconds');
		expect(error.httpCode).toBe('429');
	});

	it('handles 429 without Retry-After', () => {
		expect(buildApiError(fakeNode, 429, {}, '').message).toBe('Rate limit reached, retry later');
	});

	it('maps 422 and 400 to an invalid parameter message using the API text', () => {
		const error = buildApiError(fakeNode, 422, {}, {
			error: 'bad_remote',
			message: 'Unknown remote "banana".',
		});
		expect(error.message).toBe('Invalid parameter: Unknown remote "banana".');
		expect(buildApiError(fakeNode, 400, {}, '{"error":"bad","message":"Nope"}').message).toBe(
			'Invalid parameter: Nope',
		);
	});

	it('uses the API message for 404 and a generic one for other statuses', () => {
		expect(buildApiError(fakeNode, 404, {}, { message: 'No listing with that id.' }).message).toBe(
			'No listing with that id.',
		);
		expect(buildApiError(fakeNode, 503, {}, {}).message).toBe(
			'The Job Opportunities API returned status 503',
		);
	});
});

describe('joaApiRequest', () => {
	it('builds the URL from the credential base URL and sends a clean query', async () => {
		const { ctx, http } = executeContext({ params: {}, responder: sequence({ body: { ok: 1 } }) });
		const body = await joaApiRequest.call(ctx as never, 'GET', '/v1/jobs', {
			country: 'DE',
			q: '',
			remote: ['remote', 'hybrid'],
		});
		expect(body).toEqual({ ok: 1 });
		const [credentialType, options] = http.mock.calls[0];
		expect(credentialType).toBe('jobOpportunitiesApi');
		expect(options.url).toBe('https://api.example.test/v1/jobs');
		expect(options.qs).toEqual({ country: 'DE', remote: 'remote,hybrid' });
		expect(options.ignoreHttpStatusErrors).toBe(true);
		expect(options.returnFullResponse).toBe(true);
	});

	it('throws a mapped NodeApiError for error statuses', async () => {
		const { ctx } = executeContext({
			params: {},
			responder: sequence({ statusCode: 401, body: { error: 'invalid_key', message: 'x' } }),
		});
		await expect(joaApiRequest.call(ctx as never, 'GET', '/v1/me')).rejects.toThrow(
			'Invalid API key',
		);
	});

	it('wraps network failures in a NodeApiError', async () => {
		const { ctx } = executeContext({
			params: {},
			responder: () => {
				throw new Error('getaddrinfo ENOTFOUND');
			},
		});
		await expect(joaApiRequest.call(ctx as never, 'GET', '/v1/me')).rejects.toBeInstanceOf(
			NodeApiError,
		);
	});
});

describe('joaApiRequestAllItems', () => {
	it('follows next_cursor and stops exactly at the limit', async () => {
		const { ctx, http } = executeContext({
			params: {},
			responder: sequence(
				page(['1', '2', '3'], 'c1', true),
				page(['4', '5', '6'], 'c2', true),
				page(['7', '8', '9'], 'c3', true),
			),
		});
		const rows = await joaApiRequestAllItems.call(ctx as never, '/v1/jobs', { country: 'DE' }, 5);
		expect(rows.map((row) => row.id)).toEqual(['1', '2', '3', '4', '5']);
		expect(http).toHaveBeenCalledTimes(2);
		expect(http.mock.calls[0][1].qs).toEqual({ country: 'DE', limit: 5 });
		expect(http.mock.calls[1][1].qs).toEqual({ country: 'DE', limit: 2, cursor: 'c1' });
	});

	it('clamps the page size to 100', async () => {
		const { ctx, http } = executeContext({ params: {}, responder: sequence(page(['1'], null, false)) });
		await joaApiRequestAllItems.call(ctx as never, '/v1/jobs', {}, 500);
		expect(http.mock.calls[0][1].qs).toEqual({ limit: MAX_PAGE_SIZE });
	});

	it('fetches every page when no limit is given and stops when has_more is false', async () => {
		const { ctx, http } = executeContext({
			params: {},
			responder: sequence(page(['1', '2'], 'c1', true), page(['3'], 'c2', false)),
		});
		const rows = await joaApiRequestAllItems.call(ctx as never, '/v1/jobs', {});
		expect(rows).toHaveLength(3);
		expect(http).toHaveBeenCalledTimes(2);
		expect(http.mock.calls[1][1].qs).toEqual({ limit: MAX_PAGE_SIZE, cursor: 'c1' });
	});

	it('stops on an empty page or a repeated cursor', async () => {
		const { ctx, http } = executeContext({
			params: {},
			responder: sequence(page(['1'], 'same', true), page(['2'], 'same', true)),
		});
		const rows = await joaApiRequestAllItems.call(ctx as never, '/v1/jobs', {});
		expect(rows.map((row) => row.id)).toEqual(['1', '2']);
		expect(http).toHaveBeenCalledTimes(2);
	});
});
