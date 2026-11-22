/**
 * ESV text, fetched at build time instead of bundled (Crossway's terms do not allow shipping it).
 * Pure: the browser fetches `GET /api/esv/passage?q=...` (the proxy passes the ESV API v3
 * passage/text JSON on unchanged) and this module plans the queries, checks Crossway's limits,
 * and turns the responses into BookText that passageFromBooks reads.
 *
 * The recipe, given a deck's references:
 *   needed  = esvVersesNeeded(refs, versification)
 *   errors  = checkEsvLimits(needed, versification)      // non-empty: do not fetch
 *   missing = esvMissing(needed, cached)
 *   fetched = await Promise.all(esvQuery(missing).map(fetch...)) -> parseEsvResponse each
 *   text    = mergeEsvText(cached, ...fetched)
 *   books   = esvBooks(text) -> passageFromBooks(ref, 'esv', books, versification)
 *
 * Server parameters this parser relies on: verse numbers on (first verse of a chapter too), no
 * passage references, headings, footnotes or copyright, Selahs on, paragraphs indented 2 spaces,
 * poetry lines 4 (continuation 8, 12, ...), "declares the LORD" 40 and psalm doxologies 30 more,
 * no line wrapping.
 */
import { BOOKS } from '../books.ts';
import type {
	BookId,
	BookText,
	Line,
	Reference,
	StoredVerse,
	Versification,
	VerseRef
} from '../model.ts';

/** The ESV API's passage/text response. Only `parsed` and `passages` are read. */
export interface EsvResponse {
	query: string;
	canonical: string;
	/** [startId, endId] of each passage, in the order of `passages`. */
	parsed: [number, number][];
	passage_meta: unknown[];
	passages: string[];
}

/** ESV verses gathered from one or more responses. Plain JSON, so the browser can cache it. */
export interface EsvText {
	/** By 8-digit verse id (BBCCCVVV). */
	verses: Record<number, StoredVerse>;
	/**
	 * Id ranges the responses answered, ends included, sorted and joined. A verse inside a range but
	 * not in `verses` is one the ESV leaves out (Matthew 17:21), not one still to fetch.
	 */
	covered: [number, number][];
}

/** Crossway: no more than 500 verses, and no more than half of any book. */
export const ESV_MAX_VERSES = 500;

const BOOK_NUMBER = new Map(BOOKS.map((b, i) => [b.id, i + 1]));

/** 8-digit ESV API id: book number in Protestant order, chapter, verse. JHN 3:16 -> 43003016. */
export function esvId(ref: VerseRef): number {
	const n = BOOK_NUMBER.get(ref.book);
	if (!n) throw new Error(`Unknown book ${ref.book}`);
	return n * 1_000_000 + ref.chapter * 1000 + ref.verse;
}

export function esvRef(id: number): VerseRef {
	const book = BOOKS[Math.floor(id / 1_000_000) - 1];
	if (!book) throw new Error(`Bad ESV verse id ${id}`);
	return { book: book.id, chapter: Math.floor(id / 1000) % 1000, verse: id % 1000 };
}

/**
 * Every verse whose text the deck shows, each once, in order of first use. That is exactly the
 * verses of the references: a card's lead-in is the unit before it within the same range
 * (cards.ts planCards), so it never reaches outside the list. Omitted verses are included,
 * since the versification counts them; that only errs on the side of the limits.
 */
export function esvVersesNeeded(refs: Reference[], versification: Versification): VerseRef[] {
	const seen = new Set<number>();
	const out: VerseRef[] = [];
	for (const ref of refs) {
		for (const { start, end } of ref.ranges) {
			const counts = versification[start.book] ?? [];
			for (let c = start.chapter; c <= end.chapter; c++) {
				const from = c === start.chapter ? start.verse : 1;
				const to = c === end.chapter ? end.verse : (counts[c - 1] ?? 0);
				for (let v = from; v <= to; v++) {
					const verse = { book: start.book, chapter: c, verse: v };
					const id = esvId(verse);
					if (seen.has(id)) continue;
					seen.add(id);
					out.push(verse);
				}
			}
		}
	}
	return out;
}

