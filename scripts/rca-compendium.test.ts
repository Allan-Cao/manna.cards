import { describe, expect, it } from 'vitest';
import {
	COMPENDIUM_FIXES,
	applyFixes,
	normaliseLines,
	parseCompendium,
	sliceCompendium,
	tidyReferences
} from './rca-compendium.ts';

describe('sliceCompendium', () => {
	const book = `I  desire  these  things  of  him.
COMPENDIUM.  27

A  COMPENDIUM

Question- 1.  How  many?
Answer.  Three.

When  those  who  are  inclined  to  become  members
THE  CONFESSION  OF  FAITH`;

	it('keeps the text from the title to the closing rubric', () => {
		const slice = sliceCompendium(book);
		expect(slice.startsWith('A  COMPENDIUM')).toBe(true);
		expect(slice).toContain('Answer.  Three.');
		expect(slice).not.toContain('When  those');
		expect(slice).not.toContain('desire');
	});
	it('fails when the title or the rubric is missing', () => {
		expect(() => sliceCompendium(book.replace('A  COMPENDIUM', 'A  COMPEND'))).toThrow(/title/);
		expect(() => sliceCompendium(book.replace('When  those', 'Then  those'))).toThrow(/end/);
	});
});

describe('normaliseLines', () => {
	it('trims lines, collapses runs of spaces and drops blank lines', () => {
		expect(normaliseLines('  Q.  2.  Whence  knowest \n\n   \nA.  Out  of \r\n')).toBe(
			'Q. 2. Whence knowest\nA. Out of'
		);
	});
});

describe('applyFixes', () => {
	it('replaces each text once', () => {
		expect(
			applyFixes('Q. IS. Shall all\nA. No.', [
				['Q. IS.', 'Q. 18.'],
				['No.', 'No:']
			])
		).toBe('Q. 18. Shall all\nA. No:');
	});
	it('fails when a fix matches nothing or more than once', () => {
		expect(() => applyFixes('a b', [['c', 'd']])).toThrow(/"c" matches 0 times/);
		expect(() => applyFixes('a a', [['a', 'b']])).toThrow(/"a" matches 2 times/);
	});
	it('applies the fixes in order, so a later one sees an earlier one', () => {
		expect(
			applyFixes('ab', [
				['a', 'x'],
				['xb', 'y']
			])
		).toBe('y');
	});
});

describe('tidyReferences', () => {
	it('closes up the space after a chapter colon', () => {
		expect(tidyReferences('Heb. 2: 17 and 4: 15, Acts 4:12')).toBe('Heb. 2:17 and 4:15, Acts 4:12');
	});
	it('leaves a colon before words alone', () => {
		expect(tidyReferences('Three: first')).toBe('Three: first');
	});
});

describe('parseCompendium', () => {
	const text = [
		'A COMPENDIUM',
		'OF THE LORD.',
		'Question 1. How many things are necessary for thee to know, that',
		'thou mayest live?',
		'Answer. Three: first, how great my sins and miseries are: the',
		'second, how I may be delivered.',
		'THE FIRST PART.',
		'Of the Misery of Man.',
		'Q. 2. Whence knowest thou thy misery?',
		'A. Out of the law of God, which he hath re-',
		'vealed, as follows:',
		'Exodus xx. I am the LORD thy God.',
		'I. Com. Thou shalt have no other gods',
		'before me.',
		'II. Thou shalt not make.',
		'COMPENDIUM. 29',
		'THE SECOND PART.',
		"Of Man's Deliverance.",
		'Q. 3. By what means?',
		'28 DOCTRINAL STANDARDS.',
		'A. By such a Mediator.'
	].join('\n');

	it('reads the questions and answers, joining wrapped and hyphenated lines', () => {
		const { entries } = parseCompendium(text);
		expect(entries.map((e) => e.n)).toEqual([1, 2, 3]);
		expect(entries[0]).toEqual({
			n: 1,
			q: 'How many things are necessary for thee to know, that thou mayest live?',
			a: 'Three: first, how great my sins and miseries are: the second, how I may be delivered.'
		});
		expect(entries[2]).toEqual({ n: 3, q: 'By what means?', a: 'By such a Mediator.' });
	});
	it('starts a new line for each commandment or article and for the Exodus heading', () => {
		expect(parseCompendium(text).entries[1].a).toBe(
			[
				'Out of the law of God, which he hath revealed, as follows:',
				'Exodus xx. I am the LORD thy God.',
				'I. Com. Thou shalt have no other gods before me.',
				'II. Thou shalt not make.'
			].join('\n')
		);
	});
	it('reads the parts as sections starting at their first question', () => {
		expect(parseCompendium(text).sections).toEqual([
			{ heading: 'Of the Misery of Man', first: 2 },
			{ heading: "Of Man's Deliverance", first: 3 }
		]);
	});
	it('fails on a question with no answer, or an answer with no question', () => {
		expect(() => parseCompendium('Q. 1. Why?\nQ. 2. How?\nA. So.')).toThrow(
			/question 1 has no answer/
		);
		expect(() => parseCompendium('Q. 1. Why?\nA. So.\nA. Again.')).toThrow(/second answer/);
	});
	it('fails on a part heading without its title, or with no question after it', () => {
		expect(() => parseCompendium('Q. 1. Why?\nA. So.\nTHE FIRST PART.')).toThrow(/FIRST PART/);
	});
});

describe('COMPENDIUM_FIXES', () => {
	it('changes something with every fix', () => {
		for (const [from, to] of COMPENDIUM_FIXES) expect(from).not.toBe(to);
	});
});
