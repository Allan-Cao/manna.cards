import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { unzipSync } from 'fflate';
import initSqlJs from 'sql.js';
import { describe, expect, it } from 'vitest';
import { writeApkg } from './anki/apkg.ts';
import { buildDeck, type LoadBooks, type LoadCatechism } from './build.ts';
import { CATECHISMS, type CatechismId } from './catechisms.ts';
import type { BookId, BookText, DeckDefinition, NoteSpec, TranslationId } from './model.ts';
import { FIXTURE } from './questions.fixture.ts';
import { questionGuid } from './questions.ts';
import { escapeHtml } from './render.ts';
import { esvBooks, esvQuery, esvVersesNeeded, parseEsvResponse } from './sources/esv.ts';
import { versificationFor } from './versification.ts';
import { verseKey } from './refs.ts';
import { splitUnits } from './units.ts';

/** Reads the committed text under static/text/, as the app fetches it. */
const fromDisk: LoadBooks = async (translation, bookIds) => {
	const entries = await Promise.all(
		bookIds.map(async (id): Promise<[BookId, BookText]> => {
			const url = new URL(`../../../static/text/${translation}/${id}.json`, import.meta.url);
			return [id, JSON.parse(await readFile(url, 'utf8'))];
		})
	);
	return Object.fromEntries(entries);
};

function deck(overrides: Partial<DeckDefinition> = {}): DeckDefinition {
	return {
		v: 1,
		id: 'k3x9',
		name: 'Memory Verses',
		translation: 'bsb',
		list: '',
		breaks: {},
		revision: 4,
		...overrides
	};
}

describe('buildDeck', () => {
	it('builds notes for every reference, in list order', async () => {
		const def = deck({ list: '# Gospel\nJohn 3:16-17\n# Love\nRomans 8:39' });
		const result = await buildDeck(def, fromDisk, 1_800_000_000);
		expect(result.errors).toEqual([]);
		expect(result.groups.map((g) => [g.heading, g.refs.map((r) => r.label)])).toEqual([
			['Gospel', ['John 3:16-17']],
			['Love', ['Romans 8:39']]
		]);
		expect(result.passages.map((p) => p.ref.label)).toEqual(['John 3:16-17', 'Romans 8:39']);
		expect(result.build.notes.map((n) => [n.order, n.fields.Reference])).toEqual([
			[0, 'John 3:16'],
			[1, 'John 3:17'],
			[2, 'Romans 8:39']
		]);
		expect(result.build.notes[0].fields.Answer).toContain('For God so loved the world');
		expect(result.labels).toEqual(['John 3:16-17', 'Romans 8:39']);
		expect(result.questions).toEqual([]);
	});

	it('fills the build from the definition and the export time', async () => {
		const result = await buildDeck(
			deck({ name: '  Parent::Child  ', list: 'John 3:16' }),
			fromDisk,
			1_800_000_000
		);
		expect(result.build.deckId).toBe('k3x9');
		expect(result.build.deckName).toBe('Parent:Child');
		expect(result.build.exportedAt).toBe(1_800_000_000);
	});

	it('reports invalid lines and still builds the valid ones', async () => {
		const result = await buildDeck(
			deck({ list: 'John 3:16\nJohn 99\nNotabook 1' }),
			fromDisk,
			1_800_000_000
		);
		expect(result.errors.map((e) => e.line)).toEqual([2, 3]);
		expect(result.build.notes.map((n) => n.fields.Reference)).toEqual(['John 3:16']);
	});

	it('loads each needed book once, in the deck translation', async () => {
		const calls: [string, BookId[]][] = [];
		const spy: LoadBooks = (translation, ids, refs) => {
			calls.push([translation, ids]);
			return fromDisk(translation, ids, refs);
		};
		const result = await buildDeck(
			deck({ translation: 'kjv', list: 'John 3:16\nPsalm 23:1\nJohn 1:1' }),
			spy,
			1_800_000_000
		);
		expect(calls).toEqual([['kjv', ['JHN', 'PSA']]]);
		expect(result.passages.every((p) => p.translation === 'kjv')).toBe(true);
		expect(result.build.notes[0].fields.Info).toBe('John 3:16 · KJV');
	});

	it('uses the translation versification, so an omitted verse is in range', async () => {
		const result = await buildDeck(deck({ list: 'Matthew 17:21' }), fromDisk, 1_800_000_000);
		expect(result.errors).toEqual([]);
		expect(result.passages[0].verses[0].omitted).toBe(true);
		expect(result.build.notes).toEqual([]);
	});

	it('reports saved breaks that no longer match the text', async () => {
		const def = deck({
			list: 'John 3:16-17',
			breaks: { 'JHN.3.16': [{ after: 3, word: 'nothere' }] }
		});
		const result = await buildDeck(def, fromDisk, 1_800_000_000);
		expect(result.staleBreaks).toEqual(['JHN.3.16']);
	});

	it('does not change the definition', async () => {
		const def = deck({ list: 'John 3:16' });
		const copy = structuredClone(def);
		await buildDeck(def, fromDisk, 1_800_000_000);
		expect(def).toEqual(copy);
	});

	it('passes the references to the loader', async () => {
		let seen: string[] = [];
		const spy: LoadBooks = (translation, ids, refs) => {
			seen = refs.map((r) => r.label);
			return fromDisk(translation, ids, refs);
		};
		await buildDeck(deck({ list: 'John 3:16\n# H\nPsalm 23:1' }), spy, 1_800_000_000);
		expect(seen).toEqual(['John 3:16', 'Psalm 23:1']);
	});

	it('builds an empty deck from an empty list', async () => {
		const result = await buildDeck(deck(), fromDisk, 1_800_000_000);
		expect(result.build.notes).toEqual([]);
		expect(result.groups).toEqual([]);
	});
});

