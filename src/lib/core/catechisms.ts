/** The bundled catechisms, in the order the picker lists them, and the shape of their text files. */

export type CatechismId = 'wsc' | 'bc' | 'bcc' | 'hsc';

export interface Catechism {
	id: CatechismId;
	/** e.g. "WSC", shown on cards. */
	short: string;
	/** e.g. "Westminster Shorter Catechism", shown in the picker. */
	name: string;
	/** Number of questions, so lists can be validated without loading the text. */
	count: number;
	/**
	 * The credit its publisher asks for, or the translation and printing it was taken from, starting
	 * with `name`. Shown on cards in place of the name, as the deck description and on the about
	 * page. Absent for the public-domain texts from Creeds.json.
	 */
	credit?: string;
	/** The catechism's own parts, by first question, in order. A new deck lists them as headings. */
	sections?: readonly { heading: string; first: number }[];
}

export const CATECHISMS: Record<CatechismId, Catechism> = {
	wsc: { id: 'wsc', short: 'WSC', name: 'Westminster Shorter Catechism', count: 107 },
	bc: { id: 'bc', short: 'BC', name: 'The Baptist Catechism', count: 114 },
	bcc: {
		id: 'bcc',
		short: 'BCC',
		name: 'The Baptist Catechism for Children',
		count: 145,
		credit:
			'The Baptist Catechism for Children, © 2023 Cross & Crown Press. Used by permission of Fairview Baptist Church.',
		sections: [
			{ heading: 'God, Man and Sin', first: 1 },
			{ heading: 'Salvation', first: 38 },
			{ heading: 'Ten Commandments', first: 73 },
			{ heading: 'Prayer', first: 105 },
			{ heading: 'Word, Church and Ordinances', first: 122 },
			{ heading: 'Last Things', first: 136 }
		]
	},
	hsc: {
		id: 'hsc',
		short: 'HSC',
		name: 'Compendium of the Heidelberg Catechism',
		count: 74,
		credit:
			"Compendium of the Heidelberg Catechism (Faukelius, 1608), tr. Archibald Laidlie (1767), as printed in the Reformed Protestant Dutch Church's Psalms and Hymns (1860). Public domain.",
		sections: [
			{ heading: 'Introduction', first: 1 },
			{ heading: 'The Misery of Man', first: 2 },
			{ heading: "Man's Deliverance", first: 14 },
			{ heading: 'Gratitude to God', first: 64 }
		]
	}
};

/** The list a new deck starts with: every question, under the catechism's section headings if it has them. */
export function defaultQuestionList(id: CatechismId): string {
	const { count, sections } = CATECHISMS[id];
	if (!sections) return `1-${count}`;
	return sections
		.map(({ heading, first }, i) => {
			const last = (sections[i + 1]?.first ?? count + 1) - 1;
			return `# ${heading}\n${first === last ? first : `${first}-${last}`}`;
		})
		.join('\n');
}

/** Catechisms the app no longer offers, by id, with their names. Saved decks and links may still use them. */
export const RETIRED_CATECHISMS: Readonly<Record<string, string>> = {
	hc: 'Heidelberg Catechism',
	wlc: 'Westminster Larger Catechism'
};

/** The name of a retired catechism, or null when `value` is not one. */
export function retiredCatechism(value: unknown): string | null {
	return typeof value === 'string' && Object.hasOwn(RETIRED_CATECHISMS, value)
		? RETIRED_CATECHISMS[value]
		: null;
}

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
