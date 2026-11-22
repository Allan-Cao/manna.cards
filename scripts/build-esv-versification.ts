/**
 * Adds ESV verse counts per chapter to src/lib/core/versification.json, using the ESV API
 * (https://api.esv.org/v3/passage/text/). Only verse numbering is kept: the passage text is
 * copyrighted and is discarded unread. Needs ESV=<api key> in the environment:
 *
 *   npx tsx --env-file=.env scripts/build-esv-versification.ts
 *
 * Each query asks for the first verse of every chapter; passage_meta[i].chapter_start gives the
 * ids [first, last] of that chapter (8-digit BBCCCVVV), and last % 1000 is the highest verse number.
 * The chapter list comes from KJV; the next_chapter of each book's last chapter confirms the count.
 */
import { BOOKS } from '../src/lib/core/books.ts';

/** Verse ids per request stay under the API's 500-verse cap. */
export const BATCH_SIZE = 220;

export interface PassageMeta {
	chapter_start: [number, number];
	next_chapter: [number, number] | null;
}

/** Numeric verse id BBCCCVVV; bookIndex is 0-based canon position. */
export function verseId(bookIndex: number, chapter: number, verse: number): number {
	return (bookIndex + 1) * 1_000_000 + chapter * 1000 + verse;
}

/** "Genesis 1:1" style reference for a verse id (the API does not accept numeric ids). */
export function referenceOf(id: number): string {
	const book = BOOKS[Math.floor(id / 1_000_000) - 1];
	return `${book.name} ${Math.floor(id / 1000) % 1000}:${id % 1000}`;
}

/** First-verse ids of every chapter, in canon order. */
export function chapterStartIds(chapterCounts: Record<string, number>): number[] {
	const ids: number[] = [];
	BOOKS.forEach((book, i) => {
		for (let c = 1; c <= chapterCounts[book.id]; c++) ids.push(verseId(i, c, 1));
	});
	return ids;
}

export function batches<T>(items: T[], size = BATCH_SIZE): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
}

/**
 * Verse counts per book from metas ordered like `chapterStartIds`. Throws if a meta does not belong
 * to the expected chapter or a book's last chapter is followed by another chapter of the same book.
 */
export function versificationFromMeta(
	chapterCounts: Record<string, number>,
	metas: PassageMeta[]
): Record<string, number[]> {
	const result: Record<string, number[]> = {};
	let n = 0;
	BOOKS.forEach((book, i) => {
		const counts: number[] = [];
		for (let c = 1; c <= chapterCounts[book.id]; c++) {
			const meta = metas[n++];
			if (!meta || meta.chapter_start[0] !== verseId(i, c, 1)) {
				throw new Error(`${book.id} ${c}: unexpected chapter_start ${meta?.chapter_start}`);
			}
			counts.push(meta.chapter_start[1] % 1000);
			if (c === chapterCounts[book.id]) {
				const next = meta.next_chapter;
				if (next && Math.floor(next[0] / 1_000_000) === i + 1) {
					throw new Error(`${book.id} has more than ${c} chapters in the ESV`);
				}
			}
		}
		result[book.id] = counts;
	});
	if (n !== metas.length) throw new Error(`${metas.length - n} unexpected extra passages`);
	return result;
}

async function main() {
	const fs = await import('node:fs');
	const path = await import('node:path');
	const key = process.env.ESV;
	if (!key) throw new Error('Set ESV to your ESV API key (npx tsx --env-file=.env ...)');
	const root = path.resolve(import.meta.dirname, '..');
	const file = path.join(root, 'src', 'lib', 'core', 'versification.json');
	const data = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<
		string,
		Record<string, number[]>
	>;
	const chapterCounts = Object.fromEntries(BOOKS.map((b) => [b.id, data.kjv[b.id].length]));

	const metas: PassageMeta[] = [];
	for (const batch of batches(chapterStartIds(chapterCounts))) {
		const params = new URLSearchParams({
			q: batch.map(referenceOf).join(';'),
			'include-passage-references': 'false'
		});
		const res = await fetch(`https://api.esv.org/v3/passage/text/?${params}`, {
			headers: { Authorization: `Token ${key}` }
		});
		if (!res.ok) throw new Error(`ESV API ${res.status}: ${(await res.text()).slice(0, 200)}`);
		const body = (await res.json()) as { passage_meta: PassageMeta[] };
		metas.push(
			...body.passage_meta.map(({ chapter_start, next_chapter }) => ({
				chapter_start,
				next_chapter
			}))
		);
		console.log(`batch of ${batch.length} ok`);
	}

	data.esv = versificationFromMeta(chapterCounts, metas);
	const prettier = await import('prettier');
	const options = (await prettier.resolveConfig(file)) ?? {};
	fs.writeFileSync(
		file,
		await prettier.format(JSON.stringify(data), { ...options, filepath: file })
	);
	for (const b of BOOKS) {
		data.esv[b.id].forEach((v, i) => {
			if (v !== data.kjv[b.id][i])
				console.log(`differs from KJV: ${b.id} ${i + 1}: esv ${v}, kjv ${data.kjv[b.id][i]}`);
		});
	}
}

const entry = process.argv[1] && (await import('node:url')).pathToFileURL(process.argv[1]).href;
if (import.meta.url === entry) await main();
