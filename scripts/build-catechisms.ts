/**
 * Builds the app's bundled catechisms:
 *   static/catechisms/{id}.json  one CatechismText per catechism, compact JSON
 * wsc and bc come from Creeds.json (NonlinearFruit, public domain texts); bcc from Fairview Baptist
 * Church's web page, used by permission (see fairview-catechism.ts); hsc from the Internet Archive's
 * OCR of an 1860 public-domain printing of the Compendium (see rca-compendium.ts).
 *
 * Run:  npx tsx scripts/build-catechisms.ts            (downloads the sources into .cache/ once)
 *       npx tsx scripts/build-catechisms.ts --refresh  (downloads them again)
 *
 * Only the question, the plain answer and the proof-text list are kept. Proof references become
 * display labels ("Romans 14:7–9"). An unknown book makes the build fail, and so does a wrong
 * question count or numbering. The conversion functions are pure; only `main` does I/O.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BOOKS } from '../src/lib/core/books.ts';
import { CATECHISMS } from '../src/lib/core/catechisms.ts';
import type {
	Catechism,
	CatechismId,
	CatechismQuestion,
	CatechismText
} from '../src/lib/core/catechisms.ts';
import {
	parseFairviewHtml,
	proofLabels,
	splitProof,
	straightenQuotes
} from './fairview-catechism.ts';
import {
	COMPENDIUM_FIXES,
	applyFixes,
	normaliseLines,
	parseCompendium,
	sliceCompendium,
	tidyReferences,
	type Fix
} from './rca-compendium.ts';

/** OSIS book code (as Creeds.json spells it) to USFM code, for all 66 books. */
export const OSIS_TO_USFM: Readonly<Record<string, string>> = {
	Gen: 'GEN',
	Exod: 'EXO',
	Lev: 'LEV',
	Num: 'NUM',
	Deut: 'DEU',
	Josh: 'JOS',
	Judg: 'JDG',
	Ruth: 'RUT',
	'1Sam': '1SA',
	'2Sam': '2SA',
	'1Kgs': '1KI',
	'2Kgs': '2KI',
	'1Chr': '1CH',
	'2Chr': '2CH',
	Ezra: 'EZR',
	Neh: 'NEH',
	Esth: 'EST',
	Job: 'JOB',
	Ps: 'PSA',
	Prov: 'PRO',
	Eccl: 'ECC',
	Song: 'SNG',
	Isa: 'ISA',
	Jer: 'JER',
	Lam: 'LAM',
	Ezek: 'EZK',
	Dan: 'DAN',
	Hos: 'HOS',
	Joel: 'JOL',
	Amos: 'AMO',
	Obad: 'OBA',
	Jonah: 'JON',
	Mic: 'MIC',
	Nah: 'NAM',
	Hab: 'HAB',
	Zeph: 'ZEP',
	Hag: 'HAG',
	Zech: 'ZEC',
	Mal: 'MAL',
	Matt: 'MAT',
	Mark: 'MRK',
	Luke: 'LUK',
	John: 'JHN',
	Acts: 'ACT',
	Rom: 'ROM',
	'1Cor': '1CO',
	'2Cor': '2CO',
	Gal: 'GAL',
	Eph: 'EPH',
	Phil: 'PHP',
	Col: 'COL',
	'1Thess': '1TH',
	'2Thess': '2TH',
	'1Tim': '1TI',
	'2Tim': '2TI',
	Titus: 'TIT',
	Phlm: 'PHM',
	Heb: 'HEB',
	Jas: 'JAS',
	'1Pet': '1PE',
	'2Pet': '2PE',
	'1John': '1JN',
	'2John': '2JN',
	'3John': '3JN',
	Jude: 'JUD',
	Rev: 'REV'
};

const EN_DASH = '–';

interface Point {
	osis: string;
	chapter: number;
	verse?: number;
}

function parsePoint(text: string, ref: string): Point {
	const m = /^([1-3]?[A-Za-z]+)\.(\d+)(?:\.(\d+))?$/.exec(text.trim());
	if (!m) throw new Error(`Unreadable reference "${ref}"`);
	return {
		osis: m[1],
		chapter: Number(m[2]),
		verse: m[3] === undefined ? undefined : Number(m[3])
	};
}

