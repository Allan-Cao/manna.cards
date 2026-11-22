// Every passage text in this file is made up. It copies the shape of ESV API output (markers,
// indentation, blank lines) but none of its words: the ESV text is copyrighted.
import { describe, expect, it } from 'vitest';
import type { Reference, StoredVerse, Versification, VerseRef } from '../model.ts';
import {
	checkEsvLimits,
	esvBooks,
	esvId,
	esvMissing,
	esvQuery,
	esvRef,
	esvVersesNeeded,
	mergeEsvText,
	parseEsvResponse,
	type EsvResponse,
	type EsvText
} from './esv.ts';
import { passageFromBooks } from './static.ts';

const V: Versification = {
	PSA: [10, 12, 8, 8, ...Array<number>(114).fill(10), 176],
	MAT: [25, 23, 17, 25, 48, 34, 29, 34, 38, 42, 30, 50, 58, 36, 39, 28, 27],
	JHN: [51, 25, 36],
	PHM: [25],
	JUD: [25]
};

const r = (book: string, chapter: number, verse: number): VerseRef => ({ book, chapter, verse });

function ref(book: string, sc: number, sv: number, ec: number, ev: number, label = 'x'): Reference {
	return { label, ranges: [{ start: r(book, sc, sv), end: r(book, ec, ev) }] };
}

/** One passage response, as the proxy passes it on. */
function response(parsed: [number, number][], passages: string[]): EsvResponse {
	return { query: 'q', canonical: 'c', parsed, passage_meta: [], passages };
}

/** The verses of a parsed response, by "c:v". */
function verses(text: EsvText): Record<string, StoredVerse> {
	const out: Record<string, StoredVerse> = {};
	for (const [id, v] of Object.entries(text.verses)) {
		const { chapter, verse } = esvRef(Number(id));
		out[`${chapter}:${verse}`] = v;
	}
	return out;
}

describe('esvId / esvRef', () => {
	it('converts between a verse and its 8-digit id, books in Protestant order', () => {
		expect(esvId(r('PSA', 3, 1))).toBe(19003001);
		expect(esvId(r('GEN', 1, 1))).toBe(1001001);
		expect(esvId(r('REV', 22, 21))).toBe(66022021);
		expect(esvRef(43001051)).toEqual(r('JHN', 1, 51));
		expect(esvRef(57001003)).toEqual(r('PHM', 1, 3));
	});
});

describe('esvVersesNeeded', () => {
	it('lists every verse of every range once, in order of first use, across chapters', () => {
		const refs = [
			ref('JHN', 1, 50, 2, 2),
			ref('PSA', 3, 1, 3, 2),
			ref('JHN', 2, 1, 2, 3) // overlaps the first
		];
		expect(esvVersesNeeded(refs, V)).toEqual([
			r('JHN', 1, 50),
			r('JHN', 1, 51),
			r('JHN', 2, 1),
			r('JHN', 2, 2),
			r('PSA', 3, 1),
			r('PSA', 3, 2),
			r('JHN', 2, 3)
		]);
	});

	it('adds no verse outside the references: a lead-in only comes from inside its range', () => {
		const refs: Reference[] = [
			{
				label: 'John 2:2, 3:5',
				ranges: [
					{ start: r('JHN', 2, 2), end: r('JHN', 2, 2) },
					{ start: r('JHN', 3, 5), end: r('JHN', 3, 5) }
				]
			}
		];
		expect(esvVersesNeeded(refs, V)).toEqual([r('JHN', 2, 2), r('JHN', 3, 5)]);
	});
});

describe('checkEsvLimits', () => {
	const range = (book: string, chapter: number, from: number, to: number) =>
		Array.from({ length: to - from + 1 }, (_, i) => r(book, chapter, from + i));

	it('accepts a deck within both limits', () => {
		expect(checkEsvLimits(range('JHN', 1, 1, 51), V)).toEqual([]);
	});

	it('rejects more than 500 verses in all', () => {
		const many = Array.from({ length: 51 }, (_, c) => range('PSA', c + 5, 1, 10)).flat();
		expect(many).toHaveLength(510);
		expect(checkEsvLimits(many, V)).toEqual([
			'ESV decks are limited to 500 verses, and this one shows 510 (including lead-in verses).'
		]);
	});

	it('allows exactly 500 verses', () => {
		const many = Array.from({ length: 50 }, (_, c) => range('PSA', c + 5, 1, 10)).flat();
		expect(checkEsvLimits(many, V)).toEqual([]);
	});

	it('rejects more than half of a book, rounding the half down, short books included', () => {
		// Jude has 25 verses here, so at most 12.
		expect(checkEsvLimits(range('JUD', 1, 1, 12), V)).toEqual([]);
		expect(checkEsvLimits([...range('JUD', 1, 1, 13), r('JHN', 1, 1)], V)).toEqual([
			'ESV decks may include at most half of a book: Jude has 25 verses, so at most 12; this deck shows 13.'
		]);
	});

	it('names the Psalms in the plural and reports every failure', () => {
		// 1354 verses in this versification's Psalms, so at most 677.
		const psalms = Array.from({ length: 70 }, (_, c) => range('PSA', c + 5, 1, 10)).flat();
		expect(checkEsvLimits(psalms, V)).toEqual([
			'ESV decks are limited to 500 verses, and this one shows 700 (including lead-in verses).',
			'ESV decks may include at most half of a book: Psalms has 1354 verses, so at most 677; this deck shows 700.'
		]);
	});

	it('counts a verse listed twice once', () => {
		expect(checkEsvLimits([...range('JUD', 1, 1, 12), r('JUD', 1, 1)], V)).toEqual([]);
	});
});

