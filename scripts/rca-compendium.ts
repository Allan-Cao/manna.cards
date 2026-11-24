/**
 * Reads the Compendium of the Christian Religion (Hermanus Faukelius, 1608), in Archibald Laidlie's
 * English translation (1767), from the Internet Archive's OCR text of a public-domain printing:
 *
 *   The Psalms and Hymns, with the Doctrinal Standards and Liturgy, of the Reformed Protestant
 *   Dutch Church in North America (New York: Board of Publication of the R.P.D.C., 1860),
 *   "Doctrinal Standards", pp. 27-34. Scan of the Princeton Theological Seminary Library copy:
 *   https://archive.org/details/psalmshymnswit00refo
 *
 * This file is the only part of the build that knows about this source, so another edition of the
 * Compendium can replace it without touching anything else (keep the numbering 1-74).
 *
 * The OCR text is cut down to the Compendium (`sliceCompendium`), tidied line by line
 * (`normaliseLines`), corrected by the reviewed list `COMPENDIUM_FIXES` and then parsed
 * (`parseCompendium`). Each fix must match exactly once, so a changed download fails the build
 * instead of slipping through. All functions here are pure.
 */

/** The title line of the Compendium and the rubric that follows its last answer. */
const START = /^A\s+COMPENDIUM\s*$/m;
const END = /^When\s+those\s+who\s+are\s+inclined/m;

/** The OCR text from the Compendium's title up to (not including) the rubric after question 74. */
export function sliceCompendium(djvu: string): string {
	const start = START.exec(djvu);
	if (!start) throw new Error('Compendium: no "A COMPENDIUM" title in the source');
	const end = END.exec(djvu.slice(start.index));
	if (!end) throw new Error('Compendium: no end ("When those who are inclined") after the title');
	return djvu.slice(start.index, start.index + end.index);
}

/** Trims each line, collapses runs of spaces to one and drops blank lines. */
export function normaliseLines(text: string): string {
	return text
		.split(/\r?\n/)
		.map((line) => line.replace(/\s+/g, ' ').trim())
		.filter(Boolean)
		.join('\n');
}

export type Fix = readonly [from: string, to: string];

/** Replaces each `from` with its `to`, in order. Each `from` must occur exactly once. */
export function applyFixes(text: string, fixes: readonly Fix[]): string {
	let out = text;
	for (const [from, to] of fixes) {
		const count = out.split(from).length - 1;
		if (count !== 1) throw new Error(`Compendium: the fix "${from}" matches ${count} times`);
		out = out.replace(from, () => to);
	}
	return out;
}

/** Closes up "2: 17" (the printing sets a space after the colon) to "2:17". */
export function tidyReferences(text: string): string {
	return text.replace(/(\d): (\d)/g, '$1:$2');
}

/**
 * Corrections to the OCR, checked against the page images and against four other scans of the
 * Board of Publication's Psalms and Hymns (1859-1860) and Beets, The Compendium Explained (1915).
 * Matched against the text after `normaliseLines`. Wording, spelling and capitals are as printed;
 * only misread characters, broken question markers and stray marks are fixed.
 */
