import { describe, expect, it } from 'vitest';
import {
	batches,
	referenceOf,
	chapterStartIds,
	verseId,
	versificationFromMeta
} from './build-esv-versification.ts';
import { BOOKS } from '../src/lib/core/books.ts';

const counts = Object.fromEntries(BOOKS.map((b) => [b.id, 1]));

describe('esv versification', () => {
	it('builds 8-digit verse ids', () => {
		expect(verseId(0, 1, 1)).toBe(1001001);
		expect(verseId(65, 22, 1)).toBe(66022001);
	});

	it('names verses', () => {
		expect(referenceOf(43003016)).toBe('John 3:16');
	});

	it('lists chapter starts in canon order and batches them', () => {
		expect(chapterStartIds({ ...counts, GEN: 2 }).slice(0, 3)).toEqual([1001001, 1002001, 2001001]);
		expect(batches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
	});

	it('reads verse counts from passage_meta and rejects extra chapters', () => {
		const metas = BOOKS.map((_, i) => ({
			chapter_start: [verseId(i, 1, 1), verseId(i, 1, 7)] as [number, number],
			next_chapter:
				i < 65 ? ([verseId(i + 1, 1, 1), verseId(i + 1, 1, 7)] as [number, number]) : null
		}));
		expect(versificationFromMeta(counts, metas).GEN).toEqual([7]);
		metas[0].next_chapter = [verseId(0, 2, 1), verseId(0, 2, 5)];
		expect(() => versificationFromMeta(counts, metas)).toThrow(/more than 1 chapters/);
	});
});
