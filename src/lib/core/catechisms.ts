/** The bundled catechisms, in the order the picker lists them, and the shape of their text files. */

export type CatechismId = 'wsc' | 'bc';

export interface Catechism {
	id: CatechismId;
	/** e.g. "WSC", shown on cards. */
	short: string;
	/** e.g. "Westminster Shorter Catechism", shown in the picker. */
	name: string;
	/** Number of questions, so lists can be validated without loading the text. */
	count: number;
}

export const CATECHISMS: Record<CatechismId, Catechism> = {
	wsc: { id: 'wsc', short: 'WSC', name: 'Westminster Shorter Catechism', count: 107 },
	bc: { id: 'bc', short: 'BC', name: 'The Baptist Catechism', count: 114 }
};

export function isCatechismId(value: unknown): value is CatechismId {
	return typeof value === 'string' && Object.hasOwn(CATECHISMS, value);
}

export interface CatechismQuestion {
	/** Question number, from 1, sequential. */
	n: number;
	/** Plain text, no HTML. */
	q: string;
	/** Plain text, no HTML, no proof markers. */
	a: string;
	/** Proof texts as display labels, e.g. "Romans 14:7–9", in source order, deduplicated. May be empty. */
	proofs: string[];
}

/** One file per catechism at static/catechisms/{id}.json, written by scripts/build-catechisms.ts. */
export interface CatechismText {
	id: CatechismId;
	/** Where the text came from, e.g. "Creeds.json (public domain)". */
	source: string;
	questions: CatechismQuestion[];
}
