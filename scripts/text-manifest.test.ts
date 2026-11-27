import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SOURCES } from './build-text.ts';
import { compareSource, statedDate, usfmDigest } from './text-manifest.ts';

const file = (name: string, text: string): [string, Uint8Array] => [
	name,
	new TextEncoder().encode(text)
];

describe('usfmDigest', () => {
	const a = file('01-GENeng.usfm', '\\id GEN');
	const b = file('02-EXOeng.usfm', '\\id EXO');

	it('hashes only the USFM files, whatever the order or the other files', () => {
		const base = usfmDigest(Object.fromEntries([a, b]));
		expect(usfmDigest(Object.fromEntries([b, a]))).toBe(base);
		expect(usfmDigest(Object.fromEntries([a, b, file('copr.htm', '2026-11-15')]))).toBe(base);
		expect(usfmDigest(Object.fromEntries([a, file('02-EXOeng.usfm', '\\id EXO x')]))).not.toBe(
			base
		);
	});

	it('does not confuse where one file ends and the next begins', () => {
		const one = usfmDigest(Object.fromEntries([file('a.usfm', 'xy'), file('b.usfm', 'z')]));
		const two = usfmDigest(Object.fromEntries([file('a.usfm', 'x'), file('b.usfm', 'yz')]));
		expect(one).not.toBe(two);
	});
});

describe('statedDate', () => {
	it('reads the date eBible states in copr.htm', () => {
		expect(statedDate('<p>BSB Publishing</p><p>2026-10-30</p>generated 30 Oct 2026')).toBe(
			'2026-10-30'
		);
		expect(statedDate('<p>source files dated 13 Nov 2026 </p>')).toBe('2026-11-13');
		expect(statedDate('<p>no date</p>')).toBeNull();
	});
});

describe('compareSource', () => {
	const prev = { zipSha256: 'z1', usfmSha256: 'u1' };
	it('classifies a rebuild against the recorded entry', () => {
		expect(compareSource(undefined, prev)).toBe('new');
		expect(compareSource(prev, { ...prev })).toBe('unchanged');
		expect(compareSource(prev, { zipSha256: 'z2', usfmSha256: 'u1' })).toBe(
			'package changed, USFM identical'
		);
		expect(compareSource(prev, { zipSha256: 'z2', usfmSha256: 'u2' })).toBe('USFM changed');
	});
});

describe('committed manifest', () => {
	it('records every built translation', () => {
		const manifest = JSON.parse(
			readFileSync(new URL('./text-sources.json', import.meta.url), 'utf8')
		);
		for (const id of Object.keys(SOURCES)) {
			expect(manifest[id]).toMatchObject({
				url: SOURCES[id as keyof typeof SOURCES],
				zipSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
				usfmSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
				downloaded: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
			});
		}
	});
});