/** Crossway's limits, as messages for the user. Empty when the deck may be built. */
export function checkEsvLimits(verses: VerseRef[], versification: Versification): string[] {
	const ids = new Set(verses.map(esvId));
	const errors: string[] = [];
	if (ids.size > ESV_MAX_VERSES) {
		errors.push(
			`ESV decks are limited to ${ESV_MAX_VERSES} verses, and this one shows ${ids.size} (including lead-in verses).`
		);
	}
	const perBook = new Map<BookId, number>();
	for (const id of ids) {
		const book = esvRef(id).book;
		perBook.set(book, (perBook.get(book) ?? 0) + 1);
	}
	for (const book of BOOKS) {
		const shown = perBook.get(book.id);
		if (!shown) continue;
		const total = (versification[book.id] ?? []).reduce((a, b) => a + b, 0);
		const half = Math.floor(total / 2);
		if (shown > half) {
			const name = book.id === 'PSA' ? 'Psalms' : book.name;
			errors.push(
				`ESV decks may include at most half of a book: ${name} has ${total} verses, so at most ${half}; this deck shows ${shown}.`
			);
		}
	}
	return errors;
}

/**
 * The `q` values that fetch these verses: contiguous runs within a chapter as "start-end" id
 * ranges, comma-separated (the API does not parse id ranges joined by ";"), at most 500 verses
 * per query. A deck within the limits needs a single query.
 */
export function esvQuery(verses: VerseRef[]): string[] {
	const ids = [...new Set(verses.map(esvId))].sort((a, b) => a - b);
	const runs: [number, number][] = [];
	for (const id of ids) {
		const last = runs.at(-1);
		if (last && id === last[1] + 1) last[1] = id;
		else runs.push([id, id]);
	}
	const queries: string[] = [];
	let parts: string[] = [];
	let count = 0;
	for (const [first, end] of runs) {
		let start = first;
		while (start <= end) {
			const take = Math.min(end - start + 1, ESV_MAX_VERSES - count);
			parts.push(`${start}-${start + take - 1}`);
			count += take;
			start += take;
			if (count === ESV_MAX_VERSES) {
				queries.push(parts.join(','));
				parts = [];
				count = 0;
			}
		}
	}
	if (parts.length) queries.push(parts.join(','));
	return queries;
}

// ---------------------------------------------------------------------------------------------
// Parsing

interface RawLine {
	/** Leading spaces. */
	lead: number;
	text: string;
	/** A blank line (empty or spaces only) comes before it. */
	afterBlank: boolean;
	/** The very next line is empty (""), which in this output follows a heading or a prose paragraph. */
	beforeEmpty: boolean;
}

