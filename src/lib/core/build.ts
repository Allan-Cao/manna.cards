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
import { escapeHtml } from './render.ts';
import type {
	BookId,
	BookText,
	DeckBuild,
	DeckDefinition,
	Group,
	ListError,
	Passage,
	Reference,
	TranslationId
} from './model.ts';
import {
	makeQuestionNotes,
	parseQuestionList,
	planQuestions,
	type PlannedQuestionGroup
} from './questions.ts';
import { checkEsvLimits, esvVersesNeeded } from './sources/esv.ts';
import { booksNeeded, passageFromBooks } from './sources/static.ts';
import { TRANSLATIONS } from './translations.ts';
import { versificationFor } from './versification.ts';

/**
 * Loads the text a deck needs. A bundled translation is loaded by whole book (`bookIds`); a remote
 * one (the ESV) by verse, from `refs` (see sources/esv.ts), and may hold only those verses.
 */
export type LoadBooks = (
	translation: TranslationId,
	bookIds: BookId[],
	refs: Reference[]
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
	/**
	 * Errors about the whole deck rather than a line: Crossway's ESV limits (500 verses, half a
	 * book). When there are any, no text was loaded and the build has no notes.
	 */
	limitErrors: string[];
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
		const { credit } = CATECHISMS[id];
		return {
			build: {
				deckId: def.id,
				deckName,
				notes,
				exportedAt,
				...(credit && { description: escapeHtml(credit) })
			},
			groups: [],
			passages: [],
			questions,
			labels: notes.map((n) => n.fields.Reference),
			errors,
			staleBreaks: [],
			limitErrors: []
		};
	}

	const versification = versificationFor(def.translation);
	const { copyright, link } = TRANSLATIONS[def.translation];
	const notice = copyright && {
		description: link ? `${copyright}<br><a href="${link}">${link}</a>` : copyright
	};
	const { groups, errors } = parseList(def.list, versification);
	const refs = groups.flatMap((g) => g.refs);
	if (def.translation === 'esv') {
		const limitErrors = checkEsvLimits(esvVersesNeeded(refs, versification), versification);
		if (limitErrors.length) {
			const build = { deckId: def.id, deckName, notes: [], exportedAt, ...notice };
			return {
				build,
				groups,
				passages: [],
				questions: [],
				labels: [],
				errors,
				staleBreaks: [],
				limitErrors
			};
		}
	}
	const books = await loadBooks(def.translation, booksNeeded(refs), refs);
	// Remote text holds only the verses fetched, so chapter lengths come from the versification.
	const lengths = TRANSLATIONS[def.translation].remote ? versification : undefined;
	const passages = refs.map((ref) => passageFromBooks(ref, def.translation, books, lengths));
	const { notes, staleBreaks } = makeNotes(def, passages);
	const build = { deckId: def.id, deckName, notes, exportedAt, ...notice };
	const labels = passages.map((p) => p.ref.label);
	return { build, groups, passages, questions: [], labels, errors, staleBreaks, limitErrors: [] };
}
