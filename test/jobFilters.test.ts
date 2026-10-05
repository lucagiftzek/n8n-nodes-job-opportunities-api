import { describe, expect, it } from 'vitest';
import type { IDataObject } from 'n8n-workflow';

import {
	buildJobSearchQuery,
	simplifyJob,
	toApiDate,
} from '../nodes/JobOpportunitiesApi/shared/jobFilters';
import { job } from './helpers';

const getter = (params: IDataObject) => (name: string, fallback: unknown) =>
	name in params ? params[name] : fallback;

describe('buildJobSearchQuery', () => {
	it('returns an empty query when nothing is set', () => {
		expect(buildJobSearchQuery(getter({}))).toEqual({});
	});

	it('maps every top-level and additional filter to the API parameter', () => {
		const qs = buildJobSearchQuery(
			getter({
				keywords: ' data engineer ',
				country: 'de, at',
				remote: ['remote', 'hybrid'],
				employmentType: ['Full-time'],
				seniority: ['Senior', 'Lead'],
				category: ['Engineering'],
				company: 'stripe, figma',
				postedAfter: '2026-10-01T08:00:00.000Z',
				includeDescription: true,
				additionalFilters: {
					city: 'Berlin',
					companyDomain: 'stripe.com',
					descriptionContains: 'kubernetes',
					excludeCategory: ['Sales'],
					excludeCompanyDomain: 'example.com',
					excludeCountry: 'us',
					excludeProvider: 'workday',
					hasDescription: true,
					hasSalary: 'structured',
					maxSalary: 120000,
					minSalary: 60000,
					provider: 'greenhouse,lever',
					remoteConfirmed: true,
					requireFields: ['salary', 'remote'],
					sourceType: ['ats'],
					state: 'oh,tx',
					status: 'any',
					title: 'engineer',
					titleExclude: 'intern',
					verifiedAfter: '2026-10-02',
				},
			}),
		);
		expect(qs).toEqual({
			q: 'data engineer',
			country: 'DE,AT',
			remote: 'remote,hybrid',
			employment_type: 'Full-time',
			seniority: 'Senior,Lead',
			category: 'Engineering',
			company: 'stripe,figma',
			posted_after: '2026-10-01T08:00:00.000Z',
			include_description: true,
			city: 'Berlin',
			company_domain: 'stripe.com',
			description_contains: 'kubernetes',
			exclude_category: 'Sales',
			exclude_company_domain: 'example.com',
			exclude_country: 'US',
			exclude_provider: 'workday',
			has_description: true,
			has_salary: 'structured',
			max_salary: 120000,
			min_salary: 60000,
			provider: 'greenhouse,lever',
			remote_confirmed: true,
			require_fields: 'salary,remote',
			source_type: 'ats',
			state: 'OH,TX',
			status: 'any',
			title: 'engineer',
			title_exclude: 'intern',
			verified_after: '2026-10-02',
		});
	});

	it('leaves defaults out of the query', () => {
		expect(
			buildJobSearchQuery(
				getter({
					includeDescription: false,
					additionalFilters: { hasSalary: 'any', status: 'live', minSalary: 0, hasDescription: false },
				}),
			),
		).toEqual({});
	});
});

describe('toApiDate', () => {
	it('normalises n8n date values', () => {
		expect(toApiDate('')).toBeUndefined();
		expect(toApiDate('2026-10-01')).toBe('2026-10-01');
		expect(toApiDate('2026-10-01T10:00:00.000+02:00')).toBe('2026-10-01T08:00:00.000Z');
	});
});

describe('simplifyJob', () => {
	it('keeps at most 10 fields and always keeps attribution and canonical_url', () => {
		const plain = simplifyJob(job('1'));
		expect(Object.keys(plain)).toHaveLength(8);
		expect(plain).not.toHaveProperty('attribution');
		const attributed = simplifyJob(
			job('2', { attribution: 'via Erioun for Teams', canonical_url: 'https://example.test/j/2' }),
		);
		expect(attributed.attribution).toBe('via Erioun for Teams');
		expect(attributed.canonical_url).toBe('https://example.test/j/2');
		expect(Object.keys(attributed).length).toBeLessThanOrEqual(10);
	});
});