/** `[[` opens a passage the ESV brackets as not in the earliest manuscripts (Mark 16:9-20). */
const MARKER = /(\[\[)?\[(\d+)\]/g;

/** Poetry indent from leading spaces: 4 -> 0, 8 -> 1, 12 -> 2, 16 -> 3; "declares" and doxology lines -> 2. */
function indentOf(lead: number): Line['indent'] {
	if (lead >= 20) return 2;
	return Math.max(0, Math.min(3, Math.floor(lead / 4) - 1)) as Line['indent'];
}

function rawLines(passage: string): RawLine[] {
	const split = passage.split('\n');
	const out: RawLine[] = [];
	let blank = false;
	split.forEach((line, i) => {
		const text = line.trim();
		if (!text) {
			blank = true;
			return;
		}
		const lead = line.length - line.trimStart().length;
		out.push({ lead, text, afterBlank: blank, beforeEmpty: split[i + 1] === '' });
		blank = false;
	});
	return out;
}

/**
 * A heading line: no verse marker, not a prose paragraph, and followed directly by an empty line
 * (poetry stanzas end with a line of spaces instead). Superscriptions, acrostic letters
 * ("Aleph"), and the textual notes before disputed passages look like this.
 */
function isHeading(line: RawLine): boolean {
	MARKER.lastIndex = 0;
	return line.lead !== 2 && line.beforeEmpty && !MARKER.test(line.text);
}

function startsWithVerseOne(line: RawLine | undefined): boolean {
	return !!line && /^(\[\[)?\[1\]/.test(line.text);
}

/** Splits a final "Selah" off as its own line, as the bundled text has it. */
function withSelah(text: string, indent: Line['indent']): Line[] {
	if (text === 'Selah') return [{ text, indent: 0, selah: true }];
	if (text.endsWith(' Selah')) {
		return [
			{ text: text.slice(0, -' Selah'.length).trimEnd(), indent },
			{ text: 'Selah', indent: 0, selah: true }
		];
	}
	return [{ text, indent }];
}

function parsePassage(passage: string, [startId]: [number, number], out: EsvText['verses']): void {
	const start = esvRef(startId);
	const bookNumber = Math.floor(startId / 1_000_000);
	let chapter = start.chapter;
	let current: StoredVerse | null = null;
	let currentId = 0;
	let title: string | undefined;
	/** The double bracket opening a disputed passage, waiting for the verse text it belongs to. */
	let prefix = '';

	/** Adds text to the open verse. False when there was nothing to add. */
	const add = (text: string, indent: Line['indent'], paragraph: boolean): boolean => {
		if (!current || !text) return false;
		withSelah(prefix + text, indent).forEach((line, i) => {
			if (paragraph && i === 0) line.paragraph = true;
			current!.lines.push(line);
		});
		prefix = '';
		return true;
	};
	const close = () => {
		if (current?.lines.length) out[currentId] = current;
		current = null;
	};

	const lines = rawLines(passage);
	lines.forEach((line, i) => {
		if (isHeading(line)) {
			// A superscription stands before verse 1 of a psalm. Psalm 119's acrostic letters do too,
			// but they are headings, not part of the text.
			const target = current ? chapter + 1 : chapter;
			if (start.book === 'PSA' && target !== 119 && startsWithVerseOne(lines[i + 1])) {
				title = line.text;
			}
			return;
		}
		const indent = line.lead === 2 ? 0 : indentOf(line.lead);
		// The start of the response says nothing about paragraphs unless it starts a chapter.
		let paragraph = line === lines.find((l) => !isHeading(l)) ? start.verse === 1 : line.afterBlank;
		let at = 0;
		MARKER.lastIndex = 0;
		for (let m = MARKER.exec(line.text); m; m = MARKER.exec(line.text)) {
			if (add(line.text.slice(at, m.index).trim(), indent, paragraph)) paragraph = false;
			const verse = Number(m[2]);
			if (current && verse <= currentId % 1000) chapter++;
			close();
			currentId = bookNumber * 1_000_000 + chapter * 1000 + verse;
			current = { v: verse, lines: [] };
			if (verse === 1 && title !== undefined) current.title = title;
			title = undefined;
			prefix = m[1] ?? '';
			at = m.index + m[0].length;
		}
		add(line.text.slice(at).trim(), indent, paragraph);
	});
	close();
}

/** The verses of one passage/text response. Verses the ESV leaves out are simply absent. */
export function parseEsvResponse(response: EsvResponse): EsvText {
	const verses: EsvText['verses'] = {};
	response.passages.forEach((passage, i) => {
		const range = response.parsed[i];
		if (range) parsePassage(passage, range, verses);
	});
	return { verses, covered: joinRanges(response.parsed.map(([a, b]) => [a, b])) };
}

function joinRanges(ranges: [number, number][]): [number, number][] {
	const sorted = ranges.map(([a, b]): [number, number] => [a, b]).sort((x, y) => x[0] - y[0]);
	const out: [number, number][] = [];
	for (const [a, b] of sorted) {
		const last = out.at(-1);
		if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b);
		else out.push([a, b]);
	}
	return out;
}

/** Combines cached and newly fetched text. A later argument wins where verses overlap. */
export function mergeEsvText(...texts: EsvText[]): EsvText {
	const verses: EsvText['verses'] = {};
	for (const t of texts) Object.assign(verses, t.verses);
	const sorted = Object.fromEntries(
		Object.keys(verses)
			.map(Number)
			.sort((a, b) => a - b)
			.map((id) => [id, verses[id]])
	);
	return { verses: sorted, covered: joinRanges(texts.flatMap((t) => t.covered)) };
}

/** The verses no response in `text` has answered yet: what still has to be fetched. */
export function esvMissing(verses: VerseRef[], text: EsvText): VerseRef[] {
	return verses.filter((v) => {
		const id = esvId(v);
		return !text.covered.some(([a, b]) => a <= id && id <= b);
	});
}

/**
 * The text as BookText for passageFromBooks, which must be given the ESV versification because
 * the chapters hold only the verses fetched. Chapters before the last one held are empty arrays.
 */
export function esvBooks(text: EsvText): Record<BookId, BookText> {
	const books: Record<BookId, BookText> = {};
	for (const [key, verse] of Object.entries(text.verses)) {
		const { book, chapter } = esvRef(Number(key));
		books[book] ??= { book, translation: 'esv', chapters: [] };
		const chapters = books[book].chapters;
		while (chapters.length < chapter) chapters.push([]);
		chapters[chapter - 1].push(verse);
	}
	for (const book of Object.values(books)) {
		for (const ch of book.chapters) ch.sort((a, b) => a.v - b.v);
	}
	return books;
}
