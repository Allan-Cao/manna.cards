import { describe, expect, it } from 'vitest';
import type { DeckDefinition } from './model.ts';
import {
	answerLines,
	makeQuestionNotes,
	parseQuestionList,
	planQuestions,
	questionGuid,
	questionLabel
} from './questions.ts';
import { FIXTURE } from './questions.fixture.ts';

const groups = (text: string, count = 107) =>
	parseQuestionList(text, count).groups.map((g) => [g.heading, g.questions]);
const errors = (text: string, count = 107) =>
	parseQuestionList(text, count).errors.map((e) => [e.line, e.input]);

describe('parseQuestionList: groups', () => {
	it.each([
		['one question', '5', [[null, [5]]]],
		['a range', '1-3', [[null, [1, 2, 3]]]],
		['a Q prefix', 'Q5', [[null, [5]]]],
		['a lower-case q prefix', 'q5', [[null, [5]]]],
		['a Q prefix on a range', 'Q1-3', [[null, [1, 2, 3]]]],
		['Q on both ends', 'Q1-Q3', [[null, [1, 2, 3]]]],
		['an en dash', '1–3', [[null, [1, 2, 3]]]],
		['spaces around the dash', ' 1 - 3 ', [[null, [1, 2, 3]]]],
		['a space after Q', 'Q 5', [[null, [5]]]],
		['a range of one', '4-4', [[null, [4]]]],
		['blank lines are ignored', '\n1\n\n2\r\n', [[null, [1, 2]]]],
		['the last question', '107', [[null, [107]]]],
		[
			'headings start groups',
			'1\n# Of God\n4-5\n## Of man\n10',
			[
				[null, [1]],
				['Of God', [4, 5]],
				['Of man', [10]]
			]
		],
		['an empty group is dropped', '# Empty\n# Full\n2', [['Full', [2]]]],
		['list order is kept', '9\n3\n5-6', [[null, [9, 3, 5, 6]]]],
		['a question already listed is asked once', '1-3\n2\n3-4', [[null, [1, 2, 3, 4]]]],
		['empty text', '', []]
	])('%s', (_, text, expected) => {
		expect(groups(text)).toEqual(expected);
		expect(parseQuestionList(text, 107).errors).toEqual([]);
	});
});

describe('parseQuestionList: errors', () => {
	it.each([
		['zero', '0'],
		['past the end', '108'],
		['a range past the end', '100-120'],
		['a reversed range', '5-3'],
		['words', 'Of God'],
		['a decimal', '1.5'],
		['a negative number', '-3'],
		['a list on one line', '1, 2'],
		['an open range', '3-'],
		['a verse reference', 'John 3:16']
	])('rejects %s', (_, input) => {
		const { groups, errors } = parseQuestionList(input, 107);
		expect(groups).toEqual([]);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({ line: 1, input });
		expect(errors[0].message).toBeTruthy();
	});

	it('names the number of questions when one is out of range', () => {
		expect(parseQuestionList('108', 107).errors[0].message).toMatch(/107/);
	});

	it('reports a line listed twice with the line it first appeared on', () => {
		const { errors } = parseQuestionList('5\nQ5', 107);
		expect(errors).toEqual([{ line: 2, input: 'Q5', message: expect.stringMatching(/line 1/) }]);
	});

	it('reports every bad line with its 1-based number and keeps the good ones', () => {
		expect(errors('1\nx\n\n2\n200')).toEqual([
			[2, 'x'],
			[5, '200']
		]);
		expect(groups('1\nx\n\n2\n200')).toEqual([[null, [1, 2]]]);
	});
});

describe('questionLabel', () => {
	it('is the short name and number', () => {
		expect(questionLabel('wsc', 1)).toBe('WSC 1');
		expect(questionLabel('bc', 114)).toBe('BC 114');
	});
});

