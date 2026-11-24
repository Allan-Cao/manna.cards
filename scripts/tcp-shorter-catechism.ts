/**
 * Reads the Scripture proofs of the Westminster Shorter Catechism from the Text Creation
 * Partnership's transcription of a public-domain printing:
 *
 *   The Confession of Faith and Catechisms, agreed upon by the Assembly of Divines at Westminster
 *   (London: printed for Robert Bostock, [1649]), "The Shorter Catechism", pp. 153-176.
 *   EEBO-TCP A80320 (Wing C5760), keyed from the British Library copy. The TCP has dedicated the
 *   transcription to the public domain (CC0 1.0): https://github.com/textcreationpartnership/A80320
 *
 * The Assembly sent its proofs to Parliament in April 1648, and this printing sets them in the
 * margin beside each clause of the answer, as "1 Cor. 10 31. Rom. 11. 36". Only the proofs are
 * taken from it; the question and answer wording comes from Creeds.json as before.
 *
 * The catechism is cut out of the file (`sliceShorterCatechism`), read one question per
 * `<div type="question">` (`parseShorterCatechism`), corrected by the reviewed list
 * `WSC_PROOF_FIXES` (`fixNotes`) and turned into labels (`marginLabels`). Each fix must match
 * exactly once, and an illegible mark or a word that is not a book fails the build. All functions
 * here are pure.
 */
import { BOOKS, isSingleChapter } from '../src/lib/core/books.ts';
import type { Versification } from '../src/lib/core/model.ts';

const HEAD = /<head>THE SHORTER CATECHISM\b/;

/** The catechism's part of the TEI file: from its heading to the end of its `<div type="text">`. */
export function sliceShorterCatechism(xml: string): string {
	const head = HEAD.exec(xml);
	if (!head) throw new Error('Shorter Catechism: no "THE SHORTER CATECHISM" heading in the source');
	const rest = xml.slice(head.index);
	const next = /<div type="text">/.exec(rest);
	return next ? rest.slice(0, next.index) : rest;
}

const ENTITIES: Readonly<Record<string, string>> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'"
};

/**
 * Plain text of a TEI fragment: end-of-line hyphens joined, an illegible gap written "•", tags
 * dropped, entities decoded, long s as s and whitespace collapsed.
 */
export function teiText(fragment: string): string {
	return fragment
		.replace(/<g ref="char:EOLhyphen"\/>\s*/g, '')
		.replace(/<gap\b[^>]*>[\s\S]*?<\/gap>/g, '•')
		.replace(/<[^>]*>/g, '')
		.replace(/&([a-z]+);/g, (whole, name: string) => ENTITIES[name] ?? whole)
		.replaceAll('ſ', 's')
		.replace(/\s+/g, ' ')
		.replace(/ ([,;:.?!])/g, '$1')
		.trim();
}

export interface MarginEntry {
	/** The question as printed, for checking that it lines up with the text used. */
	q: string;
	/** The margin notes of the answer, one per marked clause, in order. */
	notes: string[];
}

/** The questions of the catechism, in order, each with the margin notes of its answer. */
export function parseShorterCatechism(xml: string): MarginEntry[] {
	const part = sliceShorterCatechism(xml);
	const entries: MarginEntry[] = [];
	for (const div of part.matchAll(/<div type="question">([\s\S]*?)<\/div>/g)) {
		const n = entries.length + 1;
		const body = div[1];
		const head = /<head>([\s\S]*?)<\/head>/.exec(body);
		const paragraphs = [...body.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1]);
		let q = head ? teiText(head[1]).replace(/^(?:QUESTION|Q)\.?\s*/, '') : '';
		// The first question is headed "QUESTION." and set in the paragraph after it.
		if (q === '' && paragraphs.length > 0) q = teiText(paragraphs.shift()!);
		const answer = paragraphs.map((p) => teiText(p.replace(/<note\b[\s\S]*?<\/note>/g, '')));
		if (q === '') throw new Error(`Shorter Catechism: question ${n} has no question`);
		if (!answer.some((a) => /^A\b/.test(a))) {
			throw new Error(`Shorter Catechism: question ${n} has no answer`);
		}
		const notes = [...body.matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)].map((m) => teiText(m[1]));
		entries.push({ q, notes });
	}
	return entries;
}

export type Fix = readonly [from: string, to: string];

/**
 * The notes of question `n` with its fixes applied, in order, to the notes joined by " | ". Each
 * fix must match exactly once.
 */
