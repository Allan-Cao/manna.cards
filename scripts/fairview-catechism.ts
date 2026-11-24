/**
 * Reads The Baptist Catechism for Children from Fairview Baptist Church's web page
 * (https://www.fairviewbaptistchurch.ca/childrens-catechism/). Used by permission.
 *
 * The page's <article> holds `<h5>N. Question?</h5>` headings, each followed by one or more answer
 * paragraphs ending in a parenthesised proof list such as "(Gen 2:7, 21-22; Rom 5:19a)". Section
 * headings and "Back to Contents" links sit between them. Any other text after the first question
 * makes the parse fail rather than be lost or glued onto an answer. All functions here are pure.
 */
import { BOOKS } from '../src/lib/core/books.ts';

/** The book abbreviations the page uses, to USFM codes. Anything else fails the build. */
export const FAIRVIEW_BOOKS: Readonly<Record<string, string>> = {
	Gen: 'GEN',
	Exod: 'EXO',
	Lev: 'LEV',
	Deut: 'DEU',
	'1 Chron': '1CH',
	Ps: 'PSA',
	Prov: 'PRO',
	Ecc: 'ECC',
	Jer: 'JER',
	Ez: 'EZK',
	Matt: 'MAT',
	Mark: 'MRK',
	Luke: 'LUK',
	John: 'JHN',
	Acts: 'ACT',
	Rom: 'ROM',
	'1 Cor': '1CO',
	'2 Cor': '2CO',
	Gal: 'GAL',
	Eph: 'EPH',
	Phil: 'PHP',
	Col: 'COL',
	'1 Thess': '1TH',
	'2 Thess': '2TH',
	'1 Tim': '1TI',
	'2 Tim': '2TI',
	Titus: 'TIT',
	Heb: 'HEB',
	'1 Pet': '1PE',
	'2 Pet': '2PE',
	'1 John': '1JN',
	Jude: 'JUD',
	Rev: 'REV'
};

const EN_DASH = '–';

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
	hellip: '…',
	ndash: '–',
	mdash: '—',
	lsquo: '‘',
	rsquo: '’',
	ldquo: '“',
	rdquo: '”',
	laquo: '«',
	raquo: '»'
};

function decodeEntities(text: string): string {
	return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
		if (name[0] === '#') {
			const code =
				name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
			return String.fromCodePoint(code);
		}
		return NAMED_ENTITIES[name.toLowerCase()] ?? whole;
	});
}

/** Plain text of an HTML fragment: tags dropped, entities decoded, all whitespace (and nbsp) collapsed. */
export function htmlText(fragment: string): string {
	return decodeEntities(fragment.replace(/<[^>]*>/g, ''))
		.replace(/\s+/g, ' ')
		.trim();
}

/** The other catechisms use straight quotes, so this one does too. */
export function straightenQuotes(text: string): string {
	return text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
}

/** An answer and its trailing "(…)" proof list, if it has one. A period after the list is dropped. */
export function splitProof(body: string): { answer: string; proof: string | null } {
	const m = /^([\s\S]*?)\s*\(([^()]+)\)\.?$/.exec(body.trim());
	if (!m || m[1] === '') return { answer: body.trim(), proof: null };
	return { answer: m[1], proof: m[2].trim() };
}

interface Book {
	name: string;
	single: boolean;
}

function findBook(abbrev: string, ref: string): Book {
	const id = FAIRVIEW_BOOKS[abbrev];
	const book = id && BOOKS.find((b) => b.id === id);
	if (!book) throw new Error(`Unknown book "${abbrev}" in reference "${ref}"`);
	return { name: book.name, single: book.singleChapter === true };
}

/** "7", "5a", "10bc" */
const VERSE = String.raw`\d+[a-z]*`;
const ITEM = new RegExp(String.raw`^(?:(\d+):)?(${VERSE})(?:-(?:(\d+):)?(${VERSE}))?$|^([a-z]+)$`);

/**
 * Labels for one proof list, such as "Gen 2:7, 21-22; Matt 6:10b,c", deduplicated in order.
 * Semicolons separate books; commas separate verses, which keep the chapter before them. Each
 * comma item becomes its own label, as with the Creeds.json catechisms. Part-verse letters are
 * kept ("Romans 5:19a"), and a bare letter adds a part to the verse before it ("Matthew 6:10bc").
 */
