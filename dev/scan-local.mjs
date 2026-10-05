// Local stand-in for "npx @n8n/scan-community-package <name>" before the package is on npm.
// Runs the scanner's own analyzePackage() exactly as analyzePackageByName() does after its
// provenance and source-download steps (which need the published package and cannot run locally).
// Usage: node dev/scan-local.mjs <extracted-tarball-dir> <source-repo-dir>
import { analyzePackage, SOURCE_FILE_PATTERNS } from '/tmp/scan/node_modules/@n8n/scan-community-package/scanner/scanner.mjs';
const [tarDir, srcDir] = process.argv.slice(2);
const source = await analyzePackage(srcDir, SOURCE_FILE_PATTERNS);
console.log('SOURCE scan:', source.passed ? 'PASSED' : 'FAILED', source.message ?? '', source.details ?? '');
const dist = await analyzePackage(tarDir, ['**/*.js', 'package.json']);
console.log('TARBALL scan:', dist.passed ? 'PASSED' : 'FAILED', dist.message ?? '', dist.details ?? '');
