/**
 * Catechism decks: list text -> question numbers -> questions -> NoteSpecs.
 *
 * The list holds one question number or range per line (`5`, `1-10`, `Q5`, `Q1-10`), `#` lines
 * start a group: the same shape as parseList, so errors show the same. A question listed again
 * by a later line is asked only the first time. Each question makes one note on the same note
 * type as verses: the question is the lead-in, the answer the part to recite.
 */

import {
	CATECHISMS,
	type CatechismId,
	type CatechismQuestion,
	type CatechismText
} from './catechisms.ts';
import { revisionTag } from './diff.ts';
import type { DeckDefinition, Line, ListError, NoteSpec } from './model.ts';
import { escapeHtml, firstLetters, renderLines } from './render.ts';

/** Question numbers under one `#` heading. `heading` is null before the first heading. */
export interface QuestionGroup {
	heading: string | null;
	questions: number[];
}

/** As on the card, e.g. "WSC 1". */
export function questionLabel(catechism: CatechismId, n: number): string {
	return `${CATECHISMS[catechism].short} ${n}`;
}

const LINE = /^q?\s*(\d+)(?:\s*[-–—]\s*q?\s*(\d+))?$/i;

export function parseQuestionList(
	text: string,
	count: number
): { groups: QuestionGroup[]; errors: ListError[] } {
	const groups: QuestionGroup[] = [];
	const errors: ListError[] = [];
	const seenLines = new Map<string, number>(); // normalized line -> line it first appeared on
	const asked = new Set<number>();
	let current: QuestionGroup = { heading: null, questions: [] };

	const lines = text.split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		const input = lines[i].trim();
		const line = i + 1;
		if (!input) continue;

		if (input.startsWith('#')) {
			if (current.questions.length > 0) groups.push(current);
			current = { heading: input.replace(/^#+/, '').trim(), questions: [] };
			continue;
		}

		try {
			const [first, last] = parseLine(input, count);
			const label = first === last ? `${first}` : `${first}-${last}`;
			const before = seenLines.get(label);
			if (before !== undefined) throw new Error(`Q${label} is already listed on line ${before}`);
			seenLines.set(label, line);
			for (let n = first; n <= last; n++) {
				if (asked.has(n)) continue;
				asked.add(n);
				current.questions.push(n);
			}
		} catch (e) {
			errors.push({ line, input, message: e instanceof Error ? e.message : String(e) });
		}
	}
	if (current.questions.length > 0) groups.push(current);
	return { groups, errors };
}

function parseLine(input: string, count: number): [number, number] {
	const match = LINE.exec(input);
	if (!match) {
		throw new Error(`Expected a question number or range, such as 5 or 1-10`);
	}
	const first = Number(match[1]);
	const last = match[2] === undefined ? first : Number(match[2]);
	for (const n of [first, last]) {
		if (n < 1 || n > count)
			throw new Error(`There is no question ${n}: they run from 1 to ${count}`);
	}
	if (last < first) throw new Error(`The range ${first}-${last} runs backwards`);
	return [first, last];
}

export function questionGuid(deckId: string, catechism: CatechismId, n: number): string {
	return `bm1:${deckId}:cat:${catechism}:${n}`;
}

export interface PlannedQuestion {
	/** Unique within the deck, e.g. "wsc:1". */
	key: string;
	/** As on the card, e.g. "WSC 1". */
	reference: string;
	question: CatechismQuestion;
	answer: Line[];
}

export interface PlannedQuestionGroup {
	heading: string | null;
	questions: PlannedQuestion[];
}

/** Looks up the listed questions in the text. Both the notes and the editor's preview use this. */
export function planQuestions(
	catechism: CatechismId,
	text: CatechismText,
	groups: QuestionGroup[]
): PlannedQuestionGroup[] {
	const byNumber = new Map(text.questions.map((q) => [q.n, q]));
	return groups.map((group) => ({
		heading: group.heading,
		questions: group.questions.map((n) => {
			const question = byNumber.get(n);
			if (!question) {
				throw new Error(`Question ${n} is missing from the ${CATECHISMS[catechism].name} text`);
			}
			return {
				key: `${catechism}:${n}`,
				reference: questionLabel(catechism, n),
				question,
				answer: answerLines(question.a)
			};
		})
	}));
}

/** An answer is one line; a blank-line or line break in the text starts a new paragraph. */
export function answerLines(answer: string): Line[] {
	return answer
		.split(/\r?\n/)
		.map((text) => text.trim())
		.filter(Boolean)
		.map((text, i): Line => (i === 0 ? { text, indent: 0 } : { text, indent: 0, paragraph: true }));
}

/** The small text under the answer: the proof texts, then the catechism's credit, or its name. */
export function questionInfo(catechism: CatechismId, proofs: string[]): string {
	const { name, credit } = CATECHISMS[catechism];
	return [...(proofs.length ? [proofs.join('; ')] : []), credit ?? name].join(' · ');
}

export function makeQuestionNotes(def: DeckDefinition, plan: PlannedQuestionGroup[]): NoteSpec[] {
	const catechism = def.catechism;
	if (!catechism) throw new Error('Not a catechism deck');
	const tags = [revisionTag(def)];
	return plan
		.flatMap((g) => g.questions)
		.map(({ reference, question, answer }, order) => ({
			guid: questionGuid(def.id, catechism, question.n),
			order,
			tags,
			fields: {
				Reference: reference,
				Context: renderLines([{ text: question.q, indent: 0 }]),
				Answer: renderLines(answer),
				Hint: firstLetters(answer),
				Info: escapeHtml(questionInfo(catechism, question.proofs))
			}
		}));
}