export const COMPENDIUM_FIXES: readonly Fix[] = [
	// Question markers misread, or with a stray mark or quote before or after them.
	['Question- 1.', 'Question 1.'],
	['Q. 2. "Whence', 'Q. 2. Whence'],
	['Q. 1-1.', 'Q. 14.'],
	['Q. IS.', 'Q. 18.'],
	['• Q. 19.', 'Q. 19.'],
	['Q. 22. "Why', 'Q. 22. Why'],
	['Q. 23 "What', 'Q. 23. What'],
	['Q. 38. In which', 'Q. 33. In which'],
	['Q. 41. "Where', 'Q. 41. Where'],
	['. Q. 43.', 'Q. 43.'],
	['Q. 43. Who worketh', 'Q. 48. Who worketh'],
	['Q. 55. AVhere', 'Q. 55. Where'],
	['Q. CO.', 'Q. 60.'],
	['64. Since', 'Q. 64. Since'],
	['Q. 67. "Wherein', 'Q. 67. Wherein'],
	['Q. GS.', 'Q. 68.'],
	['Q. 09.', 'Q. 69.'],
	['<&. 74.', 'Q. 74.'],
	// Part headings.
	['THE SECOND TART.', 'THE SECOND PART.'],
	['THE THIRD PAHT.', 'THE THIRD PART.'],
	// Q3, the Ten Commandments.
	['Tealed in Scripture', 'vealed in Scripture'],
	['TIiou shalt have', 'Thou shalt have'],
	['TJion shalt', 'Thou shalt'],
	['in, heaven above', 'in heaven above'],
	['th e iniquity of. the', 'the iniquity of the'],
	['shoving mercy', 'showing mercy'],
	['takethhis', 'taketh his'],
	['/Six days', 'Six days'],
	['ea?*th', 'earth'],
	['l^ORD', 'LORD'],
	['Llonour', 'Honour'],
	['commit adultery,', 'commit adultery.'],
	['shalt net steal', 'shalt not steal'],
	['his asst nor', 'his ass, nor'],
	// Q5-Q19.
	['all mysoul', 'all my soul'],
	['father ef us', 'father of us'],
	['both\nIn time', 'both\nin time'],
	['" cursed', '"cursed'],
	['Christ., who', 'Christ, who'],
	['Could riot', 'Could not'],
	// Q20, the Apostles' Creed. The lines between articles V and VI are marks from the facing page.
	['Ibelieve', 'I believe'],
	['tarth.', 'earth.'],
	['hi* only', 'his only'],
	['Sufered', 'Suffered'],
	['cruci/led', 'crucified'],
	['ITe a\nI, the\n77\nVI. ITe ascended', 'VI. He ascended'],
	['•Of God', 'of God'],
	['quick and tht', 'quick and the'],
	['YIII. I belie re', 'VIII. I believe'],
	// Q23-Q47.
	['earth?"-', 'earth?"'],
	['King. v', 'King.'],
	['coessential', 'coëssential'],
	['coeternal', 'coëternal'],
	['against siu', 'against sin'],
	['Rom. 4: 5:5,', 'Rom. 4:25.'],
	['ttiere be', 'there be'],
	['With respect, to', 'With respect to'],
	['Matt. 23 : 20', 'Matt. 28:20'],
	['Rom. 5; 10.', 'Rom. 5:10.'],
	['heir cf', 'heir of'],
	// Q52-Q63.
	['tes-\ntament 9', 'tes-\ntament?'],
	['washin » away', 'washing away'],
	['1 Cor. 1 1 : 23-26', '1 Cor. 11:23-26'],
	['" For I have', '"For I have'],
	['lie took the cup', 'he took the cup'],
	['brake It', 'brake it'],
	['on account, of them', 'on account of them'],
	['Matt, IS:', 'Matt. 18:'],
	['let hiua be', 'let him be'],
	// Q64-Q72.
	['■we then yet do good works ? •', 'we then yet do good works ?'],
	['What pui-pose', 'What purpose'],
	// A printer's error, not the OCR's: every scan of this printing reads "all good words". Beets
	// (1915) and the Dutch ("alle goede werken") have "works".
	['all good words', 'all good works'],
	['are clone', 'are done'],
	['and hot those', 'and not those'],
	['own imaginations,', 'own imaginations.'],
	['John 16 : 28', 'John 16:23'],
	['body, Which Christ', 'body, which Christ'],
	['Lord lias', 'Lord has']
];

/** One Scripture citation printed in an answer: the text to cut, what replaces it, the reference. */
export interface Citation {
	/** Exact text of the cleaned answer, including the punctuation around the citation. */
	from: string;
	to: string;
	/** As fairview-catechism.ts `proofLabels` reads it: "Rom 10:14-17", "Exod 20; Deut 5:4, 5". */
	ref: string;
}

/**
 * The citations printed inside answers, by question. They become proof labels, so the answer to
 * recite holds only the Compendium's words. The citation in the question of Q38 stays: it is part
 * of what is asked. Q43 prints Rom. 5:10 here and in Beets (1915), a misprint for Rom. 5:1, which
 * is what the proof label cites.
 */
export const COMPENDIUM_CITATIONS: Readonly<Record<number, readonly Citation[]>> = {
	3: [
		{ from: '\nExodus xx. and Deut. 5:4, 5, &c. I am', to: '\nI am', ref: 'Exod 20; Deut 5:4, 5' }
	],
	18: [{ from: 'written, (John 3:16,) "for', to: 'written, "for', ref: 'John 3:16' }],
	28: [{ from: ', Heb. 2:17 and 4:15.', to: '.', ref: 'Heb 2:17; Heb 4:15' }],
	30: [{ from: ', Acts 4:12.', to: '.', ref: 'Acts 4:12' }],
	35: [{ from: ', Rom. 4:25.', to: '.', ref: 'Rom 4:25' }],
	36: [{ from: ', Eph. 1:20, 21.', to: '.', ref: 'Eph 1:20, 21' }],
	43: [{ from: ', Rom. 5:10.', to: '.', ref: 'Rom 5:1' }],
	49: [{ from: ', Rom. 10:14-17.', to: '.', ref: 'Rom 10:14-17' }],
	59: [{ from: 'St. Paul, (1 Cor. 11:23-26), "For', to: 'St. Paul, "For', ref: '1 Cor 11:23-26' }],
	63: [{ from: 'by Christ, (Matt. 18:15-17.) "If', to: 'by Christ, "If', ref: 'Matt 18:15-17' }],
	66: [{ from: 'of God, (1 Cor. 6:9, 10), unless', to: 'of God, unless', ref: '1 Cor 6:9, 10' }],
	71: [{ from: 'of Christ, (John 16:23), and', to: 'of Christ, and', ref: 'John 16:23' }]
};

