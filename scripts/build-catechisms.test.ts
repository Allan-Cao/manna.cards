import { describe, expect, it } from 'vitest';
import { BOOKS } from '../src/lib/core/books.ts';
import {
	OSIS_TO_USFM,
	cleanAnswer,
	convertCatechism,
	fixOcr,
	osisToLabel,
	referencesToLabels
} from './build-catechisms.ts';

describe('OSIS_TO_USFM', () => {
	it('maps onto each of the 66 books exactly once', () => {
		expect(Object.values(OSIS_TO_USFM).sort()).toEqual(BOOKS.map((b) => b.id).sort());
	});
});

describe('osisToLabel', () => {
	it('labels a single verse', () => {
		expect(osisToLabel('Isa.44.6')).toBe('Isaiah 44:6');
		expect(osisToLabel('Ps.23.1')).toBe('Psalm 23:1');
		expect(osisToLabel('2Tim.3.16')).toBe('2 Timothy 3:16');
	});
	it('labels a verse range with an en dash', () => {
		expect(osisToLabel('Rom.14.7-Rom.14.9')).toBe('Romans 14:7–9');
	});
	it('labels a range across chapters', () => {
		expect(osisToLabel('Rom.8.38-Rom.9.2')).toBe('Romans 8:38–9:2');
	});
	it('labels a whole chapter', () => {
		expect(osisToLabel('Gen.3')).toBe('Genesis 3');
	});
	it('drops the chapter of single-chapter books', () => {
		expect(osisToLabel('Jude.1.5')).toBe('Jude 5');
		expect(osisToLabel('Jude.5')).toBe('Jude 5');
		expect(osisToLabel('3John.1.5-3John.1.8')).toBe('3 John 5–8');
	});
	it('collapses a one-verse range', () => {
		expect(osisToLabel('Rom.1.1-Rom.1.1')).toBe('Romans 1:1');
	});
	it('throws on an unknown book or a malformed reference', () => {
		expect(() => osisToLabel('Xyz.1.1')).toThrow(/Xyz/);
		expect(() => osisToLabel('Rom')).toThrow();
	});
});

describe('referencesToLabels', () => {
	it('splits comma-joined references and dedupes in order', () => {
		expect(referencesToLabels(['2Tim.3.16,2Tim.3.1', 'Isa.44.6', '2Tim.3.16'])).toEqual([
			'2 Timothy 3:16',
			'2 Timothy 3:1',
			'Isaiah 44:6'
		]);
	});
});

describe('cleanAnswer', () => {
	it('collapses whitespace and strips markers', () => {
		expect(cleanAnswer('  God,[1]  and   man.[2] ')).toBe('God, and man.');
	});
	it('adds a final period only when missing', () => {
		expect(cleanAnswer('God is first')).toBe('God is first.');
		expect(cleanAnswer('Is it so?')).toBe('Is it so?');
		expect(cleanAnswer('He said "Amen."')).toBe('He said "Amen."');
	});
});

describe('fixOcr', () => {
	it('fixes whole words from the table only', () => {
		expect(fixOcr('Chrift and the Refurrection of fin')).toBe('Christ and the Resurrection of fin');
		expect(fixOcr('Chriftian')).toBe('Chriftian');
	});
});

describe('convertCatechism', () => {
	const entry = (n: number) => ({ Number: n, Question: `Q${n}?`, Answer: `A${n}` });
	it('converts entries and validates the count', () => {
		const raw = { Data: Array.from({ length: 107 }, (_, i) => entry(i + 1)) };
		const text = convertCatechism('wsc', raw);
		expect(text.questions[0]).toEqual({ n: 1, q: 'Q1?', a: 'A1.', proofs: [] });
		expect(() => convertCatechism('wsc', { Data: raw.Data.slice(1) })).toThrow(/107/);
	});
	it('falls back to AnswerWithProofs when Answer is empty', () => {
		const data = Array.from({ length: 107 }, (_, i) => entry(i + 1));
		data[0] = { ...data[0], Answer: '', AnswerWithProofs: 'Use[1] this[2].' } as never;
		expect(convertCatechism('wsc', { Data: data }).questions[0].a).toBe('Use this.');
	});
	it('rejects bad numbering and empty text', () => {
		const data = Array.from({ length: 107 }, (_, i) => entry(i + 1));
		expect(() =>
			convertCatechism('wsc', { Data: [{ ...data[0], Number: 5 }, ...data.slice(1)] })
		).toThrow();
		expect(() =>
			convertCatechism('wsc', { Data: [{ ...data[0], Answer: ' ' }, ...data.slice(1)] })
		).toThrow(/empty/);
	});
	it('keeps proofs as labels', () => {
		const data = Array.from({ length: 107 }, (_, i) => entry(i + 1));
		data[0] = {
			...data[0],
			Proofs: [{ Id: 1, References: ['Rom.11.36', 'Rom.11.36,Gen.3'] }]
		} as never;
		expect(convertCatechism('wsc', { Data: data }).questions[0].proofs).toEqual([
			'Romans 11:36',
			'Genesis 3'
		]);
	});
});
