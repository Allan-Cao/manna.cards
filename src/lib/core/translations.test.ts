import { describe, expect, it } from 'vitest';
import { ESV_COPYRIGHT_PAGE, TRANSLATIONS } from './translations.ts';

describe('TRANSLATIONS', () => {
	it('lists the five translations in picker order, each under its own id', () => {
		expect(Object.keys(TRANSLATIONS)).toEqual(['bsb', 'web', 'kjv', 'lsv', 'esv']);
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

	it('credits the LSV to Covenant Press under CC BY-SA 4.0, with the source and the changes made', () => {
		const lsv = TRANSLATIONS.lsv;
		expect(lsv).toMatchObject({ short: 'LSV', name: 'Literal Standard Version' });
		expect(lsv.remote).toBeUndefined();
		expect(lsv.link).toBe('https://lsvbible.com');
		for (const part of [
			'copyright © 2020 Covenant Press',
			'https://ebible.org/find/details.php?id=engLSV',
			'Creative Commons Attribution-ShareAlike 4.0',
			'https://creativecommons.org/licenses/by-sa/4.0/',
			'not endorse',
			'same license'
		]) {
			expect(lsv.copyright).toContain(part);
		}
	});

	it('has the full notice for the copyright page', () => {
		expect(ESV_COPYRIGHT_PAGE).toMatch(/^Scripture quotations marked “ESV” are from/);
		expect(ESV_COPYRIGHT_PAGE).toMatch(/more than one half of any book of the ESV Bible\.$/);
	});
});
