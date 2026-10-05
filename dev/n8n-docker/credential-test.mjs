// Presses the credential "Test" button through the local n8n REST API (runs the credential's
// test request, GET /v1/me). Prints only the status, never credential data.
// Usage (inside the container): node --input-type=module - <email> <password> <credentialId> < credential-test.mjs
const base = 'http://127.0.0.1:5678';
const [email, password, id] = process.argv.slice(2);
const headers = { 'content-type': 'application/json', 'browser-id': 'joa-e2e-browser' };
async function call(method, path, body) {
	const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
	const cookie = res.headers.get('set-cookie');
	if (cookie) headers.cookie = cookie.split(';')[0];
	return { status: res.status, json: await res.json().catch(() => ({})) };
}
await call('POST', '/rest/login', { emailOrLdapLoginId: email, password });
const cred = (await call('GET', `/rest/credentials/${id}?includeData=true`)).json.data;
const test = await call('POST', '/rest/credentials/test', {
	credentials: { id: cred.id, name: cred.name, type: cred.type, data: cred.data },
});
console.log('credential test HTTP', test.status, '->', JSON.stringify(test.json.data ?? test.json));
