import { describe, expect, it } from 'vitest';
import { CATECHISMS, defaultQuestionList } from './catechisms.ts';

describe('CATECHISMS', () => {
	it.each(Object.values(CATECHISMS))('$short has sections in order, within its questions', (c) => {
		if (!c.sections) return expect(c.sections).toBeUndefined();
		expect(c.sections[0].first).toBe(1);
		for (let i = 1; i < c.sections.length; i++) {
			expect(c.sections[i].first).toBeGreaterThan(c.sections[i - 1].first);
		}
		expect(c.sections.at(-1)!.first).toBeLessThanOrEqual(c.count);
	});

	it.each(Object.values(CATECHISMS))('$short credit, if any, starts with its name', (c) => {
		if (c.credit === undefined) return expect(c.credit).toBeUndefined();
		expect(c.credit.startsWith(c.name)).toBe(true);
	});

	it('credits the Baptist Catechism for Children as the church asks', () => {
		expect(CATECHISMS.bcc).toMatchObject({
			short: 'BCC',
			name: 'The Baptist Catechism for Children',
			count: 145,
			credit:
				'The Baptist Catechism for Children, © 2023 Cross & Crown Press. Used by permission of Fairview Baptist Church.'
		});
	});
});

describe('defaultQuestionList', () => {
	it('lists every question', () => {
		expect(defaultQuestionList('wsc')).toBe('1-107');
	});

	it('lists every question under its section heading, when the catechism has sections', () => {
		expect(defaultQuestionList('bcc')).toBe(
			[
				'# God, Man and Sin',
				'1-37',
				'# Salvation',
				'38-72',
				'# Ten Commandments',
				'73-104',
				'# Prayer',
				'105-121',
				'# Word, Church and Ordinances',
				'122-135',
				'# Last Things',
				'136-145'
			].join('\n')
		);
	});
});
