import { describe, expect, it } from 'vitest';
import { ESV_COPYRIGHT_PAGE, TRANSLATIONS } from './translations.ts';

describe('TRANSLATIONS', () => {
	it('lists the four translations in picker order, each under its own id', () => {
		expect(Object.keys(TRANSLATIONS)).toEqual(['bsb', 'web', 'kjv', 'esv']);
		for (const [id, t] of Object.entries(TRANSLATIONS)) expect(t.id).toBe(id);
	});

	it('marks only the ESV as fetched at build time, with its copyright notice', () => {
		expect(TRANSLATIONS.esv).toMatchObject({ short: 'ESV', name: 'English Standard Version' });
		expect(TRANSLATIONS.esv.remote).toBe(true);
		expect(TRANSLATIONS.esv.copyright).toBe(
			'ESV® Bible (The Holy Bible, English Standard Version®), copyright © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.'
		);
		for (const id of ['bsb', 'web', 'kjv'] as const) {
			expect(TRANSLATIONS[id].remote).toBeUndefined();
			expect(TRANSLATIONS[id].copyright).toBeUndefined();
		}
	});

	it('has the full notice for the copyright page', () => {
		expect(ESV_COPYRIGHT_PAGE).toMatch(/^Scripture quotations marked “ESV” are from/);
		expect(ESV_COPYRIGHT_PAGE).toMatch(/more than one half of any book of the ESV Bible\.$/);
	});
});