export function fixNotes(
	n: number,
	notes: readonly string[],
	fixes: Readonly<Record<number, readonly Fix[]>> = WSC_PROOF_FIXES
): string[] {
	const own = fixes[n];
	if (!own) return [...notes];
	let text = notes.join(' | ');
	for (const [from, to] of own) {
		const count = text.split(from).length - 1;
		if (count !== 1) {
			throw new Error(`Shorter Catechism question ${n}: the fix "${from}" matches ${count} times`);
		}
		text = text.replace(from, () => to);
	}
	return text.split(' | ');
}

/**
 * Corrections to the margin notes, by question. Matched against the notes after `teiText`, joined
 * by " | ". Each was checked against three other witnesses to the Assembly's proofs: the Edinburgh
 * printing of 1671 (EEBO-TCP A34242), the Church of Scotland's edition "with the Scripture-proofs
 * at large" (Glasgow, 1810; https://archive.org/details/confessionoffait00churrich) and the proof
 * list of the 1647 text commonly reproduced online. Only three kinds of error are corrected:
 * marks the TCP could not read ("•"), a reference that does not exist, and a misprint the other
 * witnesses agree on where the printed verse does not fit the clause. Where this printing simply
 * cites fewer verses than another edition (Q5 Deut. 6:4, Q35 Rom. 6:4), it stands.
 */
export const WSC_PROOF_FIXES: Readonly<Record<number, readonly Fix[]>> = {
	// "Psal. 73. 25, to the end" in the 1810 edition and the 1647 list.
	1: [['Psal 73 24,', 'Psal 73 25,']],
	// Mark 10:29-31 is on leaving house and lands; the sparrows of Matt. 10:29-31 are the proof.
	11: [['Mar. 10. 29', 'Mat. 10. 29']],
	// Illegible: "1 Cor."
	16: [['• Cor.', '1 Cor.']],
	// Illegible: "Rom. 5:10, to 20" (1810: "Rom. v. from Verse 10. to the 20.") and "Jam. 1:14, 15".
	18: [
		['Rom. 5 10 • 2•', 'Rom. 5 10 to 20'],
		['•am. 1. 14 •.', 'Jam. 1. 14, 15.']
	],
	// Romans 6 has 23 verses: "the wages of sin is death" is 6:23.
	19: [['Rom. 6. 29.', 'Rom. 6. 23.']],
	// John has 21 chapters: 20:31.
	24: [['and 29. 31', 'and 20. 31']],
	// Luke has 24 chapters: "Luk. 2. 7", the birth in a manger.
	27: [['Luk. 27', 'Luk. 2. 7']],
	// A lower-case roman numeral for the chapter.
	28: [['Eph. i. 20', 'Eph. 1. 20']],
	// Ephesians has 6 chapters: "Eph. 2. 8", saved through faith.
	30: [['Eph. 28', 'Eph. 2. 8']],
	// Illegible: "Rom. 8:30".
	32: [['Ro. 8 •0', 'Ro. 8 30']],
	// A lower-case "1"; and 1 Cor. 13:2 is on faith without love, 13:12 is seeing face to face.
	38: [
		['i Cor, 15 43', '1 Cor, 15 43'],
		['1 Cor. 13. 2', '1 Cor. 13. 12']
	],
	// The verse of the preface is missing (1810 and the 1647 list: Exod. 20:2), as Q45-Q81 cite theirs.
	43: [['Exod. 20', 'Exod. 20 2']],
	// Illegible: "Mal. 1:6, 7, 12; 2:2; 3:14".
	55: [['Mal. 1. 6 •, 12. & 2 •.', 'Mal. 1. 6, 7, 12. & 2. 2.']],
	// The fourth commandment is Deut. 5:12-14; Deut. 15:12-14 is on releasing servants.
	58: [['Deut. 15 12', 'Deut. 5 12']],
	// "Exod. 16:25-28" (26 printed twice) and "Neh. 13:15-19".
	60: [['27, 26 Neh. 13. 5 16,', '27, 28 Neh. 13. 15, 16,']],
	// Ezek. 22:26, the priests who "hid their eyes from my sabbaths"; 22:25 is on the prophets.
	61: [['Ezek. 22 25', 'Ezek. 22 26']],
	// The number of the book is missing: "1 Pet. 2:17", honour all men.
	64: [['| Pet. 2 17', '| 1 Pet. 2 17']],
	// A stray "5," before "Mat. 15:4-6", honour thy father and mother.
	65: [['Mat. 5, 15 4,', 'Mat. 15 4,']],
	// The note for the end of Q74's answer runs over the page break and was printed beside Q75; the
	// 1810 edition sets these under Q74, and the Larger Catechism (Q141) cites them for the same
	// duty of furthering others' wealth. "Exod. 2 3" is Exod. 23:4-5.
	74: [
		[
			'Gen. 30, 30. 1 Tim. 5, 8',
			'Gen. 30, 30. 1 Tim. 5, 8 Lev. 25, 35. Deut. 22, 1 2, 3, 4 5. Exod. 23 4, 5 Gen. 47, 14, 20'
		]
	],
	75: [['Lev. 25, 35. Deut. 22, 1 2, 3, 4 5. Exod. 2 3, 4, 5 Gen. 47, 14, 20 ', '']],
	// Illegible: "Jam. 3:2-13".
	82: [['•am 3.', 'Jam. 3.']],
	// Illegible: "Ezek."
	83: [['Ez•k', 'Ezek']],
	// Illegible: "Eph. 5:6"; and "Iam." here is Lamentations (3:39), not James.
	84: [
		['Eph, •. 6', 'Eph, 5. 6'],
		['Iam. 3 39', 'Lam. 3 39']
	],
	// Isa. 55:3, "incline your ear, and come unto me"; 59:3 is on hands defiled with blood.
	85: [['Isal. 59. 3', 'Isa. 55. 3']],
	// 2 Cor. 7:11, godly sorrow; 1 Cor. 7:11 is on a wife who departs.
	87: [['1 Cor. 7 11', '2 Cor. 7 11']],
	// 1 Cor. 12:13, "by one Spirit are we all baptized"; 12:23 is on the less honourable members.
	91: [['1 Cor. 12, 23', '1 Cor. 12, 13']],
	// Romans 6 has 23 verses and Galatians 2 has 21: Rom. 6:4 and Gal. 3:27, buried and baptized into Christ.
	94: [['Ro 6, 24 Gal. 2, 27', 'Ro 6, 4 Gal. 3, 27']],
	// Matt. 18:35, forgiving "from your hearts", as the answer says; 18:15 is on rebuking a brother.
	105: [['Mat 18. 15', 'Mat 18. 35']],
	// 2 Cor. 12:7-8, the thorn in the flesh; 12:1 is on glorying in visions.
	106: [['2 Cor 12. 1, 8', '2 Cor 12. 7, 8']]
};

