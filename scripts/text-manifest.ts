import { createHash } from 'node:crypto';

/** What scripts/text-sources.json records about one downloaded eBible.org package. */
export interface SourceRecord {
	url: string;
	/** sha256 of the zip as downloaded; changes whenever eBible re-signs or re-stamps it. */
	zipSha256: string;
	/** sha256 of the .usfm files only (names and contents); changes only with the text. */
	usfmSha256: string;
	/** The date copr.htm states for the package, or null when it states none. */
	stated: string | null;
	/** Day the zip was fetched. */
	downloaded: string;
}

export type Change = 'new' | 'unchanged' | 'package changed, USFM identical' | 'USFM changed';

export function sha256(data: Uint8Array | string): string {
	return createHash('sha256').update(data).digest('hex');
}

/** Digest of the .usfm entries only, independent of zip order, signatures and copr.htm. */
export function usfmDigest(entries: Record<string, Uint8Array>): string {
	const hash = createHash('sha256');
	for (const name of Object.keys(entries)
		.filter((n) => n.endsWith('.usfm'))
		.sort()) {
		// Length-prefixed, so moving bytes between two files changes the digest.
		hash.update(`${name}\0${entries[name].length}\0`).update(entries[name]);
	}
	return hash.digest('hex');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The date eBible states in copr.htm: a bare ISO date (BSB, KJV) or "source files dated
 * 13 Nov 2026" (WEB). Null when neither is present; the page is not otherwise parsed.
 */
export function statedDate(copr: string): string | null {
	const iso = /\b(20\d\d-\d\d-\d\d)\b/.exec(copr);
	if (iso) return iso[1];
	const long = /dated\s+(\d{1,2})\s+([A-Z][a-z]{2})[a-z]*\s+(\d{4})/.exec(copr);
	const month = long ? MONTHS.indexOf(long[2]) : -1;
	if (!long || month < 0) return null;
	return `${long[3]}-${String(month + 1).padStart(2, '0')}-${long[1].padStart(2, '0')}`;
}

export function compareSource(
	previous: Pick<SourceRecord, 'zipSha256' | 'usfmSha256'> | undefined,
	next: Pick<SourceRecord, 'zipSha256' | 'usfmSha256'>
): Change {
	if (!previous) return 'new';
	if (previous.usfmSha256 !== next.usfmSha256) return 'USFM changed';
	return previous.zipSha256 === next.zipSha256 ? 'unchanged' : 'package changed, USFM identical';
}
