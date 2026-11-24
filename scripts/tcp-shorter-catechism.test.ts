import { describe, expect, it } from 'vitest';
import { versificationFor } from '../src/lib/core/versification.ts';
import {
	WSC_PROOF_FIXES,
	fixNotes,
	marginLabels,
	parseShorterCatechism,
	sliceShorterCatechism,
	teiText
} from './tcp-shorter-catechism.ts';

const kjv = versificationFor('kjv');

/** A cut-down copy of the TCP file's shape: the Confession before, the catechism, a trailer after. */
const tei = `<TEI><text><body>
<div type="text"><head>THE CONFESSION</head><p>Of the holy Scripture <note n="a" place="margin">Rom. 1. 20</note>.</p></div>
<div type="text">
	<pb n="153" facs="tcp:170670:77"/>
	<head>THE SHORTER CATECHISM, Firſt agreed upon by the <hi>Aſſembly of Divines</hi> at WESTMINSTER.</head>
	<div type="question">
		<head>QUESTION.</head>
		<p>
			<hi>
				<seg rend="decorInit">W</seg>Hat is the chief end of man?</hi>
		</p>
		<p>
			<hi>A.</hi> Mans chief end is to glorifie God <note n="a" place="margin">1 Cor. 10 31. Rom. 11. 36</note>, and to enjoy him for ever <note n="b" place="margin">Pſal 73 24, to the end</note>.</p>
	</div>
	<div type="question">
		<head>Q. <hi>How doth God execute his decrees?</hi>
		</head>
		<p>A. God executeth his Decrees in the
<pb n="155" facs="tcp:170670:78"/> Works of Creation and Providence:</p>
	</div>
	<div type="question">
		<head>Q <hi>Did all mankinde fall in</hi> Adams <hi>firſt tranſ<g ref="char:EOLhyphen"/>greſſion?</hi>
		</head>
		<pb n="156" facs="tcp:170670:79"/>
		<p> A. The Covenant being made with <hi>Adam</hi> <hi>h.</hi>
			<note place="margin">Gen. 2. 16, 17 Rom 5 12 <gap reason="illegible" extent="1 letter"><desc>•</desc></gap> Cor. 15 21, 22</note>
		</p>
	</div>
	<trailer>FINIS.</trailer>
</div>
<div type="text"><head>THE DIRECTORY</head><p>Worship <note place="margin">Mat. 6. 9</note></p></div>
</body></text></TEI>`;

describe('sliceShorterCatechism', () => {
	it('keeps the catechism and nothing before or after it', () => {
		const slice = sliceShorterCatechism(tei);
		expect(slice.startsWith('<head>THE SHORTER CATECHISM')).toBe(true);
		expect(slice).toContain('FINIS.');
		expect(slice).not.toContain('Rom. 1. 20');
		expect(slice).not.toContain('Mat. 6. 9');
	});
	it('fails when the catechism heading is missing', () => {
		expect(() => sliceShorterCatechism(tei.replace('SHORTER', 'LARGER'))).toThrow(/heading/);
	});
});

describe('teiText', () => {
	it('drops tags, joins end-of-line hyphens and writes long s as s', () => {
		expect(teiText('tranſ<g ref="char:EOLhyphen"/>greſſion of <hi>Adam</hi>')).toBe(
			'transgression of Adam'
		);
	});
	it('marks an illegible gap with a bullet, decodes entities and collapses whitespace', () => {
		expect(
			teiText('2 Tim. 1 13. &amp; 3.\n 16 <gap reason="illegible"><desc>•</desc></gap> Cor.')
		).toBe('2 Tim. 1 13. & 3. 16 • Cor.');
	});
});

describe('parseShorterCatechism', () => {
	it('reads each question and the margin notes of its answer, in order', () => {
		expect(parseShorterCatechism(tei)).toEqual([
			{
				q: 'WHat is the chief end of man?',
				notes: ['1 Cor. 10 31. Rom. 11. 36', 'Psal 73 24, to the end']
			},
			{ q: 'How doth God execute his decrees?', notes: [] },
			{
				q: 'Did all mankinde fall in Adams first transgression?',
				notes: ['Gen. 2. 16, 17 Rom 5 12 • Cor. 15 21, 22']
			}
		]);
	});
	it('fails on a question without an answer', () => {
		const bare = tei.replace(/<p>A\. God executeth[\s\S]*?<\/p>/, '');
		expect(() => parseShorterCatechism(bare)).toThrow(/question 2 has no answer/);
	});
});