describe('buildDeck: catechism decks', () => {
	const noBooks: LoadBooks = () => Promise.reject(new Error('no books for a catechism deck'));
	const calls: CatechismId[] = [];
	const loadCatechism: LoadCatechism = async (id) => {
		calls.push(id);
		return FIXTURE;
	};
	const catechismDeck = (list: string) => deck({ catechism: 'wsc', list });

	it('builds one note per listed question, in list order, from the loaded text', async () => {
		calls.length = 0;
		const def = catechismDeck('# Rule\n2\n# End\nQ1\n3');
		const result = await buildDeck(def, noBooks, 1_800_000_000, loadCatechism);
		expect(calls).toEqual(['wsc']);
		expect(result.errors).toEqual([]);
		expect(result.passages).toEqual([]);
		expect(result.groups).toEqual([]);
		expect(result.staleBreaks).toEqual([]);
		expect(result.questions.map((g) => [g.heading, g.questions.map((q) => q.reference)])).toEqual([
			['Rule', ['WSC 2']],
			['End', ['WSC 1', 'WSC 3']]
		]);
		expect(result.labels).toEqual(['WSC 2', 'WSC 1', 'WSC 3']);
		expect(result.build.notes.map((n) => [n.order, n.guid])).toEqual([
			[0, 'bm1:k3x9:cat:wsc:2'],
			[1, 'bm1:k3x9:cat:wsc:1'],
			[2, 'bm1:k3x9:cat:wsc:3']
		]);
		expect(result.build.notes[1].fields.Info).toBe(
			'1 Corinthians 10:31; Psalm 73:25–28 · Westminster Shorter Catechism'
		);
		expect(result.build.notes[0].tags).toEqual(['bm::k3x9::r4']);
	});

	it('splits a long answer into parts, and still labels the export by question', async () => {
		const result = await buildDeck(catechismDeck('1\n4'), noBooks, 0, loadCatechism);
		expect(result.build.notes.map((n) => [n.fields.Reference, n.guid])).toEqual([
			['WSC 1', 'bm1:k3x9:cat:wsc:1'],
			['WSC 4 (1/2)', 'bm1:k3x9:cat:wsc:4'],
			['WSC 4 (2/2)', 'bm1:k3x9:cat:wsc:4:1']
		]);
		expect(result.labels).toEqual(['WSC 1', 'WSC 4']);
		expect(result.staleBreaks).toEqual([]);
	});

	it('uses the breaks saved for a question and reports stale ones by question key', async () => {
		const one = await buildDeck(
			deck({ catechism: 'wsc', list: '4', breaks: { 'wsc:4': [] } }),
			noBooks,
			0,
			loadCatechism
		);
		expect(one.build.notes.map((n) => n.fields.Reference)).toEqual(['WSC 4']);
		const stale = await buildDeck(
			deck({ catechism: 'wsc', list: '4', breaks: { 'wsc:4': [{ after: 2, word: 'nope' }] } }),
			noBooks,
			0,
			loadCatechism
		);
		expect(stale.staleBreaks).toEqual(['wsc:4']);
		expect(stale.build.notes).toHaveLength(2);
	});

	it('describes the deck with the catechism credit, when it has one', async () => {
		const plain = await buildDeck(catechismDeck('1'), noBooks, 0, loadCatechism);
		expect(plain.build.description).toBeUndefined();
		const credited = await buildDeck(
			deck({ catechism: 'bcc', list: '1' }),
			noBooks,
			0,
			async () => ({ ...FIXTURE, id: 'bcc' })
		);
		expect(credited.build.description).toBe(
			'The Baptist Catechism for Children, © 2023 Cross &amp; Crown Press. Used by permission of Fairview Baptist Church.'
		);
	});

	it('checks numbers against the catechism and still builds the valid lines', async () => {
		const result = await buildDeck(catechismDeck('1\n0\n108'), noBooks, 0, loadCatechism);
		expect(result.errors.map((e) => e.line)).toEqual([2, 3]);
		expect(result.build.notes.map((n) => n.fields.Reference)).toEqual(['WSC 1']);
	});

	it('does not load the text for an empty list', async () => {
		calls.length = 0;
		const result = await buildDeck(catechismDeck(''), noBooks, 0, loadCatechism);
		expect(calls).toEqual([]);
		expect(result.build.notes).toEqual([]);
	});

	it('needs a catechism loader', async () => {
		await expect(buildDeck(catechismDeck('1'), noBooks, 0)).rejects.toThrow(/catechism/i);
	});

	it('writes a package Anki can read', async () => {
		const { build } = await buildDeck(catechismDeck('1-3'), noBooks, 1_800_000_000, loadCatechism);
		const sqlDist = dirname(createRequire(import.meta.url).resolve('sql.js'));
		const SQL = await initSqlJs({ locateFile: (f) => join(sqlDist, f) });
		const db = new SQL.Database(unzipSync(writeApkg(build, SQL))['collection.anki2']);
		const rows = db.exec(
			'SELECT n.guid, n.sfld, n.flds, c.due FROM notes n JOIN cards c ON c.nid = n.id ORDER BY c.due'
		)[0].values as [string, string, string, number][];
		db.close();
		expect(rows.map(([guid, sfld, , due]) => [guid, sfld, due])).toEqual([
			['bm1:k3x9:cat:wsc:1', 'WSC 1', 0],
			['bm1:k3x9:cat:wsc:2', 'WSC 2', 1],
			['bm1:k3x9:cat:wsc:3', 'WSC 3', 2]
		]);
		expect(rows[0][2].split('\x1f')).toEqual(Object.values(build.notes[0].fields));
	});
});

