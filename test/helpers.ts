import { vi } from 'vitest';
import type { IDataObject, IHttpRequestOptions, INode } from 'n8n-workflow';

export interface FakeResponse {
	statusCode?: number;
	headers?: IDataObject;
	body: unknown;
}

export type Responder = (options: IHttpRequestOptions, call: number) => FakeResponse;

export const fakeNode: INode = {
	id: 'node-1',
	name: 'Job Opportunities API',
	type: 'n8n-nodes-job-opportunities-api.jobOpportunitiesApi',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

/** A responder that serves the given responses in order (the last one repeats). */
export function sequence(...responses: FakeResponse[]): Responder {
	return (_options, call) => responses[Math.min(call, responses.length - 1)];
}

function makeHttp(responder: Responder) {
	let call = 0;
	return vi.fn(async (_credentialType: string, options: IHttpRequestOptions) => {
		const response = responder(options, call++);
		return { statusCode: 200, headers: {}, ...response };
	});
}

const credentials = { apiKey: 'test-key-not-real', baseUrl: 'https://api.example.test/' };

/** Minimal IExecuteFunctions stand-in. Parameters are shared by every input item. */
export function executeContext(opts: {
	params: IDataObject;
	responder: Responder;
	items?: number;
	continueOnFail?: boolean;
}) {
	const http = makeHttp(opts.responder);
	const ctx = {
		getInputData: () => Array.from({ length: opts.items ?? 1 }, () => ({ json: {} })),
		getNodeParameter: (name: string, _i: number, fallback?: unknown) =>
			name in opts.params ? opts.params[name] : fallback,
		getCredentials: async () => credentials,
		getNode: () => fakeNode,
		continueOnFail: () => opts.continueOnFail ?? false,
		helpers: { httpRequestWithAuthentication: http },
	};
	return { ctx, http };
}

/** Minimal IPollFunctions stand-in. */
export function pollContext(opts: {
	params: IDataObject;
	responder: Responder;
	mode?: string;
	staticData?: IDataObject;
}) {
	const http = makeHttp(opts.responder);
	const staticData: IDataObject = opts.staticData ?? {};
	const ctx = {
		getMode: () => opts.mode ?? 'trigger',
		getNodeParameter: (name: string, fallback?: unknown) =>
			name in opts.params ? opts.params[name] : fallback,
		getCredentials: async () => credentials,
		getNode: () => fakeNode,
		getWorkflowStaticData: () => staticData,
		helpers: {
			httpRequestWithAuthentication: http,
			returnJsonArray: (items: IDataObject[]) => items.map((json) => ({ json })),
		},
	};
	return { ctx, http, staticData };
}

export function job(id: string, extra: IDataObject = {}): IDataObject {
	return {
		id,
		slug: `job-${id}`,
		title: `Job ${id}`,
		company: 'Acme',
		location: 'Berlin, Germany',
		remote: 'remote',
		employment_type: 'Full-time',
		posted_at: '2026-10-05T10:00:00Z',
		apply_url: `https://jobs.example.test/${id}`,
		country: 'DE',
		seniority: 'Senior',
		category: 'Engineering',
		...extra,
	};
}

export function page(ids: string[], nextCursor: string | null, hasMore: boolean): FakeResponse {
	return { body: { data: ids.map((id) => job(id)), next_cursor: nextCursor, has_more: hasMore } };
}