/** A chapter-and-verse or the Exodus heading of Q3, left in an answer. */
const CITES = /\d+:\d+|Exodus xx/;

/**
 * Cuts question `n`'s citations out of its cleaned answer. Each listed citation must occur exactly
 * once, and no other may be left behind.
 */
export function moveCitations(
	n: number,
	answer: string,
	table: Readonly<Record<number, readonly Citation[]>>
): { a: string; refs: string[] } {
	let a = answer;
	const refs: string[] = [];
	for (const { from, to, ref } of table[n] ?? []) {
		if (a.split(from).length !== 2) throw new Error(`Compendium: question ${n} has no "${from}"`);
		a = a.replace(from, () => to);
		refs.push(ref);
	}
	const left = CITES.exec(a);
	if (left) throw new Error(`Compendium: question ${n} still cites "${left[0]}"`);
	return { a, refs };
}

const QUESTION = /^(?:Question|Q)\.? (\d+)\. (.*)$/;
const ANSWER = /^(?:Answer|A)\. (.*)$/;
const PART = /^THE (FIRST|SECOND|THIRD) PART\.$/;
/** Running heads: "COMPENDIUM. 29" and "28 DOCTRINAL STANDARDS." */
const RUNNING_HEAD = /^(?:COMPENDIUM\. \d+|\d+ DOCTRINAL STANDARDS\.)$/;
/** A commandment, an article of the Creed or the Exodus heading of Q3 starts a line of its own. */
const OWN_LINE = /^(?:[IVX]+\. |Exodus xx\.)/;

export interface CompendiumEntry {
	n: number;
	q: string;
	/** Lines joined by "\n" where the printing starts a commandment or an article. */
	a: string;
}

export interface CompendiumParse {
	entries: CompendiumEntry[];
	/** The three parts, by the first question printed after each part heading. */
	sections: { heading: string; first: number }[];
}

/** Adds a wrapped line: a trailing hyphen joins the word, a list item starts a new line. */
function join(text: string, line: string): string {
	if (text === '') return line;
	if (OWN_LINE.test(line)) return `${text}\n${line}`;
	if (text.endsWith('-')) return text.slice(0, -1) + line;
	return `${text} ${line}`;
}

/**
 * Parses the normalised, corrected Compendium. Lines before the first question (the title) are
 * skipped. A part heading is a "THE FIRST PART." line and the title line under it.
 */
export function parseCompendium(text: string): CompendiumParse {
	const entries: (CompendiumEntry & { answered: boolean })[] = [];
	const sections: { heading: string; first: number }[] = [];
	let pending: string | null = null;
	const lines = text.split('\n');
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const current = entries.at(-1);
		if (RUNNING_HEAD.test(line)) continue;
		const part = PART.exec(line);
		if (part) {
			const title = lines[i + 1];
			if (title === undefined || !/^Of /.test(title)) {
				throw new Error(`Compendium: THE ${part[1]} PART has no "Of ..." title under it`);
			}
			pending = title.replace(/\.$/, '');
			i++;
			continue;
		}
		const question = QUESTION.exec(line);
		if (question) {
			if (current && !current.answered) {
				throw new Error(`Compendium: question ${current.n} has no answer`);
			}
			const n = Number(question[1]);
			entries.push({ n, q: question[2], a: '', answered: false });
			if (pending !== null) sections.push({ heading: pending, first: n });
			pending = null;
			continue;
		}
		if (!current) continue;
		const answer = ANSWER.exec(line);
		if (answer) {
			if (current.answered)
				throw new Error(`Compendium: question ${current.n} has a second answer`);
			current.answered = true;
			current.a = answer[1];
			continue;
		}
		if (current.answered) current.a = join(current.a, line);
		else current.q = join(current.q, line);
	}
	const last = entries.at(-1);
	if (last && !last.answered) throw new Error(`Compendium: question ${last.n} has no answer`);
	if (pending !== null) throw new Error(`Compendium: no question after the part "${pending}"`);
	return { entries: entries.map(({ n, q, a }) => ({ n, q, a })), sections };
}