/** One OSIS reference (no commas) as a display label. Throws on an unknown book or odd shape. */
export function osisToLabel(ref: string): string {
	const [from, to, ...extra] = ref.split('-');
	if (extra.length > 0) throw new Error(`Unreadable reference "${ref}"`);
	const start = parsePoint(from, ref);
	const usfm = OSIS_TO_USFM[start.osis];
	if (!usfm) throw new Error(`Unknown book "${start.osis}" in reference "${ref}"`);
	const book = BOOKS.find((b) => b.id === usfm);
	if (!book) throw new Error(`No book ${usfm} for reference "${ref}"`);
	let end: Point | undefined;
	if (to !== undefined) {
		// "Rom.14.9" or, in a bare same-book range, "9" is not produced by the source; require a full point.
		end = parsePoint(to, ref);
		if (end.osis !== start.osis) throw new Error(`Range crosses books in "${ref}"`);
	}
	const single = book.singleChapter === true;
	// Single-chapter books are written "Jude 5": the chapter is dropped, "Jude.1.5" and "Jude.5" both mean verse 5.
	if (single) {
		const v = (p: Point) => p.verse ?? p.chapter;
		if (start.verse === undefined && !end) return `${book.name} ${start.chapter}`;
		const a = v(start);
		const b = end ? v(end) : a;
		return b === a ? `${book.name} ${a}` : `${book.name} ${a}${EN_DASH}${b}`;
	}
	if (start.verse === undefined) {
		if (!end) return `${book.name} ${start.chapter}`;
		return end.chapter === start.chapter
			? `${book.name} ${start.chapter}`
			: `${book.name} ${start.chapter}${EN_DASH}${end.chapter}`;
	}
	const head = `${book.name} ${start.chapter}:${start.verse}`;
	if (!end || end.verse === undefined) return head;
	if (end.chapter === start.chapter) {
		return end.verse === start.verse ? head : `${head}${EN_DASH}${end.verse}`;
	}
	return `${head}${EN_DASH}${end.chapter}:${end.verse}`;
}

/** Labels for a list of reference strings (each may hold several, comma-joined), deduplicated in order. */
export function referencesToLabels(refs: readonly string[]): string[] {
	const labels: string[] = [];
	for (const joined of refs) {
		for (const ref of joined.split(',')) {
			if (ref.trim() === '') continue;
			const label = osisToLabel(ref.trim());
			if (!labels.includes(label)) labels.push(label);
		}
	}
	return labels;
}

/** Long-s OCR errors found in the 1695 Baptist Catechism. Whole words only; nothing else is touched. */
export const OCR_FIXES: Readonly<Record<string, string>> = {
	Chrift: 'Christ',
	Refurrection: 'Resurrection'
};

export function fixOcr(text: string): string {
	return text.replace(/[A-Za-z]+/g, (w) => OCR_FIXES[w] ?? w);
}

/** Collapses whitespace and drops any space left before punctuation ("Creation ," becomes "Creation,"). */
const collapse = (s: string) =>
	s
		.replace(/\s+/g, ' ')
		.replace(/ ([,;:.?!])/g, '$1')
		.trim();

export function cleanQuestion(text: string): string {
	return collapse(text);
}

