/**
 * The whole path from a deck definition to the notes of one export, without I/O:
 * list text -> groups of References -> Passages -> NoteSpecs, or for a catechism deck
 * list text -> question numbers -> questions -> NoteSpecs (questions.ts).
 * The caller supplies the loaders, writes the package (anki/apkg.ts) and bumps `def.revision`.
 */

import { makeNotes } from './cards.ts';
import { CATECHISMS, type CatechismId, type CatechismText } from './catechisms.ts';
import { cleanDeckName } from './deckdef.ts';
import { parseList } from './list.ts';
import type {
	BookId,
	BookText,
	DeckBuild,
	DeckDefinition,
	Group,
	ListError,
	Passage,
	TranslationId
} from './model.ts';
import {
	makeQuestionNotes,
	parseQuestionList,
	planQuestions,
	type PlannedQuestionGroup
} from './questions.ts';
import { booksNeeded, passageFromBooks } from './sources/static.ts';
import { versificationFor } from './versification.ts';

export type LoadBooks = (
	translation: TranslationId,
	bookIds: BookId[]
) => Promise<Record<BookId, BookText>>;

export type LoadCatechism = (id: CatechismId) => Promise<CatechismText>;

const noCatechisms: LoadCatechism = () =>
	Promise.reject(new Error('No catechism loader was given to build this catechism deck'));

export interface BuildResult {
	build: DeckBuild;
	/** Scripture decks only (empty for a catechism deck). */
	groups: Group[];
	/** In deck order, for the preview. Scripture decks only. */
	passages: Passage[];
	/** Catechism decks only (empty for a scripture deck): the questions, by heading. */
	questions: PlannedQuestionGroup[];
	/** What the export snapshot records: passage labels, or question references ("WSC 1"). */
	labels: string[];
	/** Invalid list lines. The valid lines are still built. */
	errors: ListError[];
	/** Verse keys whose saved breaks no longer match the text, so automatic breaks were used. */
	staleBreaks: string[];
}

export async function buildDeck(
	def: DeckDefinition,
	loadBooks: LoadBooks,
	exportedAt: number,
	loadCatechism: LoadCatechism = noCatechisms
): Promise<BuildResult> {
	const deckName = cleanDeckName(def.name);
	if (def.catechism) {
		const id = def.catechism;
		const { groups, errors } = parseQuestionList(def.list, CATECHISMS[id].count);
		const questions = groups.length ? planQuestions(id, await loadCatechism(id), groups) : [];
		const notes = makeQuestionNotes(def, questions);
		return {
			build: { deckId: def.id, deckName, notes, exportedAt },
			groups: [],
			passages: [],
			questions,
			labels: notes.map((n) => n.fields.Reference),
			errors,
			staleBreaks: []
		};
	}

	const { groups, errors } = parseList(def.list, versificationFor(def.translation));
	const refs = groups.flatMap((g) => g.refs);
	const books = await loadBooks(def.translation, booksNeeded(refs));
	const passages = refs.map((ref) => passageFromBooks(ref, def.translation, books));
	const { notes, staleBreaks } = makeNotes(def, passages);
	const build = { deckId: def.id, deckName, notes, exportedAt };
	const labels = passages.map((p) => p.ref.label);
	return { build, groups, passages, questions: [], labels, errors, staleBreaks };
}