describe('esvQuery', () => {
	it('joins contiguous verses into per-chapter id ranges, in id order', () => {
		const vs = [r('JHN', 2, 1), r('JHN', 1, 51), r('JHN', 2, 2), r('PSA', 3, 1), r('JHN', 2, 5)];
		expect(esvQuery(vs)).toEqual([
			'19003001-19003001,43001051-43001051,43002001-43002002,43002005-43002005'
		]);
	});

	it('returns nothing for no verses, and drops duplicates', () => {
		expect(esvQuery([])).toEqual([]);
		expect(esvQuery([r('JUD', 1, 3), r('JUD', 1, 3)])).toEqual(['65001003-65001003']);
	});

	it('keeps each query to 500 verses, splitting a long range', () => {
		const before = Array.from({ length: 40 }, (_, c) =>
			Array.from({ length: 10 }, (_, i) => r('PSA', c + 5, i + 1))
		).flat();
		const long = Array.from({ length: 176 }, (_, i) => r('PSA', 119, i + 1));
		const qs = esvQuery([...long, ...before]);
		expect(qs).toHaveLength(2);
		expect(qs[0].split(',')).toHaveLength(41);
		expect(qs[0].split(',').at(-1)).toBe('19119001-19119100');
		expect(qs[1]).toBe('19119101-19119176');
	});
});