/** Trims, collapses whitespace (see `collapse`), strips `[n]` proof markers and ends the answer with terminal punctuation. */
export function cleanAnswer(text: string): string {
	let out = collapse(text.replace(/\s*\[\d+\]/g, ''));
	if (out !== '' && !/[.!?]["'”’)]*$/.test(out)) out += '.';
	return out;
}

/** Cleans each line as `cleanAnswer` would, keeping the line breaks (one per commandment or article). */
export function cleanAnswerLines(text: string): string {
	return cleanAnswer(text.split('\n').map(collapse).filter(Boolean).join('\u0000')).replaceAll(
		'\u0000',
		'\n'
	);
}

export interface RawEntry {
	Number: number;
	Question: string;
	Answer: string;
	/** Some 1695 entries have an empty Answer; this one then holds the text with [n] markers. */
	AnswerWithProofs?: string;
	Proofs?: { Id: number; References: string[] }[];
}

export interface RawCatechism {
	Data: RawEntry[];
}

export function convertCatechism(id: CatechismId, raw: RawCatechism): CatechismText {
	const fix = id === 'bc' ? fixOcr : (s: string) => s;
	const questions: CatechismQuestion[] = raw.Data.map((e) => {
		const proofs: string[] = [];
		for (const label of referencesToLabels((e.Proofs ?? []).flatMap((p) => p.References))) {
			if (!proofs.includes(label)) proofs.push(label);
		}
		return {
			n: e.Number,
			q: cleanQuestion(fix(e.Question)),
			a: cleanAnswer(fix(e.Answer.trim() !== '' ? e.Answer : (e.AnswerWithProofs ?? ''))),
			proofs
		};
	});
	checkQuestions(id, CATECHISMS[id].count, questions);
	return { id, source: 'Creeds.json (public domain)', questions };
}

/** Throws unless there are `count` questions numbered from 1, each with a question and an answer. */
function checkQuestions(id: CatechismId, count: number, questions: CatechismQuestion[]): void {
	if (questions.length !== count) {
		throw new Error(`${id}: expected ${count} questions, found ${questions.length}`);
	}
	questions.forEach((q, i) => {
		if (q.n !== i + 1) throw new Error(`${id}: question ${i + 1} is numbered ${q.n}`);
		if (q.q === '' || q.a === '')
			throw new Error(`${id}: question ${q.n} has an empty question or answer`);
	});
}

/** The questions of The Baptist Catechism for Children whose answer has no proof list ("Six."). */
export const BCC_WITHOUT_PROOFS: readonly number[] = [108];

/**
 * The Fairview page as a CatechismText. Besides the usual checks, every question has proofs
 * except those in `withoutProofs`, and the page's sections start where the registry's do.
 */
export function convertFairview(
	html: string,
	catechism: Catechism = CATECHISMS.bcc,
	withoutProofs: readonly number[] = BCC_WITHOUT_PROOFS
): CatechismText {
	const { id, credit, count, sections } = catechism;
	if (!credit) throw new Error(`${id}: the registry has no credit for this source`);
	const parsed = parseFairviewHtml(html);
	const questions = parsed.entries.map(({ n, q, body }): CatechismQuestion => {
		const { answer, proof } = splitProof(body);
		return {
			n,
			q: cleanQuestion(straightenQuotes(q)),
			a: cleanAnswer(straightenQuotes(answer)),
			proofs: proof === null ? [] : proofLabels(proof)
		};
	});
	checkQuestions(id, count, questions);
	for (const q of questions) {
		const expectNone = withoutProofs.includes(q.n);
		if (expectNone && q.proofs.length) throw new Error(`${id}: question ${q.n} has proofs`);
		if (!expectNone && !q.proofs.length) throw new Error(`${id}: question ${q.n} has no proof`);
	}
	const starts = (list: readonly { first: number }[]) => list.map((s) => s.first).join(',');
	if (sections && starts(sections) !== starts(parsed.sections)) {
		throw new Error(
			`${id}: the page's sections start at ${starts(parsed.sections)}, the registry's at ${starts(sections)}`
		);
	}
	return { id, source: credit, questions };
}

/**
 * The Compendium from the OCR text of its printing (see rca-compendium.ts), corrected by `fixes`.
 * Besides the usual checks, the printed parts start where the registry's sections do; the registry
 * may add a first section for the questions before the first part.
 */
export function convertCompendium(
	djvu: string,
	catechism: Catechism = CATECHISMS.hsc,
	fixes: readonly Fix[] = COMPENDIUM_FIXES
): CatechismText {
	const { id, credit, count, sections } = catechism;
	if (!credit) throw new Error(`${id}: the registry has no credit for this source`);
	const parsed = parseCompendium(applyFixes(normaliseLines(sliceCompendium(djvu)), fixes));
	const questions = parsed.entries.map(({ n, q, a }): CatechismQuestion => ({
		n,
		q: cleanQuestion(tidyReferences(q)),
		a: tidyReferences(cleanAnswerLines(a)),
		proofs: []
	}));
	checkQuestions(id, count, questions);
	const printed = parsed.sections.map((s) => s.first);
	if (printed[0] !== 1) printed.unshift(1);
	const registry = (sections ?? []).map((s) => s.first);
	if (printed.join(',') !== registry.join(',')) {
		throw new Error(
			`${id}: the printed sections start at ${printed.join(',')}, the registry's at ${registry.join(',')}`
		);
	}
	return { id, source: credit, questions };
}

interface Source {
	url: string;
	/** Under .cache/. */
	cache: string;
	convert: (body: string) => CatechismText;
}

const CREEDS_URL = 'https://raw.githubusercontent.com/NonlinearFruit/Creeds.json/master/creeds/';
const creeds = (id: CatechismId, file: string): Source => ({
	url: CREEDS_URL + file,
	cache: `creeds/${file}`,
	convert: (body) => convertCatechism(id, JSON.parse(body) as RawCatechism)
});

const SOURCES: Record<CatechismId, Source> = {
	wsc: creeds('wsc', 'westminster_shorter_catechism.json'),
	bc: creeds('bc', '1695_baptist_catechism.json'),
	bcc: {
		url: 'https://www.fairviewbaptistchurch.ca/childrens-catechism/',
		cache: 'fairview/childrens-catechism.html',
		convert: (body) => convertFairview(body)
	},
	hsc: {
		url: 'https://archive.org/download/psalmshymnswit00refo/psalmshymnswit00refo_djvu.txt',
		cache: 'archive/psalmshymnswit00refo_djvu.txt',
		convert: (body) => convertCompendium(body)
	}
};

const root = new URL('../', import.meta.url);

async function main(): Promise<void> {
	const refresh = process.argv.includes('--refresh');
	const cacheDir = new URL('.cache/', root);
	const outDir = new URL('static/catechisms/', root);
	mkdirSync(fileURLToPath(outDir), { recursive: true });
	for (const id of Object.keys(SOURCES) as CatechismId[]) {
		const { url, cache, convert } = SOURCES[id];
		const file = new URL(cache, cacheDir);
		if (refresh || !existsSync(file)) {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`Download of ${url} failed: HTTP ${res.status}`);
			mkdirSync(fileURLToPath(new URL('./', file)), { recursive: true });
			writeFileSync(file, Buffer.from(await res.arrayBuffer()));
		}
		const text = convert(readFileSync(file, 'utf8'));
		writeFileSync(new URL(`${id}.json`, outDir), JSON.stringify(text) + '\n');
		console.log(`${id}: ${text.questions.length} questions`);
	}
}

const entry = process.argv[1] && pathToFileURL(process.argv[1]).href;
if (import.meta.url === entry) await main();