export function proofLabels(proof: string): string[] {
	const labels: string[] = [];
	const text = proof.replace(/\s+/g, ' ').trim();
	if (text === '') throw new Error('Empty proof list');
	for (const segment of text.split(';')) {
		const ref = segment.trim();
		const head = /^((?:[1-3] )?[A-Za-z]+) (.+)$/.exec(ref);
		if (!head) throw new Error(`Unreadable reference "${ref}"`);
		const book = findBook(head[1], ref);
		const prefix = (chapter: number) => (book.single ? '' : `${chapter}:`);
		let chapter: number | undefined;
		const own: string[] = [];
		for (const raw of head[2].split(',')) {
			const m = ITEM.exec(raw.trim());
			if (!m) throw new Error(`Unreadable reference "${ref}"`);
			const [, ch, verse, endCh, endVerse, letters] = m;
			if (letters !== undefined) {
				// "6:10b,c": more parts of the verse just labelled.
				if (own.length === 0 || !/\d[a-z]+$/.test(own[own.length - 1])) {
					throw new Error(`Unreadable reference "${ref}"`);
				}
				own[own.length - 1] += letters;
				continue;
			}
			if (ch === undefined && chapter === undefined && !book.single) {
				// "Gen 3" or "Gen 3-4": whole chapters.
				if (!/^\d+$/.test(verse) || (endVerse !== undefined && !/^\d+$/.test(endVerse))) {
					throw new Error(`Unreadable reference "${ref}"`);
				}
				chapter = Number(endVerse ?? verse);
				own.push(`${book.name} ${verse}${endVerse === undefined ? '' : EN_DASH + endVerse}`);
				continue;
			}
			const v = verse;
			if (ch !== undefined) chapter = Number(ch);
			if (chapter === undefined) {
				if (!book.single) throw new Error(`No chapter in reference "${ref}"`);
				chapter = 1;
			}
			let label = `${book.name} ${prefix(chapter)}${v}`;
			if (endVerse !== undefined) {
				const to = endCh === undefined ? chapter : Number(endCh);
				label += EN_DASH + (to === chapter || book.single ? endVerse : `${to}:${endVerse}`);
				chapter = to;
			}
			own.push(label);
		}
		for (const label of own) if (!labels.includes(label)) labels.push(label);
	}
	return labels;
}

export interface FairviewEntry {
	n: number;
	q: string;
	/** The answer paragraphs joined with spaces, proof list included. */
	body: string;
}

export interface FairviewSection {
	/** As the page body writes it, e.g. "Questions about the 10 Commandments". */
	heading: string;
	/** Number of the section's first question. */
	first: number;
}

/** The numbered questions and section headings in the page's <article>. */
export function parseFairviewHtml(html: string): {
	entries: FairviewEntry[];
	sections: FairviewSection[];
} {
	const article = /<article\b[\s\S]*?<\/article>/i.exec(html);
	if (!article) throw new Error('No <article> in the catechism page');
	const entries: FairviewEntry[] = [];
	const sections: FairviewSection[] = [];
	let pendingHeading: string | null = null;
	let current: { n: number; q: string; paragraphs: string[] } | null = null;

	const close = () => {
		if (!current) return;
		if (current.paragraphs.length === 0) throw new Error(`question ${current.n} has no answer`);
		entries.push({ n: current.n, q: current.q, body: current.paragraphs.join(' ') });
		current = null;
	};

	for (const block of article[0].matchAll(/<(h[1-6]|p)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
		const tag = block[1].toLowerCase();
		const text = htmlText(block[2]);
		if (text === '') continue;
		if (tag.startsWith('h')) {
			const numbered = /^(\d+)\.\s+(.+)$/.exec(text);
			close();
			if (numbered) {
				if (pendingHeading !== null) {
					sections.push({ heading: pendingHeading, first: Number(numbered[1]) });
					pendingHeading = null;
				}
				current = { n: Number(numbered[1]), q: numbered[2], paragraphs: [] };
			} else {
				pendingHeading = text;
			}
			continue;
		}
		if (text === 'Back to Contents') continue;
		if (current) (current as { paragraphs: string[] }).paragraphs.push(text);
		else if (entries.length > 0) throw new Error(`Text outside any question: "${text}"`);
		// Before the first question: introduction and contents, ignored.
	}
	close();
	return { entries, sections };
}
