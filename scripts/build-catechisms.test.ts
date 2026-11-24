import { describe, expect, it } from 'vitest';
import { BOOKS } from '../src/lib/core/books.ts';
import {
	OSIS_TO_USFM,
	cleanAnswer,
	cleanAnswerLines,
	cleanQuestion,
	convertCatechism,
	convertCompendium,
	convertFairview,
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
	it('removes space before punctuation', () => {
		expect(cleanAnswer('The work of creation , is good ; and right : yes .')).toBe(
			'The work of creation, is good; and right: yes.'
		);
		expect(cleanAnswer('Is it so ? Yes !')).toBe('Is it so? Yes!');
	});
	it('adds a final period only when missing', () => {
		expect(cleanAnswer('God is first')).toBe('God is first.');
		expect(cleanAnswer('Is it so?')).toBe('Is it so?');
		expect(cleanAnswer('He said "Amen."')).toBe('He said "Amen."');
	});
});

describe('cleanAnswerLines', () => {
	it('cleans each line, keeps the line breaks and ends the last line with punctuation', () => {
		expect(
			cleanAnswerLines('That  is  so ,  as  follows :\nI. Thou  shalt\nII. Thou  shalt  not')
		).toBe('That is so, as follows:\nI. Thou shalt\nII. Thou shalt not.');
	});
});

describe('cleanQuestion', () => {
	it('collapses whitespace and removes space before punctuation', () => {
		expect(cleanQuestion('  What is  sin ,  and transgression ? ')).toBe(
			'What is sin, and transgression?'
		);
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

describe('convertFairview', () => {
	const small = {
		id: 'bcc' as const,
		short: 'BCC',
		name: 'Small',
		count: 3,
		credit: 'Small, used by permission.',
		sections: [
			{ heading: 'Start', first: 1 },
			{ heading: 'Ten Things', first: 3 }
		]
	};
	const qa = (n: number, q: string, a: string) =>
		`<h5 class="wp-block-heading">${n}. ${q}</h5>\n<p class="wp-block-paragraph">${a}</p>`;
	const page = (
		questions: string[],
		headings = ['Questions about Start', 'Questions about the 10 Things']
	) =>
		`<article><h4>${headings[0]}</h4><p><a href="#toc">Back to Contents</a></p>
${questions.slice(0, 2).join('\n')}
<h5><span>${headings[1]}</span></h5>
${questions.slice(2).join('\n')}
</article>`;
	const good = [
		qa(1, 'Who made you?', 'God made me. (Gen 2:7, 21-22)'),
		qa(2, 'What&#8217;s next?', 'God&#8217;s &#8220;word&#8221;. (Rom 6:3-4).'),
		qa(3, 'How many?', 'Six.')
	];

	it('converts questions, answers and proofs, crediting the source', () => {
		expect(convertFairview(page(good), small, [3])).toEqual({
			id: 'bcc',
			source: 'Small, used by permission.',
			questions: [
				{
					n: 1,
					q: 'Who made you?',
					a: 'God made me.',
					proofs: ['Genesis 2:7', 'Genesis 2:21–22']
				},
				{ n: 2, q: "What's next?", a: 'God\'s "word".', proofs: ['Romans 6:3–4'] },
				{ n: 3, q: 'How many?', a: 'Six.', proofs: [] }
			]
		});
	});
	it('rejects a wrong count or numbering', () => {
		expect(() => convertFairview(page(good), { ...small, count: 4 }, [3])).toThrow(/expected 4/);
		const skipped = [good[0], qa(3, 'Two?', 'Yes. (Gen 1:1)'), good[2]];
		expect(() => convertFairview(page(skipped), small, [3])).toThrow(/numbered 3/);
	});
	it('rejects a missing or unexpected proof list', () => {
		expect(() => convertFairview(page(good), small, [])).toThrow(/question 3 has no proof/);
		expect(() => convertFairview(page(good), small, [2, 3])).toThrow(/question 2 has proofs/);
	});
	it('rejects an unknown book', () => {
		const bad = [good[0], qa(2, 'Q?', 'A. (Hezek 1:1)'), good[2]];
		expect(() => convertFairview(page(bad), small, [3])).toThrow(/Hezek/);
	});
	it('rejects sections that start elsewhere than the registry says', () => {
		const moved = { ...small, sections: [small.sections[0], { heading: 'Ten Things', first: 2 }] };
		expect(() => convertFairview(page(good), moved, [3])).toThrow(/sections/);
	});
});

describe('convertCompendium', () => {
	const small = {
		id: 'hsc' as const,
		short: 'HSC',
		name: 'Small',
		count: 3,
		credit: 'Small, public domain.',
		sections: [
			{ heading: 'Introduction', first: 1 },
			{ heading: 'Misery', first: 2 }
		]
	};
	const book = (q3 = 'Q.  3.  How  then ?') => `Psalms
A  COMPENDIUM
OF  THE  LORD.
Question  1.  How  many  things  are  necessary ?
Answer.  Three :  first,  how  great  my  sins  are

THE  FIRST  PART.
Of  the  Misery  of  Man.
Q.  2.  Whence  knowest  thou  it?
A.  Out  of  the  law,  Heb.  2 :  17,  as  follows :
I.  Com.  Thou  shalt  have  no  other  gods.
COMPENDIUM.  29
${q3}
A.  Thus.
When  those  who  are  inclined  to  become  members
CONFESSION`;

	it('reads the Compendium, keeping line breaks in lists and tidying references', () => {
		expect(convertCompendium(book(), small, [])).toEqual({
			id: 'hsc',
			source: 'Small, public domain.',
			questions: [
				{
					n: 1,
					q: 'How many things are necessary?',
					a: 'Three: first, how great my sins are.',
					proofs: []
				},
				{
					n: 2,
					q: 'Whence knowest thou it?',
					a: 'Out of the law, Heb. 2:17, as follows:\nI. Com. Thou shalt have no other gods.',
					proofs: []
				},
				{ n: 3, q: 'How then?', a: 'Thus.', proofs: [] }
			]
		});
	});
	it('applies the fixes it is given', () => {
		const fixed = convertCompendium(book('Q.  S.  How  then ?'), small, [['Q. S.', 'Q. 3.']]);
		expect(fixed.questions[2].n).toBe(3);
	});
	it('rejects a wrong count or numbering', () => {
		expect(() => convertCompendium(book(), { ...small, count: 4 }, [])).toThrow(/expected 4/);
		expect(() => convertCompendium(book('Q.  4.  How  then ?'), small, [])).toThrow(/numbered 4/);
	});
	it('rejects parts that start elsewhere than the registry says', () => {
		const moved = { ...small, sections: [small.sections[0], { heading: 'Misery', first: 3 }] };
		expect(() => convertCompendium(book(), moved, [])).toThrow(/sections/);
	});
});