describe('bundled catechisms end to end', () => {
	const fromStatic: LoadCatechism = async (id) =>
		JSON.parse(
			await readFile(new URL(`../../../static/catechisms/${id}.json`, import.meta.url), 'utf8')
		);

	it.each(Object.values(CATECHISMS))('$short builds every question', async ({ id, count }) => {
		const def = deck({ catechism: id, list: `1-${count}` });
		const { build, errors, labels, questions } = await buildDeck(
			def,
			fromDisk,
			1_800_000_000,
			fromStatic
		);
		expect(errors).toEqual([]);
		expect(labels).toHaveLength(count);
		const planned = questions.flatMap((g) => g.questions);
		expect(build.notes).toHaveLength(planned.reduce((n, q) => n + q.cards.length, 0));
		expect(new Set(build.notes.map((n) => n.guid)).size).toBe(build.notes.length);
		// Every question keeps the GUID it had before answers were split, on its first part.
		const guids = new Set(build.notes.map((n) => n.guid));
		for (let n = 1; n <= count; n++) expect(guids.has(questionGuid(def.id, id, n))).toBe(true);
		for (const note of build.notes) {
			expect(note.fields.Context).toMatch(/^<div class="line">.+<\/div>$/);
			expect(note.fields.Answer).toMatch(/^<div class="line">.+<\/div>$/);
			expect(
				note.fields.Info.endsWith(escapeHtml(CATECHISMS[id].credit ?? CATECHISMS[id].name))
			).toBe(true);
		}
	});
});

