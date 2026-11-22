import { expect, test, type Page } from '@playwright/test';

/**
 * The ESV proxy is mocked with made-up text in the API's format: real ESV text must never be
 * committed. The e2e build enables the ESV (MANNA_ESV=1 in playwright.config.ts).
 */
async function mockEsv(page: Page): Promise<string[]> {
	const queries: string[] = [];
	await page.route('**/api/esv/passage*', (route) => {
		const q = new URL(route.request().url()).searchParams.get('q') ?? '';
		queries.push(q);
		const parsed = q.split(',').map((r): [number, number] => {
			const [a, b = a] = r.split('-').map(Number);
			return [a, b];
		});
		const passages = parsed.map(([a, b]) => {
			const verses = [];
			for (let id = a; id <= b; id++) verses.push(`[${id % 1000}] Synthetic verse ${id % 1000}.`);
			return `  ${verses.join(' ')}\n\n`;
		});
		return route.fulfill({
			json: { query: q, canonical: q, parsed, passage_meta: [], passages }
		});
	});
	return queries;
}

async function newEsvDeck(page: Page) {
	await page.goto('/');
	const translation = page.getByLabel('Translation');
	await translation.click();
	const option = page.getByRole('option', { name: 'English Standard Version (ESV)' });
	test.skip((await option.count()) === 0, 'The ESV is not enabled on this build');
	await option.click();
	await page.getByLabel('Name').fill('ESV deck');
	await page.getByRole('button', { name: 'Create deck' }).click();
}

test('an ESV deck fetches its verses in few requests and shows the notice', async ({ page }) => {
	const queries = await mockEsv(page);
	await newEsvDeck(page);
	const list = page.getByLabel('Passages');
	await list.fill('John 3:16\nJohn 3:17');
	await expect(page.getByText('2 passages · 2 verses · 2 cards')).toBeVisible();
	await expect(page.getByText('Synthetic verse 17.').first()).toBeVisible();
	await expect(page.getByText(/Scripture quotations are from the ESV® Bible/)).toBeVisible();
	await expect(page.getByRole('link', { name: 'www.esv.org' })).toHaveAttribute(
		'href',
		'https://www.esv.org'
	);
	expect(queries).toEqual(['43003016-43003017']);

	// Typing a line asks once, for the new verse only, not on every keystroke.
	await list.press('End');
	await list.pressSequentially('\nJohn 3:18', { delay: 50 });
	await expect(page.getByText('3 passages · 3 verses · 3 cards')).toBeVisible();
	expect(queries).toHaveLength(2);
	expect(queries[1]).toMatch(/^43003018(-43003018)?$/);

	// Verses already fetched are not fetched again, for the preview or the export.
	await list.fill('John 3:16-18');
	await expect(page.getByText('1 passage · 3 verses · 3 cards')).toBeVisible();
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export for Anki' }).click();
	await download;
	expect(queries).toHaveLength(2);
});

test('an ESV deck over Crossway’s limits cannot be exported', async ({ page }) => {
	const queries = await mockEsv(page);
	await newEsvDeck(page);
	await page.getByLabel('Passages').fill('Genesis 1-20');
	await expect(page.getByText(/ESV decks are limited to 500 verses.*shows 514/)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Export for Anki' })).toBeDisabled();
	await expect(page.getByText('Shorten the list to export.')).toBeVisible();
	expect(queries).toEqual([]);
});