describe('parseEsvResponse', () => {
	it('reads a psalm: superscription as title, poetry indents, Selah on its own line, stanzas', () => {
		const text = parseEsvResponse(
			response(
				[[19003001, 19003003]],
				[
					'A Song of Asaph, when he sang by the river.\n\n' +
						'    [1] O Lord, how bright are the hills!\n' +
						'        Bright are the hills before me;\n' +
						'    [2] the hills are saying of my heart,\n' +
						'        “There is a song for him in the morning.” Selah\n' +
						'    \n' +
						'    \n' +
						'    [3] But you, O Lord, are a lamp beside me,\n' +
						'        my light, and the keeper of my path.\n' +
						'    \n\n'
				]
			)
		);
		expect(verses(text)).toEqual({
			'3:1': {
				v: 1,
				title: 'A Song of Asaph, when he sang by the river.',
				lines: [
					{ text: 'O Lord, how bright are the hills!', indent: 0, paragraph: true },
					{ text: 'Bright are the hills before me;', indent: 1 }
				]
			},
			'3:2': {
				v: 2,
				lines: [
					{ text: 'the hills are saying of my heart,', indent: 0 },
					{ text: '“There is a song for him in the morning.”', indent: 1 },
					{ text: 'Selah', indent: 0, selah: true }
				]
			},
			'3:3': {
				v: 3,
				lines: [
					{ text: 'But you, O Lord, are a lamp beside me,', indent: 0, paragraph: true },
					{ text: 'my light, and the keeper of my path.', indent: 1 }
				]
			}
		});
		expect(text.covered).toEqual([[19003001, 19003003]]);
	});

	it('reads prose: several verses on a paragraph line, each its own line', () => {
		const text = parseEsvResponse(
			response(
				[[43001001, 43001003]],
				[
					'  [1] At the start was the Song, and the Song was sung. [2] It was sung at the start.\n\n  [3] All things were sung.\n\n'
				]
			)
		);
		expect(verses(text)).toEqual({
			'1:1': {
				v: 1,
				lines: [
					{ text: 'At the start was the Song, and the Song was sung.', indent: 0, paragraph: true }
				]
			},
			'1:2': { v: 2, lines: [{ text: 'It was sung at the start.', indent: 0 }] },
			'1:3': { v: 3, lines: [{ text: 'All things were sung.', indent: 0, paragraph: true }] }
		});
	});

	it('does not mark a passage that starts mid-chapter as a new paragraph', () => {
		const text = parseEsvResponse(
			response(
				[[40017020, 40017022]],
				['  [20] He spoke to them.\n\n  [22] As they walked on,\n\n']
			)
		);
		expect(verses(text)).toEqual({
			'17:20': { v: 20, lines: [{ text: 'He spoke to them.', indent: 0 }] },
			'17:22': { v: 22, lines: [{ text: 'As they walked on,', indent: 0, paragraph: true }] }
		});
		expect(text.covered).toEqual([[40017020, 40017022]]);
	});

	it('moves to the next chapter when the verse number starts again', () => {
		const text = parseEsvResponse(
			response(
				[[43001051, 43002002]],
				[
					'  [51] And he said, “You will see.”\n\n  [1] On the third day there was a feast. [2] They came too.\n\n'
				]
			)
		);
		expect(Object.keys(text.verses).map(Number)).toEqual([43001051, 43002001, 43002002]);
		expect(text.verses[43002001].lines[0]).toEqual({
			text: 'On the third day there was a feast.',
			indent: 0,
			paragraph: true
		});
	});

	it('keeps an unmarked paragraph with the verse before it, and a verse starting mid-line', () => {
		const text = parseEsvResponse(
			response(
				[[57001001, 57001003]],
				[
					'  [1] Tobit, a worker of wood, and Ezra our friend,\n\n' +
						'  To Dorcas our dear fellow sailor [2] and Lydia our sister:\n\n' +
						'  [3] Peace to you.\n\n'
				]
			)
		);
		expect(verses(text)).toEqual({
			'1:1': {
				v: 1,
				lines: [
					{ text: 'Tobit, a worker of wood, and Ezra our friend,', indent: 0, paragraph: true },
					{ text: 'To Dorcas our dear fellow sailor', indent: 0, paragraph: true }
				]
			},
			'1:2': { v: 2, lines: [{ text: 'and Lydia our sister:', indent: 0 }] },
			'1:3': { v: 3, lines: [{ text: 'Peace to you.', indent: 0, paragraph: true }] }
		});
	});

	it('keeps unmarked poetry lines with their verse, at their indent', () => {
		const text = parseEsvResponse(
			response(
				[[23053004, 23053005]],
				[
					'    [4] Surely he has lifted our loads\n' +
						'        and carried our bags;\n' +
						'    yet we thought him idle,\n' +
						'        resting by the road, and asleep.\n' +
						'    [5] But he was walking ahead,\n' +
						'            far ahead.\n' +
						'    \n\n'
				]
			)
		);
		expect(text.verses[23053004].lines.map((l) => [l.indent, l.text])).toEqual([
			[0, 'Surely he has lifted our loads'],
			[1, 'and carried our bags;'],
			[0, 'yet we thought him idle,'],
			[1, 'resting by the road, and asleep.']
		]);
		expect(text.verses[23053005].lines.map((l) => l.indent)).toEqual([0, 2]);
	});

	it('sets the far-right "declares" and doxology lines at indent 2', () => {
		const text = parseEsvResponse(
			response(
				[[24001008, 24001008]],
				[
					'    [8] Do not fear the wind,\n    for I am with you,\n' +
						' '.repeat(44) +
						'says the keeper.”\n    \n\n'
				]
			)
		);
		expect(text.verses[24001008].lines.map((l) => [l.indent, l.text])).toEqual([
			[0, 'Do not fear the wind,'],
			[0, 'for I am with you,'],
			[2, 'says the keeper.”']
		]);
	});

	it('keeps a Selah after other words on the line, and a superscription mid-passage', () => {
		const text = parseEsvResponse(
			response(
				[[19003008, 19004001]],
				[
					'    [8] Rest belongs to the Lord;\n' +
						'        the snares of the field. Higgaion. Selah\n' +
						'    \n    \n' +
						'    To the singer: with flutes. A Song of Asaph.\n\n' +
						'    [1] Hear me when I sing!\n' +
						'    \n\n'
				]
			)
		);
		expect(text.verses[19003008].lines).toEqual([
			{ text: 'Rest belongs to the Lord;', indent: 0 },
			{ text: 'the snares of the field. Higgaion.', indent: 1 },
			{ text: 'Selah', indent: 0, selah: true }
		]);
		expect(text.verses[19004001]).toEqual({
			v: 1,
			title: 'To the singer: with flutes. A Song of Asaph.',
			lines: [{ text: 'Hear me when I sing!', indent: 0, paragraph: true }]
		});
	});

	it('drops headings that are not superscriptions: acrostic letters and textual notes', () => {
		const text = parseEsvResponse(
			response(
				[
					[19119001, 19119002],
					[19119008, 19119009],
					[41016008, 41016009]
				],
				[
					'Aleph\n\n    [1] Happy are those who walk,\n    [2] Happy are those who run,\n    \n\n',
					'    [8] I will keep walking;\n    \n    \n    Beth\n\n    [9] How shall a child walk?\n    \n\n',
					'  [8] They ran from the field.\n\n[Some old copies stop at 16:8.]\n\n  [[[9] Now when the day came, he spoke.\n\n'
				]
			)
		);
		expect(text.verses[19119001]).toEqual({
			v: 1,
			lines: [{ text: 'Happy are those who walk,', indent: 0, paragraph: true }]
		});
		expect(text.verses[19119008].lines).toEqual([{ text: 'I will keep walking;', indent: 0 }]);
		expect(text.verses[19119009]).toEqual({
			v: 9,
			lines: [{ text: 'How shall a child walk?', indent: 0, paragraph: true }]
		});
		// The double bracket that opens a disputed passage belongs to the verse after it.
		expect(text.verses[41016008].lines).toEqual([{ text: 'They ran from the field.', indent: 0 }]);
		expect(text.verses[41016009].lines).toEqual([
			{ text: '[[Now when the day came, he spoke.', indent: 0, paragraph: true }
		]);
		expect(text.covered).toEqual([
			[19119001, 19119002],
			[19119008, 19119009],
			[41016008, 41016009]
		]);
	});

	it('keeps a prose verse that goes on as poetry together', () => {
		const text = parseEsvResponse(
			response(
				[[23006003, 23006003]],
				[
					'  [3] And one called out and said:\n\n    “Sing, sing, sing to the Lord;\n    all the hills are glad!”\n    \n\n'
				]
			)
		);
		expect(text.verses[23006003].lines).toEqual([
			{ text: 'And one called out and said:', indent: 0 },
			{ text: '“Sing, sing, sing to the Lord;', indent: 0, paragraph: true },
			{ text: 'all the hills are glad!”', indent: 0 }
		]);
	});

	it('handles an empty response', () => {
		expect(parseEsvResponse(response([], []))).toEqual({ verses: {}, covered: [] });
	});
});