describe('presets end to end', () => {
	it.each(['nt.txt', 'ot.txt'])('%s builds and writes a package Anki can read', async (file) => {
		const list = await readFile(new URL(`../../../presets/${file}`, import.meta.url), 'utf8');
		const { build, errors, passages } = await buildDeck(deck({ list }), fromDisk, 1_800_000_000);
		expect(errors).toEqual([]);

		// Each verse is asked once, however many passages contain it.
		const verses = new Map(passages.flatMap((p) => p.verses.map((v) => [verseKey(v.ref), v])));
		const units = [...verses.values()].reduce((n, v) => n + splitUnits(v).units.length, 0);

		const sqlDist = dirname(createRequire(import.meta.url).resolve('sql.js'));
		const SQL = await initSqlJs({ locateFile: (f) => join(sqlDist, f) });
		const db = new SQL.Database(unzipSync(writeApkg(build, SQL))['collection.anki2']);
		const rows = db.exec(
			'SELECT n.guid, c.due FROM notes n JOIN cards c ON c.nid = n.id ORDER BY n.id'
		)[0].values as [string, number][];
		db.close();

		expect(rows.length).toBe(units);
		expect(new Set(rows.map(([guid]) => guid)).size).toBe(rows.length);
		expect(rows.map(([guid]) => guid)).toEqual(build.notes.map((n) => n.guid));
		expect(rows.map(([, due]) => due)).toEqual(rows.map((_, i) => i));
	});
});

// ---------------------------------------------------------------------------------------------
// Golden cards: real text, built as an export would be, written out for a person to judge.

/**
 * Field HTML as text. Each printed line sits right of a `│`, so its indent shows: 4 spaces per
 * level. A verse number stands left of the `│`; a bare `│` line is a paragraph or stanza gap.
 */
function lines(html: string): string[] {
	const out: string[] = [];
	for (const [, classes, inner] of html.matchAll(/<div class="line([^"]*)">(.*?)<\/div>/g)) {
		if (out.length > 0 && classes.includes('para')) out.push(`${''.padEnd(4)} │`);
		const vn = /^<span class="vn">(\d+)<\/span>/.exec(inner);
		const body = inner
			.replace(/^<span class="vn">\d+<\/span>/, '')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&amp;/g, '&');
		const indent = '    '.repeat(Number(/i(\d)/.exec(classes)?.[1] ?? 0));
		out.push(`${(vn?.[1] ?? '').padStart(4)} │ ${indent}${body}`);
	}
	return out;
}

function describeNote(note: NoteSpec): string {
	const block = (label: string, html: string) => {
		const body = lines(html);
		if (body.length === 0) return `${label.padEnd(15)}(none)`;
		return body.map((line, i) => (i === 0 ? label : '').padEnd(8) + line).join('\n');
	};
	return [
		`── ${note.order + 1}. ${note.fields.Reference} `.padEnd(72, '─'),
		block('Lead-in', note.fields.Context),
		block('Answer', note.fields.Answer),
		block('Hint', note.fields.Hint),
		`${'Info'.padEnd(15)}${note.fields.Info}`,
		`${'GUID'.padEnd(15)}${note.guid}`
	].join('\n');
}

const GOLDEN: [file: string, ref: string][] = [
	['psalm-23', 'Psalm 23'],
	['romans-8-38-39', 'Romans 8:38-39'],
	['john-3-16-17', 'John 3:16-17'],
	['proverbs-3-5-6', 'Proverbs 3:5-6'],
	['hebrews-1-1-4', 'Hebrews 1:1-4'],
	['isaiah-40-28-31', 'Isaiah 40:28-31'],
	['john-14-1-3-6', 'John 14:1-3, 6'],
	['james-1-2-4', 'James 1:2-4'],
	['matthew-17-20-22', 'Matthew 17:20-22'],
	['psalm-51-1-4', 'Psalm 51:1-4'],
	['psalm-46', 'Psalm 46'],
	['revelation-20-4-6', 'Revelation 20:4-6'],
	['ephesians-1-3-14', 'Ephesians 1:3-14']
];

describe.each(['bsb', 'web', 'kjv'] as TranslationId[])('golden cards: %s', (translation) => {
	it.each(GOLDEN)('%s', async (file, ref) => {
		const def = deck({ id: 'golden', translation, list: ref });
		const { build, errors, passages } = await buildDeck(def, fromDisk, 1_800_000_000);
		expect(errors).toEqual([]);
		const body = build.notes.map(describeNote).join('\n\n');
		await expect(
			`${passages[0].ref.label} (${translation.toUpperCase()})\n\n${body}\n`
		).toMatchFileSnapshot(`../../../tests/golden/cards/${translation}/${file}.txt`);
	});
});

