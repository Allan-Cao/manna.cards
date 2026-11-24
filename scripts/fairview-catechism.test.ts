import { describe, expect, it } from 'vitest';
import { BOOKS } from '../src/lib/core/books.ts';
import {
	FAIRVIEW_BOOKS,
	htmlText,
	parseFairviewHtml,
	proofLabels,
	splitProof,
	straightenQuotes
} from './fairview-catechism.ts';

describe('FAIRVIEW_BOOKS', () => {
	it('maps every abbreviation onto a known book', () => {
		const ids = new Set(BOOKS.map((b) => b.id));
		for (const id of Object.values(FAIRVIEW_BOOKS)) expect(ids.has(id)).toBe(true);
	});
	it('reads Ez as Ezekiel and Ecc as Ecclesiastes', () => {
		expect(FAIRVIEW_BOOKS['Ez']).toBe('EZK');
		expect(FAIRVIEW_BOOKS['Ecc']).toBe('ECC');
	});
});

describe('htmlText', () => {
	it('strips tags, decodes entities and collapses spaces, including non-breaking ones', () => {
		expect(htmlText('<span style="x">Cross &#038; Crown</span>&nbsp;(John&nbsp;15:5)')).toBe(
			'Cross & Crown (John 15:5)'
		);
		expect(htmlText('God&#8217;s &#8220;word&#8221; &hellip; &amp; &lt;b&gt;')).toBe(
			'God’s “word” … & <b>'
		);
		expect(htmlText('a\u00a0 \n b')).toBe('a b');
	});
});

describe('straightenQuotes', () => {
	it('uses straight apostrophes and quotes, like the other catechisms', () => {
		expect(straightenQuotes('God’s ‘own’ “word”')).toBe(`God's 'own' "word"`);
	});
});

describe('splitProof', () => {
	it('takes the final parenthesised list as the proof', () => {
		expect(splitProof('God made me. (Gen 1:27)')).toEqual({
			answer: 'God made me.',
			proof: 'Gen 1:27'
		});
	});
	it('allows a period after the parenthesis', () => {
		expect(splitProof('Baptism is so. (Rom 6:3-4).')).toEqual({
			answer: 'Baptism is so.',
			proof: 'Rom 6:3-4'
		});
	});
	it('has no proof when the answer does not end with one', () => {
		expect(splitProof('Six.')).toEqual({ answer: 'Six.', proof: null });
	});
});

describe('proofLabels', () => {
	it('labels a verse with the full book name', () => {
		expect(proofLabels('Gen 1:27')).toEqual(['Genesis 1:27']);
		expect(proofLabels('Ps 119:11')).toEqual(['Psalm 119:11']);
		expect(proofLabels('1 John 3:4')).toEqual(['1 John 3:4']);
		expect(proofLabels('Ez 36:26-27')).toEqual(['Ezekiel 36:26–27']);
	});
	it('labels ranges with an en dash, across chapters too', () => {
		expect(proofLabels('Jer 23:23-24')).toEqual(['Jeremiah 23:23–24']);
		expect(proofLabels('Rom 8:38-9:2')).toEqual(['Romans 8:38–9:2']);
	});
	it('keeps part-verse letters', () => {
		expect(proofLabels('1 John 2:4-5a')).toEqual(['1 John 2:4–5a']);
		expect(proofLabels('Rom 5:19a')).toEqual(['Romans 5:19a']);
		expect(proofLabels('Mark 1:14b-15')).toEqual(['Mark 1:14b–15']);
	});
	it('joins further letters of the same verse onto it', () => {
		expect(proofLabels('Matt 6:10b,c')).toEqual(['Matthew 6:10bc']);
	});
	it('splits comma lists into one label each, carrying the chapter', () => {
		expect(proofLabels('John 3:3,5')).toEqual(['John 3:3', 'John 3:5']);
		expect(proofLabels('Gen 2:7, 21-22')).toEqual(['Genesis 2:7', 'Genesis 2:21–22']);
		expect(proofLabels('Gen 2:7, 3:1')).toEqual(['Genesis 2:7', 'Genesis 3:1']);
	});
	it('splits books on semicolons and dedupes in order', () => {
		expect(proofLabels('Matt 28:19; 1 Cor 11:24-26; Matt 28:19')).toEqual([
			'Matthew 28:19',
			'1 Corinthians 11:24–26'
		]);
	});
	it('labels a whole chapter', () => {
		expect(proofLabels('Gen 3')).toEqual(['Genesis 3']);
	});
	it('drops the chapter of single-chapter books', () => {
		expect(proofLabels('Jude 5')).toEqual(['Jude 5']);
		expect(proofLabels('Jude 1:5-7')).toEqual(['Jude 5–7']);
	});
	it('reads non-breaking spaces as spaces', () => {
		expect(proofLabels('1\u00a0Chron 29:20-22')).toEqual(['1 Chronicles 29:20–22']);
	});
	it('throws on an unknown book or an unreadable reference', () => {
		expect(() => proofLabels('Hezek 1:1')).toThrow(/Hezek/);
		expect(() => proofLabels('Gen 1:')).toThrow();
		expect(() => proofLabels('Gen 1:2-')).toThrow();
		expect(() => proofLabels('')).toThrow();
	});
});

const page = (body: string) => `<html><body>
<h1>Children&#8217;s Catechism</h1>
<p>Not part of the article.</p>
<article>
<h3 id="tableofcontents">Contents</h3>
<p><a href="#section1">Questions about God (1-2)</a><br><a href="#section2">Questions about the Ten Things (3)</a></p>
<p>The introduction.</p>
${body}
</article>
<footer><p>Share this page</p></footer>
</body></html>`;

describe('parseFairviewHtml', () => {
	const body = `
<h4 id="section1">Questions about God</h4>
<p><a href="#tableofcontents">Back to Contents</a></p>
<h5>1. Who made you?</h5>
<p>God made me. (Gen&nbsp;1:27)</p>
<h5>2. What&#8217;s next?</h5>
<p>That God&#8217;s name be honored.</p>
<p>(Ps 145:21)</p>
<h5><span style="color: revert">Questions about the 10 Things</span></h5>
<p><a href="#tableofcontents">Back to Contents</a></p>
<h5>3. How many?</h5>
<p>Six.</p>
<p><a href="#tableofcontents">Back to Contents</a></p>`;

	it('reads numbered questions with their answer paragraphs, skipping navigation', () => {
		expect(parseFairviewHtml(page(body)).entries).toEqual([
			{ n: 1, q: 'Who made you?', body: 'God made me. (Gen 1:27)' },
			{ n: 2, q: 'What’s next?', body: 'That God’s name be honored. (Ps 145:21)' },
			{ n: 3, q: 'How many?', body: 'Six.' }
		]);
	});
	it('reports the section headings in the body and where they start', () => {
		expect(parseFairviewHtml(page(body)).sections).toEqual([
			{ heading: 'Questions about God', first: 1 },
			{ heading: 'Questions about the 10 Things', first: 3 }
		]);
	});
	it('fails without an article, or on text outside a question', () => {
		expect(() => parseFairviewHtml('<p>nothing</p>')).toThrow(/article/);
		expect(() =>
			parseFairviewHtml(page(`<h5>1. Q?</h5><p>A.</p><h4>Section</h4><p>Stray text.</p>`))
		).toThrow(/Stray text/);
	});
	it('fails on a question without an answer', () => {
		expect(() => parseFairviewHtml(page(`<h5>1. Q?</h5><h5>2. R?</h5><p>A.</p>`))).toThrow(
			/question 1/
		);
	});
});
