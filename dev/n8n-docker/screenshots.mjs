// Takes README screenshots of the node in the local n8n editor (headless Chromium, Playwright).
// Usage: node screenshots.mjs <email> <password> <outDir>
import { chromium } from 'playwright';

const [email, password, out, only] = process.argv.slice(2);
const want = (step) => !only || only.split(',').includes(step);
const base = 'http://127.0.0.1:5679';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const shot = async (name) => { await page.waitForTimeout(800); await page.screenshot({ path: `${out}/${name}.png` }); console.log('saved', name); };
const openNode = async (name) => {
	const node = page.locator('[data-test-id="canvas-node"]', { hasText: name }).first();
	if (await node.isVisible().catch(() => false)) await node.dblclick({ force: true });
	else await page.getByText(name, { exact: true }).first().dblclick({ force: true });
	await page.waitForTimeout(2500);
};
const dismiss = async () => {
	for (const label of ['Close', 'Skip', 'Got it', 'Dismiss']) {
		const b = page.getByRole('button', { name: label }).first();
		if (await b.isVisible().catch(() => false)) await b.click().catch(() => {});
	}
	await page.keyboard.press('Escape').catch(() => {});
};

await page.goto(base + '/signin');
await page.waitForLoadState('networkidle');
await page.locator('input[type=email], input[name=emailOrLdapLoginId], input[name=email]').first().fill(email);
await page.locator('input[type=password]').first().fill(password);
await page.locator('button[type=submit], button:has-text("Sign in")').first().click();
await page.waitForTimeout(3000);
await dismiss();

// 1. Search -> Get workflow on the canvas, executed
if (want('search')) {
await page.goto(base + '/workflow/JoaE2eSearch0001');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(2500);
await dismiss();
const runBtn = page.locator('[data-test-id="execute-workflow-button"]').first();
if (await runBtn.isVisible().catch(() => false)) {
	await runBtn.click();
	await page.waitForTimeout(6000);
}
await shot('workflow-canvas');

// 2. Search node parameters + output
await openNode('JOA Search');
await shot('node-search');
await page.keyboard.press('Escape');
await page.waitForTimeout(800);
}

// 3. Trigger node
if (want('trigger')) {
await page.goto(base + '/workflow/JoaE2eTrigNew001');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(2500);
await dismiss();
await openNode('JOA Trigger');
const fetchBtn = page.locator('[data-test-id="node-execute-button"]').first();
if (await fetchBtn.isVisible().catch(() => false)) {
	await fetchBtn.click({ force: true });
	await page.waitForTimeout(6000);
}
await shot('trigger-new-jobs');
await page.keyboard.press('Escape');
}

// 4. Node creator: actions of the node
if (want('creator')) {
await page.goto(base + '/workflow/JoaE2eSearch0001');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(2000);
await dismiss();
const plus = page.locator('[data-test-id="node-creator-plus-button"]').first();
if (await plus.isVisible().catch(() => false)) {
	await plus.click();
	await page.waitForTimeout(1000);
	await page.keyboard.type('Job Opportunities');
	await page.waitForTimeout(1500);
	await shot('node-creator-search');
	const item = page.getByText('Job Opportunities API', { exact: true }).first();
	if (await item.isVisible().catch(() => false)) {
		await item.click();
		await page.waitForTimeout(1500);
		await shot('node-actions');
	}
}
}
await browser.close();