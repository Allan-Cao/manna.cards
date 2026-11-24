/**
 * What the deck editor shows: every card of a build, grouped by heading, passage and verse, as
 * Unit/Line data rather than note HTML, and a catechism deck's questions with a card per part of
 * each answer. Plus the small edits the editor makes (breaks) and the export note about
 * passages inserted among cards Anki already has.
 */

import type { BuildResult } from './build.ts';
import { firstVerseNumber, planCards, type PlannedCard } from './cards.ts';
import type { Break, DeckDefinition, Line, Verse } from './model.ts';
import { parseList } from './list.ts';
import { CATECHISMS, isCatechismId } from './catechisms.ts';
import { parseQuestionList, questionLabel, type PlannedQuestionGroup } from './questions.ts';
import { verseLabel } from './refs.ts';
import { hintLines } from './render.ts';
import { breakAfter, verseWords, type Text } from './units.ts';
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

/** Adds a break after word `after` of a verse or answer, or removes the one there. Kept in word order. */
export function toggleBreak(verse: Text, breaks: Break[], after: number): Break[] {
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

/** One card of a catechism question as the editor shows it: the whole answer or one part. */
export interface PreviewAnswer {
	/** As on the card, e.g. "WSC 12 (1/2)". */
	reference: string;
	index: number;
	/** The part before, shown under the question. Null for the first part. */
	lead: Line[] | null;
	answer: Line[];
	hint: Line[];
}

/** One catechism question as the editor shows it, with a card per part of its answer. */
export interface PreviewQuestion {
	/** The key of its saved breaks, e.g. "wsc:12". */
	key: string;
	/** e.g. "WSC 12". */
	reference: string;
	question: string;
	/** The whole answer, for the break editor. */
	answer: Line[];
	proofs: string[];
	/** The breaks in use, saved or automatic. */
	breaks: Break[];
	/** The answer uses breaks the user saved. */
	saved: boolean;
	cards: PreviewAnswer[];
}

export type QuestionRow =
	| { kind: 'heading'; key: string; heading: string }
	| { kind: 'question'; key: string; item: PreviewQuestion };

/**
 * A catechism deck's questions as one flat list of headings and questions, like previewRows.
 * `breaks` are the deck's saved breaks, to tell which answers use them.
 */
export function previewQuestions(
	groups: PlannedQuestionGroup[],
	breaks: DeckDefinition['breaks'] = {}
): QuestionRow[] {
	return groups.flatMap((group, g): QuestionRow[] => [
		...(group.heading ? [{ kind: 'heading' as const, key: `#${g}`, heading: group.heading }] : []),
		...group.questions.map((q) => ({
			kind: 'question' as const,
			key: q.key,
			item: {
				key: q.key,
				reference: q.reference,
				question: q.question.q,
				answer: q.answer,
				proofs: q.question.proofs,
				breaks: q.breaks,
				saved: breaks[q.key] !== undefined && !q.stale,
				cards: q.cards.map((card) => ({
					reference: card.reference,
					index: card.index,
					lead: card.lead,
					answer: card.lines,
					hint: hintLines(card.lines)
				}))
			}
		}))
	]);
}

/** What the editor calls the verse or question whose breaks are saved under `key`. */
export function breaksLabel(key: string): string {
	const question = /^([a-z]+):(\d+)$/.exec(key);
	if (question && isCatechismId(question[1]))
		return questionLabel(question[1], Number(question[2]));
	const [book, chapter, verse] = key.split('.');
	return verseLabel({ book, chapter: Number(chapter), verse: Number(verse) });
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