const def: DeckDefinition = {
	v: 1,
	id: 'k3x9',
	name: 'Shorter',
	translation: 'bsb',
	catechism: 'wsc',
	list: '',
	breaks: {},
	revision: 4
};

describe('planQuestions', () => {
	it('looks up each question in list order, under its heading', () => {
		const { groups } = parseQuestionList('# End\n3\n1\n# Rule\n2', 3);
		const plan = planQuestions('wsc', FIXTURE, groups);
		expect(plan.map((g) => [g.heading, g.questions.map((q) => q.reference)])).toEqual([
			['End', ['WSC 3', 'WSC 1']],
			['Rule', ['WSC 2']]
		]);
		expect(plan[0].questions[1]).toMatchObject({
			key: 'wsc:1',
			question: FIXTURE.questions[0],
			answer: [{ text: FIXTURE.questions[0].a, indent: 0 }]
		});
	});

	it('throws when the text lacks a listed question', () => {
		expect(() => planQuestions('wsc', FIXTURE, [{ heading: null, questions: [4] }])).toThrow(
			/question 4/i
		);
	});
});

describe('answerLines', () => {
	it('is one line, or one per paragraph of the text', () => {
		expect(answerLines('  One answer.  ')).toEqual([{ text: 'One answer.', indent: 0 }]);
		expect(answerLines('First.\n\nSecond.')).toEqual([
			{ text: 'First.', indent: 0 },
			{ text: 'Second.', indent: 0, paragraph: true }
		]);
	});
});

describe('makeQuestionNotes', () => {
	const notes = (list: string) => {
		const plan = planQuestions('wsc', FIXTURE, parseQuestionList(list, 3).groups);
		return makeQuestionNotes(def, plan);
	};

	it('makes one note per question, in list order', () => {
		expect(notes('2\n1-3').map((n) => [n.order, n.fields.Reference])).toEqual([
			[0, 'WSC 2'],
			[1, 'WSC 1'],
			[2, 'WSC 3']
		]);
	});

	it('asks the question on the front and puts the answer on the back', () => {
		const [note] = notes('1');
		expect(note.fields).toEqual({
			Reference: 'WSC 1',
			Context: '<div class="line">What is the chief end of man?</div>',
			Answer:
				'<div class="line">Man’s chief end is to glorify God, and to enjoy him for ever.</div>',
			Hint: '<div class="line">M c e i t g G, a t e h f e.</div>',
			Info: '1 Corinthians 10:31; Psalm 73:25–28 · Westminster Shorter Catechism'
		});
	});

	it('escapes the text', () => {
		const [note] = notes('3');
		expect(note.fields.Context).toBe('<div class="line">Is 1 &lt; 2 &amp; &quot;so&quot;?</div>');
		expect(note.fields.Answer).toBe(
			'<div class="line">Yes: 1 &lt; 2 &amp; &quot;so&quot; — well-being.</div>'
		);
		expect(note.fields.Hint).toBe('<div class="line">Y: 1 &lt; 2 &amp; &quot;s&quot; — w-b.</div>');
	});

	it('shows just the catechism name when a question has no proofs', () => {
		expect(notes('3')[0].fields.Info).toBe('Westminster Shorter Catechism');
	});

	it('gives stable GUIDs from deck, catechism and number, whatever the order', () => {
		expect(notes('1-3').map((n) => n.guid)).toEqual([
			'bm1:k3x9:cat:wsc:1',
			'bm1:k3x9:cat:wsc:2',
			'bm1:k3x9:cat:wsc:3'
		]);
		expect(notes('3\n1')[0].guid).toBe('bm1:k3x9:cat:wsc:3');
		expect(questionGuid('k3x9', 'bc', 12)).toBe('bm1:k3x9:cat:bc:12');
	});

	it('tags every note with the revision', () => {
		expect(notes('1-2').map((n) => n.tags)).toEqual([['bm::k3x9::r4'], ['bm::k3x9::r4']]);
	});
});