describe('mergeEsvText / esvMissing / esvBooks', () => {
	const a = parseEsvResponse(
		response([[40017020, 40017022]], ['  [20] He spoke.\n\n  [22] They walked.\n\n'])
	);
	const b = parseEsvResponse(response([[40017023, 40017023]], ['  [23] They slept.\n\n']));
	const c = parseEsvResponse(response([[43003016, 43003016]], ['  [16] Light came.\n\n']));

	it('combines verses and covered ranges, joining adjacent ranges', () => {
		const m = mergeEsvText(c, a, b);
		expect(Object.keys(m.verses).map(Number)).toEqual([40017020, 40017022, 40017023, 43003016]);
		expect(m.covered).toEqual([
			[40017020, 40017023],
			[43003016, 43003016]
		]);
		expect(mergeEsvText()).toEqual({ verses: {}, covered: [] });
	});

	it('lists the needed verses that no response has covered, omitted verses counting as covered', () => {
		const m = mergeEsvText(a, b);
		expect(esvMissing([r('MAT', 17, 21), r('MAT', 17, 24), r('JHN', 3, 16)], m)).toEqual([
			r('MAT', 17, 24),
			r('JHN', 3, 16)
		]);
	});

	it('gives books passageFromBooks can read with the versification, omitting absent verses', () => {
		const books = esvBooks(mergeEsvText(a, b, c));
		expect(Object.keys(books)).toEqual(['MAT', 'JHN']);
		expect(books.MAT.translation).toBe('esv');
		expect(books.MAT.chapters).toHaveLength(17);
		expect(books.MAT.chapters[0]).toEqual([]);
		const p = passageFromBooks(ref('MAT', 17, 20, 17, 21), 'esv', books, V);
		expect(p.verses.map((v) => [v.ref.verse, v.omitted ?? false])).toEqual([
			[20, false],
			[21, true]
		]);
		const across = passageFromBooks(ref('JHN', 2, 25, 3, 16), 'esv', books, V);
		expect(across.verses).toHaveLength(17);
		expect(across.verses.at(-1)?.lines[0].text).toBe('Light came.');
	});

	it('still rejects a range past the end of the chapter', () => {
		const books = esvBooks(a);
		expect(() => passageFromBooks(ref('MAT', 17, 20, 17, 28), 'esv', books, V)).toThrow(/verse 28/);
	});
});
