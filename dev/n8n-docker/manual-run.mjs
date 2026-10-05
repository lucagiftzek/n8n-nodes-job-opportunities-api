// Runs a workflow the way the editor's "Execute workflow" / "Fetch Test Event" does (mode "manual")
// through the local n8n REST API, then prints a compact summary (ids/titles only).
// Usage (inside the container): node --input-type=module - <email> <password> <workflowId> <startNode> < manual-run.mjs
import { createRequire } from 'node:module';
const { parse } = createRequire('/usr/local/lib/node_modules/n8n/package.json')('flatted');

const base = 'http://127.0.0.1:5678';
const [email, password, workflowId, startNode] = process.argv.slice(2);
const headers = { 'content-type': 'application/json', 'browser-id': 'joa-e2e-browser' };

async function call(method, path, body) {
	const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
	const text = await res.text();
	const cookie = res.headers.get('set-cookie');
	if (cookie) headers.cookie = cookie.split(';')[0];
	let json;
	try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
	return { status: res.status, json };
}

let r = await call('POST', '/rest/owner/setup', { email, firstName: 'Local', lastName: 'Tester', password });
if (r.status >= 400) r = await call('POST', '/rest/login', { emailOrLdapLoginId: email, password });
if (r.status >= 400) { console.log('LOGIN FAILED', r.status, JSON.stringify(r.json).slice(0, 300)); process.exit(1); }
if (!workflowId) { console.log('owner ready'); process.exit(0); }

const wf = (await call('GET', `/rest/workflows/${workflowId}`)).json.data;
const run = await call('POST', `/rest/workflows/${workflowId}/run`, {
	workflowData: wf,
	triggerToStartFrom: { name: startNode },
});
const executionId = run.json?.data?.executionId;
if (!executionId) { console.log('RUN FAILED', run.status, JSON.stringify(run.json).slice(0, 500)); process.exit(1); }

let execution;
for (let i = 0; i < 60; i++) {
	await new Promise((resolve) => setTimeout(resolve, 1000));
	execution = (await call('GET', `/rest/executions/${executionId}`)).json.data;
	if (execution && execution.finished !== undefined && execution.status !== 'running' && execution.status !== 'new') break;
}
console.log('execution', executionId, 'mode', execution.mode, 'status', execution.status);
const data = typeof execution.data === 'string' ? parse(execution.data) : execution.data;
const rd = data.resultData;
if (rd.error) console.log('ERROR:', rd.error.message);
for (const [node, runs] of Object.entries(rd.runData ?? {})) {
	for (const nodeRun of runs) {
		if (nodeRun.error) { console.log(node, 'ERROR:', nodeRun.error.message); continue; }
		const items = nodeRun.data?.main?.[0] ?? [];
		console.log(node, '->', items.length, 'items');
		for (const it of items.slice(0, 5)) {
			const j = it.json;
			console.log('   ', JSON.stringify({ id: j.id ?? j.job?.id, change: j.change, removed: j.removed, country: j.country ?? j.job?.country, posted_at: j.posted_at, closed_reason: j.closed_reason }));
		}
	}
}