describe('fixNotes', () => {
	it('applies the fixes for a question, in order', () => {
		const notes = ['Gen. 2. 16, 17 Rom 5 12 • Cor. 15 21, 22'];
		expect(fixNotes(3, notes, { 3: [['• Cor.', '1 Cor.']] })).toEqual([
			'Gen. 2. 16, 17 Rom 5 12 1 Cor. 15 21, 22'
		]);
		expect(fixNotes(2, notes, { 3: [['• Cor.', '1 Cor.']] })).toEqual(notes);
	});
	it('fails when a fix matches nothing or more than once', () => {
		expect(() => fixNotes(1, ['Rom. 5 12'], { 1: [['Rom. 6', 'Rom. 5']] })).toThrow(
			/question 1: the fix "Rom. 6" matches 0 times/
		);
		expect(() => fixNotes(1, ['Ps. 1 1', 'Ps. 2 1'], { 1: [['Ps.', 'Psal.']] })).toThrow(
			/matches 2 times/
		);
	});
	it('has no fix for a question the catechism lacks', () => {
		expect(
			Object.keys(WSC_PROOF_FIXES)
				.map(Number)
				.every((n) => n >= 1 && n <= 107)
		).toBe(true);
	});
});

describe('marginLabels', () => {
	const labels = (note: string) => marginLabels(note, kjv);

	it('reads a book, a chapter and verses, with or without points between them', () => {
		expect(labels('1 Cor. 10 31. Rom. 11. 36')).toEqual(['1 Corinthians 10:31', 'Romans 11:36']);
		expect(labels('Deu. 6. 4 Jer. 10. 10')).toEqual(['Deuteronomy 6:4', 'Jeremiah 10:10']);
	});
	it('joins running verses into a range and keeps the others apart', () => {
		expect(labels('Job 11 7 8, 9')).toEqual(['Job 11:7–9']);
		expect(labels('Gen. 3. 6 7, 8, 13 Eccl. 7 29')).toEqual([
			'Genesis 3:6–8',
			'Genesis 3:13',
			'Ecclesiastes 7:29'
		]);
	});
	it('starts a new chapter of the same book after "and" or "&"', () => {
		expect(labels('2 Tim. 1 13. & 3. 16')).toEqual(['2 Timothy 1:13', '2 Timothy 3:16']);
		expect(labels('Heb. 2. 14, 16. and 10. 5')).toEqual([
			'Hebrews 2:14',
			'Hebrews 2:16',
			'Hebrews 10:5'
		]);
		expect(labels('Ro. 10. 13 14, 15, 16, 17. & 1 16')).toEqual(['Romans 10:13–17', 'Romans 1:16']);
	});
	it('reads whole chapters', () => {
		expect(labels('Gen. 1. Chap: Heb. 11. 3')).toEqual(['Genesis 1', 'Hebrews 11:3']);
		expect(labels('Exod. 20')).toEqual(['Exodus 20']);
		expect(labels('1 Cor. 15 25. Ps. 110 throughout.')).toEqual([
			'1 Corinthians 15:25',
			'Psalm 110'
		]);
		expect(labels('Ps 92. title')).toEqual(['Psalm 92']);
	});
	it('reads "to" ranges, and "to the end" of the chapter by the versification', () => {
		expect(labels('Mat. 12. 1, to 13')).toEqual(['Matthew 12:1–13']);
		expect(labels('Psal 73 25, to the end')).toEqual(['Psalm 73:25–28']);
		expect(labels('Pro. 2. 1, to 6. & 8. 33. to the end.')).toEqual([
			'Proverbs 2:1–6',
			'Proverbs 8:33–36'
		]);
	});
	it('reads "with" as a joiner and a single-chapter book by its verse', () => {
		expect(labels('Gen. 17 10. with Col. 2, 11 12.')).toEqual([
			'Genesis 17:10',
			'Colossians 2:11–12'
		]);
		expect(labels('Zach. 8, 16 3 John v. 12')).toEqual(['Zechariah 8:16', '3 John 12']);
	});
	it('drops a label given twice', () => {
		expect(labels('Mat. 28 19 Mat. 28. 19')).toEqual(['Matthew 28:19']);
	});
	it('fails on an illegible mark, an unknown word or a number before any book', () => {
		expect(() => labels('Rom 5 12 • Cor. 15 21')).toThrow(/illegible/);
		expect(() => labels('Xyz. 1 2')).toThrow(/Xyz/);
		expect(() => labels('12 Rom. 5 1')).toThrow(/before a book/);
		expect(() => labels('Rom.')).toThrow(/chapter/);
	});
});