/** The printing's book abbreviations, lower case without the point, to USFM codes. */
const BOOK_ABBREVIATIONS: Readonly<Record<string, string>> = {
	gen: 'GEN',
	ex: 'EXO',
	exo: 'EXO',
	exod: 'EXO',
	lev: 'LEV',
	deu: 'DEU',
	deut: 'DEU',
	neh: 'NEH',
	esther: 'EST',
	job: 'JOB',
	iob: 'JOB',
	ps: 'PSA',
	psa: 'PSA',
	psal: 'PSA',
	pro: 'PRO',
	prov: 'PRO',
	eccl: 'ECC',
	is: 'ISA',
	isa: 'ISA',
	isai: 'ISA',
	jer: 'JER',
	lam: 'LAM',
	eze: 'EZK',
	ezek: 'EZK',
	dan: 'DAN',
	joel: 'JOL',
	amos: 'AMO',
	mic: 'MIC',
	zach: 'ZEC',
	mal: 'MAL',
	mat: 'MAT',
	math: 'MAT',
	mar: 'MRK',
	mark: 'MRK',
	luk: 'LUK',
	luke: 'LUK',
	io: 'JHN',
	ioh: 'JHN',
	joh: 'JHN',
	john: 'JHN',
	act: 'ACT',
	acts: 'ACT',
	ro: 'ROM',
	rom: 'ROM',
	gal: 'GAL',
	eph: 'EPH',
	ephe: 'EPH',
	phil: 'PHP',
	col: 'COL',
	tit: 'TIT',
	heb: 'HEB',
	iam: 'JAS',
	jam: 'JAS',
	rev: 'REV'
};

/** Books printed with a number before them ("1 Cor."), by abbreviation, then number. */
const NUMBERED_BOOKS: Readonly<Record<string, readonly string[]>> = {
	sam: ['1SA', '2SA'],
	kin: ['1KI', '2KI'],
	kings: ['1KI', '2KI'],
	chro: ['1CH', '2CH'],
	cor: ['1CO', '2CO'],
	thes: ['1TH', '2TH'],
	thess: ['1TH', '2TH'],
	tim: ['1TI', '2TI'],
	pet: ['1PE', '2PE'],
	io: ['1JN', '2JN', '3JN'],
	ioh: ['1JN', '2JN', '3JN'],
	joh: ['1JN', '2JN', '3JN'],
	john: ['1JN', '2JN', '3JN']
};

