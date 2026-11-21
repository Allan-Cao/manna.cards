/**
 * What the deck editor shows: every card of a build, grouped by heading, passage and verse, as
 * Unit/Line data rather than note HTML. Plus the small edits the editor makes (breaks) and the
 * export note about passages inserted among cards Anki already has.
 */

import type { BuildResult } from './build.ts';
import { firstVerseNumber, planCards, type PlannedCard } from './cards.ts';
import type { Break, DeckDefinition, Line, Verse } from './model.ts';
import { parseList } from './list.ts';
import { CATECHISMS } from './catechisms.ts';
import { parseQuestionList, type PlannedQuestionGroup } from './questions.ts';
import { hintLines } from './render.ts';
import { breakAfter, verseWords } from './units.ts';
import { versificationFor } from './versification.ts';

export interface PreviewCard extends PlannedCard {
	/** The verse number shown at the start of the answer, on a verse's first unit only. */
	verseNumber?: number;
	hint: Line[];
}

export interface PreviewVerse {
	verse: Verse;
	key: string;
	/** Empty when the verse is omitted or already asked by an earlier passage. */
	cards: PreviewCard[];
	/** Asked by an earlier passage, so it makes no cards here. */
	repeated: boolean;
	/** The breaks in use, saved or automatic. */
	breaks: Break[];
	/** The verse uses breaks the user saved. */
	saved: boolean;
}

export interface PreviewPassage {
	label: string;
	verses: PreviewVerse[];
	cards: number;
}

export interface PreviewGroup {
	heading: string | null;
	passages: PreviewPassage[];
}

export function previewDeck(def: DeckDefinition, result: BuildResult): PreviewGroup[] {
	const plan = planCards(def.breaks, result.passages);
	let at = 0; // index into result.passages; groups list their refs in the same order

	return result.groups.map((group) => ({
		heading: group.heading,
		passages: group.refs.map(() => {
			const i = at++;
			const verses = plan[i].map(
				({ verse, key, repeated, stale, breaks, cards }): PreviewVerse => ({
					verse,
					key,
					repeated,
					breaks,
					saved: def.breaks[key] !== undefined && !stale,
					cards: cards.map((card) => ({
						...card,
						verseNumber: firstVerseNumber(card.unit),
						hint: hintLines(card.unit.lines)
					}))
				})
			);
			return {
				label: result.passages[i].ref.label,
				verses,
				cards: verses.reduce((n, v) => n + v.cards.length, 0)
			};
		})
	}));
}

export type PreviewRow =
	| { kind: 'heading'; key: string; heading: string }
	| {
			kind: 'passage';
			key: string;
			passage: PreviewPassage;
			/** Position across the whole deck. */
			index: number;
			underHeading: boolean;
	  };

/**
 * The groups as one flat list of headings and passages. A passage is keyed by its label, so it
 * keeps its key when a heading added above it moves it into another group. A heading is keyed
 * by its group's position, which a label (never starting with `#`) cannot match. An empty
 * heading (a lone `#`) shows nothing.
 */
export function previewRows(groups: PreviewGroup[]): PreviewRow[] {
	let index = 0;
	return groups.flatMap((group, g): PreviewRow[] => [
		...(group.heading ? [{ kind: 'heading' as const, key: `#${g}`, heading: group.heading }] : []),
		...group.passages.map((passage) => ({
			kind: 'passage' as const,
			key: passage.label,
			passage,
			index: index++,
			underHeading: !!group.heading
		}))
	]);
}

/** Adds a break after word `after`, or removes the one there. Kept in word order. */
export function toggleBreak(verse: Verse, breaks: Break[], after: number): Break[] {
	if (!Number.isInteger(after) || after < 0 || after >= verseWords(verse).length - 1) return breaks;
	if (breaks.some((b) => b.after === after)) return breaks.filter((b) => b.after !== after);
	return [...breaks, breakAfter(verse, after)].sort((a, b) => a.after - b.after);
}

/**
 * Passages added since the last export that come before a passage exported then. Anki keeps the
 * order of cards it already has, so the new cards will not come up in list order.
 */
export function insertedPassages(previous: string[] | null, next: string[]): string[] {
	if (!previous) return [];
	const old = new Set(previous);
	let lastOld = -1;
	next.forEach((label, i) => {
		if (old.has(label)) lastOld = i;
	});
	return next.filter((label, i) => !old.has(label) && i < lastOld);
}

/** One catechism question as the editor shows it. */
export interface PreviewQuestion {
	reference: string;
	question: string;
	answer: Line[];
	hint: Line[];
	proofs: string[];
}

export type QuestionRow =
	| { kind: 'heading'; key: string; heading: string }
	| { kind: 'question'; key: string; card: PreviewQuestion };

/** A catechism deck's questions as one flat list of headings and questions, like previewRows. */
export function previewQuestions(groups: PlannedQuestionGroup[]): QuestionRow[] {
	return groups.flatMap((group, g): QuestionRow[] => [
		...(group.heading ? [{ kind: 'heading' as const, key: `#${g}`, heading: group.heading }] : []),
		...group.questions.map(({ key, reference, question, answer }) => ({
			kind: 'question' as const,
			key,
			card: {
				reference,
				question: question.q,
				answer,
				hint: hintLines(answer),
				proofs: question.proofs
			}
		}))
	]);
}

/**
 * How many passages a deck's list holds, or questions for a catechism deck, for deck lists.
 * Invalid lines are not counted.
 */
export function passageCount(def: DeckDefinition): number {
	if (def.catechism) {
		const { groups } = parseQuestionList(def.list, CATECHISMS[def.catechism].count);
		return groups.reduce((n, g) => n + g.questions.length, 0);
	}
	const { groups } = parseList(def.list, versificationFor(def.translation));
	return groups.reduce((n, g) => n + g.refs.length, 0);
}