// Every catechism answer that is split, part by part. Proofs and hints are left out: the split is
// what this is for, and proofs are edited separately.
describe('golden catechism splits', () => {
	it.each(Object.values(CATECHISMS))('$short', async ({ id, name, count }) => {
		const def = deck({ id: 'golden', catechism: id, list: `1-${count}` });
		const { build } = await buildDeck(def, fromDisk, 1_800_000_000, async (c) =>
			JSON.parse(
				await readFile(new URL(`../../../static/catechisms/${c}.json`, import.meta.url), 'utf8')
			)
		);
		const block = (label: string, html: string) =>
			lines(html)
				.map((line, i) => (i === 0 ? label : '').padEnd(8) + line)
				.join('\n');
		const split = build.notes.filter((n) => / \(\d+\/\d+\)$/.test(n.fields.Reference));
		const body = split
			.map((note) =>
				[
					`── ${note.fields.Reference} `.padEnd(72, '─'),
					block('Lead-in', note.fields.Context),
					block('Answer', note.fields.Answer),
					`${'GUID'.padEnd(15)}${note.guid}`
				].join('\n')
			)
			.join('\n\n');
		const questions = new Set(split.map((n) => n.fields.Reference.replace(/ \(.*/, ''))).size;
		await expect(
			`${name}: ${questions} of ${count} answers split, into ${split.length} cards\n\n${body}\n`
		).toMatchFileSnapshot(`../../../tests/golden/catechisms/${id}.txt`);
	});
});

describe('buildDeck: ESV', () => {
	// Made-up words in the shape of the ESV API's output: the ESV text is copyrighted.
	const esvLoader =
		(calls: string[][] = []): LoadBooks =>
		async (translation, _ids, refs) => {
			expect(translation).toBe('esv');
			const needed = esvVersesNeeded(refs, versificationFor('esv'));
			calls.push(esvQuery(needed));
			const text = parseEsvResponse({
				query: '',
				canonical: '',
				parsed: [
					[43003016, 43003017],
					[40017020, 40017021]
				],
				passage_meta: [],
				passages: [
					'  [16] For the light came into the room, [17] and the room was bright.\n\n',
					'  [20] He spoke to them.\n\n'
				]
			});
			return esvBooks(text);
		};

	it('builds from fetched verses, with an omitted verse marked', async () => {
		const calls: string[][] = [];
		const result = await buildDeck(
			deck({ translation: 'esv', list: 'John 3:16-17\nMatthew 17:20-21' }),
			esvLoader(calls),
			1_800_000_000
		);
		expect(calls).toEqual([['40017020-40017021,43003016-43003017']]);
		expect(result.errors).toEqual([]);
		expect(result.limitErrors).toEqual([]);
		expect(result.passages[1].verses.map((v) => v.omitted ?? false)).toEqual([false, true]);
		expect(result.build.notes.map((n) => n.fields.Reference)).toEqual([
			'John 3:16',
			'John 3:17',
			'Matthew 17:20'
		]);
		expect(result.build.notes[1].fields.Answer).toContain('and the room was bright.');
		expect(result.build.notes[1].fields.Context).toContain('For the light came into the room,');
	});

	it('puts the copyright notice and a link to esv.org in the deck description', async () => {
		const { build } = await buildDeck(
			deck({ translation: 'esv', list: 'John 3:16' }),
			esvLoader(),
			1_800_000_000
		);
		expect(build.description).toBe(
			'ESV® Bible (The Holy Bible, English Standard Version®), copyright © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.<br><a href="https://www.esv.org">https://www.esv.org</a>'
		);
		const bsb = await buildDeck(deck({ list: 'John 3:16' }), fromDisk, 1_800_000_000);
		expect('description' in bsb.build).toBe(false);
	});

	it('checks Crossway’s limits first and loads nothing when they are passed', async () => {
		const calls: string[][] = [];
		const result = await buildDeck(
			deck({ translation: 'esv', list: 'Jude 1-14\nJohn 3:16' }),
			esvLoader(calls),
			1_800_000_000
		);
		expect(calls).toEqual([]);
		expect(result.limitErrors).toEqual([
			'ESV decks may include at most half of a book: Jude has 25 verses, so at most 12; this deck shows 14.'
		]);
		expect(result.errors).toEqual([]);
		expect(result.groups.map((g) => g.refs.map((r) => r.label))).toEqual([
			['Jude 1-14', 'John 3:16']
		]);
		expect(result.passages).toEqual([]);
		expect(result.labels).toEqual([]);
		expect(result.build.notes).toEqual([]);
	});

	it('reports no limit errors for other translations', async () => {
		const result = await buildDeck(deck({ list: 'Jude 1-25' }), fromDisk, 1_800_000_000);
		expect(result.limitErrors).toEqual([]);
		expect(result.passages[0].verses).toHaveLength(25);
	});
});