/** Words that join or qualify references; anything else that is not a book fails. */
const IGNORED = new Set(['with', 'chap', 'throughout', 'title', 'v']);

const EN_DASH = '–';

interface Group {
	book: string;
	chapter: number | null;
	/** Verse ranges in this chapter, in the printed order. None means the whole chapter. */
	items: [number, number][];
}

/**
 * Labels for the margin notes of one answer, such as "Gen. 3. 6 7, 8, 13 Eccl. 7 29", deduplicated
 * in order. After a book the first number is the chapter and the rest are its verses; "and" or "&"
 * starts another chapter of the same book. Running verses become one range ("Genesis 3:6–8"),
 * others their own label, as with the other catechisms. "to 13" and "to the end" end a range, and
 * a chapter without verses ("Gen. 1. Chap:", "Ps. 110 throughout") is the whole chapter.
 * `versification` gives the end of a chapter.
 */
export function marginLabels(note: string, versification: Versification): string[] {
	const tokens = [...note.matchAll(/(\d+)(\s*)|([A-Za-z]+)|(&)|(•)/g)];
	const groups: Group[] = [];
	let current: Group | null = null;
	let newChapter = false;
	let pendingTo = false;
	const wordAt = (j: number) => tokens[j]?.[3]?.toLowerCase();

	const startBook = (book: string) => {
		current = { book, chapter: isSingleChapter(book) ? 1 : null, items: [] };
		groups.push(current);
		newChapter = false;
	};

	for (let i = 0; i < tokens.length; i++) {
		const [, number, space, word, amp, gap] = tokens[i];
		if (gap) throw new Error(`An illegible mark in "${note}"`);
		if (amp || word?.toLowerCase() === 'and') {
			newChapter = true;
			continue;
		}
		if (word) {
			const key = word.toLowerCase();
			if (IGNORED.has(key)) continue;
			if (key === 'to') {
				if (wordAt(i + 1) === 'the' && wordAt(i + 2) === 'end') {
					const g = current as Group | null;
					const last = g?.items.at(-1);
					if (!g || g.chapter === null || !last)
						throw new Error(`"to the end" with no verse in "${note}"`);
					const counts = versification[g.book];
					last[1] = counts[g.chapter - 1];
					i += 2;
				} else pendingTo = true;
				continue;
			}
			const id = BOOK_ABBREVIATIONS[key];
			if (!id) throw new Error(`Unknown book "${word}" in "${note}"`);
			startBook(id);
			continue;
		}
		// A number: a book's number ("1 Cor."), a chapter or a verse.
		const next = wordAt(i + 1);
		const numbered = next === undefined ? undefined : NUMBERED_BOOKS[next];
		const value = Number(number);
		if (numbered && space !== '' && value >= 1 && value <= numbered.length) {
			startBook(numbered[value - 1]);
			i++;
			continue;
		}
		const g = current as Group | null;
		if (!g) throw new Error(`A number before a book in "${note}"`);
		if (newChapter) {
			current = { book: g.book, chapter: value, items: [] };
			groups.push(current);
			newChapter = false;
		} else if (g.chapter === null) {
			g.chapter = value;
		} else if (pendingTo) {
			const last = g.items.at(-1);
			if (!last) throw new Error(`"to" with no verse in "${note}"`);
			last[1] = value;
		} else {
			g.items.push([value, value]);
		}
		pendingTo = false;
	}

	const labels: string[] = [];
	for (const { book, chapter, items } of groups) {
		const name = BOOKS.find((b) => b.id === book)!.name;
		if (chapter === null) throw new Error(`${name} without a chapter in "${note}"`);
		const single = isSingleChapter(book);
		const own: string[] = [];
		if (items.length === 0) own.push(`${name} ${chapter}`);
		const merged: [number, number][] = [];
		for (const [a, b] of items) {
			const last = merged.at(-1);
			if (last && a === last[1] + 1) last[1] = b;
			else merged.push([a, b]);
		}
		for (const [a, b] of merged) {
			const head = single ? `${name} ${a}` : `${name} ${chapter}:${a}`;
			own.push(b === a ? head : `${head}${EN_DASH}${b}`);
		}
		for (const label of own) if (!labels.includes(label)) labels.push(label);
	}
	return labels;
}
