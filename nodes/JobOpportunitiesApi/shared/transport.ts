import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IN8nHttpFullResponse,
	INode,
	IPollFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

export const CREDENTIAL_TYPE = 'jobOpportunitiesApi';
export const DEFAULT_BASE_URL = 'https://api.jobopportunitiesapi.org';
/** Largest page this node ever asks for. The API may cap it lower per key (limits.max_page_size). */
export const MAX_PAGE_SIZE = 100;

export type JoaContext = IExecuteFunctions | IPollFunctions | ILoadOptionsFunctions;

export interface JoaListResponse {
	data?: IDataObject[];
	next_cursor?: string | null;
	has_more?: boolean;
}

function parseBody(body: unknown): IDataObject {
	if (body && typeof body === 'object') return body as IDataObject;
	if (typeof body === 'string' && body.trim() !== '') {
		try {
			const parsed: unknown = JSON.parse(body);
			if (parsed && typeof parsed === 'object') return parsed as IDataObject;
		} catch {
			return { message: body };
		}
	}
	return {};
}

function headerValue(headers: IDataObject | undefined, name: string): string | undefined {
	if (!headers) return undefined;
	const wanted = name.toLowerCase();
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() === wanted && value !== undefined && value !== null) {
			return Array.isArray(value) ? String(value[0]) : String(value);
		}
	}
	return undefined;
}

/** Parse a Retry-After header (seconds or HTTP date) into whole seconds. */
export function parseRetryAfter(value: string | undefined, now = Date.now()): number | undefined {
	if (value === undefined || value.trim() === '') return undefined;
	const seconds = Number(value);
	if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
	const at = Date.parse(value);
	if (Number.isNaN(at)) return undefined;
	return Math.max(0, Math.ceil((at - now) / 1000));
}

/**
 * Turn a non-2xx JOA response into a NodeApiError with a message a workflow builder can act on.
 * JOA error bodies look like {"error": "invalid_key", "message": "...", "docs": "..."}.
 */
export function buildApiError(
	node: INode,
	statusCode: number,
	headers: IDataObject | undefined,
	rawBody: unknown,
	itemIndex?: number,
): NodeApiError {
	const body = parseBody(rawBody);
	const apiMessage = typeof body.message === 'string' ? body.message : undefined;
	const apiCode = typeof body.error === 'string' ? body.error : undefined;
	const suffix = apiMessage ? ` JOA said: ${apiMessage}` : '';
	const errorResponse: JsonObject = {
		...(body as JsonObject),
		httpCode: String(statusCode),
	};

	let message: string;
	let description: string | undefined;
	let failure: { cause: 'rate-limited'; retryAfterMs?: number } | { cause: 'credential-invalid' } | { cause: 'configuration-invalid' } | undefined;

	switch (statusCode) {
		case 401:
			message = 'Invalid API key';
			description = `Check the API key in your Job Opportunities API credential. You can get a free key (no card required) at https://jobopportunitiesapi.org/register.${suffix}`;
			failure = { cause: 'credential-invalid' };
			break;
		case 403:
			message =
				'Your JOA plan does not include this endpoint (the change feed needs Growth or above)';
			description = `Upgrade your plan at https://jobopportunitiesapi.org, or use an operation your plan includes.${suffix}`;
			failure = { cause: 'configuration-invalid' };
			break;
		case 429: {
			const retryAfter = parseRetryAfter(headerValue(headers, 'retry-after'));
			message =
				retryAfter !== undefined
					? `Rate limit reached, retry after ${retryAfter} seconds`
					: 'Rate limit reached, retry later';
			description = `The Job Opportunities API rate limit was reached.${
				retryAfter !== undefined ? ` The Retry-After header asks you to wait ${retryAfter} seconds.` : ''
			} Reduce how often this workflow runs, or enable Retry On Fail in the node settings.${suffix}`;
			failure = { cause: 'rate-limited', ...(retryAfter !== undefined ? { retryAfterMs: retryAfter * 1000 } : {}) };
			break;
		}
		case 404:
			message = apiMessage ?? 'The requested resource was not found';
			description = apiCode ? `JOA error code: ${apiCode}` : undefined;
			failure = { cause: 'configuration-invalid' };
			break;
		case 400:
		case 422:
			message = `Invalid parameter: ${apiMessage ?? 'the request was rejected'}`;
			description = apiCode ? `JOA error code: ${apiCode}` : undefined;
			failure = { cause: 'configuration-invalid' };
			break;
		default:
			message = apiMessage ?? `The Job Opportunities API returned status ${statusCode}`;
			description = apiCode ? `JOA error code: ${apiCode}` : undefined;
	}

	return new NodeApiError(node, errorResponse, {
		message,
		description,
		httpCode: String(statusCode),
		itemIndex,
		...(failure ? { failure } : {}),
	});
}

