/**
 * ESV text from the same-origin proxy (`GET /api/esv/passage?q=...`), cached in memory only:
 * Crossway's terms allow no more than 500 verses held at once, and none stored on the device.
 * The verses used least recently are dropped beyond that, and fetched again when next needed.
 *
 * Loads run one at a time, so a load waiting behind another sees what that one fetched and asks
 * only for what is still missing; a load whose build is no longer wanted by then fetches nothing.
 */
import { asset } from '$app/paths';
import type { AssetPath } from '$app/types';
import type { BookId, BookText, Reference } from '#lib/core/model.ts';
import {
	ESV_MAX_VERSES,
	esvBooks,
	esvId,
	esvMissing,
	esvQuery,
	esvQueryRanges,
	esvVersesNeeded,
	mergeEsvText,
	parseEsvResponse,
	trimEsvText,
	type EsvResponse,
	type EsvText
} from '#lib/core/sources/esv.ts';
import { versificationFor } from '#lib/core/versification.ts';

let cache: EsvText = { verses: {}, covered: [] };
/** Ids of the verses in `cache` (omitted ones too), least recently used first. */
const recent = new Set<number>();
let queue: Promise<unknown> = Promise.resolve();

/** Thrown instead of fetching for a build that has been replaced by a newer one. */
export class Superseded extends Error {
	constructor() {
		super('Superseded by a newer build');
	}
}

function failure(status: number): string {
	if (status === 429) return 'The ESV service is busy. Try again in a minute.';
	if (status === 503) return 'ESV is not available here.';
	return `Could not load the ESV text (${status})`;
}

async function fetchPassage(q: string): Promise<EsvText> {
	let response: Response;
	try {
		response = await fetch(`${asset('api/esv/passage' as AssetPath)}?q=${encodeURIComponent(q)}`);
	} catch {
		throw new Error('Could not load the ESV text. Check your connection.');
	}
	if (!response.ok) throw new Error(failure(response.status));
	return parseEsvResponse((await response.json()) as EsvResponse, esvQueryRanges(q));
}

/** `wanted` says whether the build still needs the text once its turn comes. */
export function loadEsv(
	refs: Reference[],
	wanted: () => boolean = () => true
): Promise<Record<BookId, BookText>> {
	const run = queue.then(async () => {
		const needed = esvVersesNeeded(refs, versificationFor('esv'));
		const missing = esvMissing(needed, cache);
		if (missing.length) {
			if (!wanted()) throw new Superseded();
			// Nothing is kept when any request fails.
			const fetched = mergeEsvText(
				cache,
				...(await Promise.all(esvQuery(missing).map(fetchPassage)))
			);
			// A verse the responses did not answer would otherwise show as one the ESV leaves out.
			if (esvMissing(needed, fetched).length) throw new Error('Could not load some ESV verses');
			cache = fetched;
		}
		for (const id of needed.map(esvId)) {
			recent.delete(id);
			recent.add(id);
		}
		for (const id of recent) {
			if (recent.size <= ESV_MAX_VERSES) break;
			recent.delete(id);
		}
		cache = trimEsvText(cache, recent);
		return esvBooks(cache);
	});
	queue = run.catch(() => {});
	return run;
}