/** Keep errors n8n already understands, wrap anything else in a NodeApiError. */
export function toNodeError(
	node: INode,
	error: unknown,
	itemIndex?: number,
): NodeApiError | NodeOperationError {
	if (error instanceof NodeApiError || error instanceof NodeOperationError) return error;
	return new NodeApiError(node, error as JsonObject, { itemIndex });
}

/** Remove empty values so that only filters the user actually set reach the API. */
export function cleanQuery(qs: IDataObject): IDataObject {
	const out: IDataObject = {};
	for (const [key, value] of Object.entries(qs)) {
		if (value === undefined || value === null || value === '') continue;
		if (Array.isArray(value)) {
			if (value.length === 0) continue;
			out[key] = value.join(',');
			continue;
		}
		out[key] = value;
	}
	return out;
}

export function normaliseBaseUrl(node: INode, raw: unknown): string {
	const value = typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : DEFAULT_BASE_URL;
	if (!/^https?:\/\//i.test(value)) {
		throw new NodeOperationError(node, `The Base URL in the credential must start with https:// (got "${value}")`);
	}
	return value.replace(/\/+$/, '');
}

export async function joaApiRequest(
	this: JoaContext,
	method: IHttpRequestMethods,
	endpoint: string,
	qs: IDataObject = {},
	itemIndex?: number,
): Promise<IDataObject> {
	const credentials = await this.getCredentials(CREDENTIAL_TYPE);
	const baseUrl = normaliseBaseUrl(this.getNode(), credentials.baseUrl);

	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${endpoint}`,
		qs: cleanQuery(qs),
		headers: { Accept: 'application/json' },
		json: true,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};

	let response: IN8nHttpFullResponse;
	try {
		response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			CREDENTIAL_TYPE,
			options,
		)) as IN8nHttpFullResponse;
	} catch (error) {
		// Network failures (DNS, TLS, timeouts): HTTP status errors are handled below.
		throw toNodeError(this.getNode(), error, itemIndex);
	}

	const statusCode = Number(response.statusCode ?? 200);
	if (statusCode >= 400) {
		throw buildApiError(
			this.getNode(),
			statusCode,
			response.headers as IDataObject,
			response.body,
			itemIndex,
		);
	}
	return parseBody(response.body);
}

/**
 * Follow JOA's keyset pagination (next_cursor) until `limit` rows are collected
 * or the API reports no more rows. Pass limit = undefined to fetch everything.
 */
export async function joaApiRequestAllItems(
	this: JoaContext,
	endpoint: string,
	qs: IDataObject = {},
	limit?: number,
	itemIndex?: number,
): Promise<IDataObject[]> {
	const results: IDataObject[] = [];
	let cursor: string | undefined;

	for (;;) {
		const remaining = limit === undefined ? MAX_PAGE_SIZE : limit - results.length;
		if (remaining <= 0) break;
		const query: IDataObject = { ...qs, limit: Math.min(MAX_PAGE_SIZE, remaining) };
		if (cursor) query.cursor = cursor;

		const response = (await joaApiRequest.call(
			this,
			'GET',
			endpoint,
			query,
			itemIndex,
		)) as JoaListResponse;
		const page = Array.isArray(response.data) ? response.data : [];
		results.push(...page);

		const next = response.next_cursor;
		if (!response.has_more || !next || page.length === 0 || next === cursor) break;
		cursor = next;
	}

	return limit === undefined ? results : results.slice(0, limit);
}
