import { expect, test, type Download } from '@playwright/test';
import { unzipSync } from 'fflate';
import { readFile } from 'node:fs/promises';
import { deflateRawSync } from 'node:zlib';

test('make a catechism deck, narrow its list and export it', async ({ page }) => {
	await page.goto('/');
	await page.getByLabel('Name').fill('Shorter Catechism');
	await page.getByLabel('Content').click();
	await page.getByRole('option', { name: 'Westminster Shorter Catechism' }).click();
	await expect(page.getByLabel('Translation')).toHaveCount(0);
	await page.getByRole('button', { name: 'Create deck' }).click();
	await expect(page).toHaveURL(/\/deck\/[a-z0-9]+$/);

	// A new deck starts with every question.
	const list = page.getByLabel('Questions');
	await expect(list).toHaveValue('1-107');
	await expect(page.getByText('107 questions')).toBeVisible();
	await expect(page.getByLabel('Translation')).toHaveCount(0);

	await list.fill('1-3\n200');
	await expect(page.getByText('Line 2:')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Export for Anki' })).toBeDisabled();

	await list.fill('1-3');
	await expect(page.getByText('3 questions')).toBeVisible();
	await expect(page.getByText('What is the chief end of man?')).toBeVisible();
	await expect(page.getByText('WSC 3')).toBeVisible();

	const download: Promise<Download> = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export for Anki' }).click();
	const file = await download;
	expect(file.suggestedFilename().replaceAll('_', ' ')).toBe('Shorter Catechism.apkg');
	const files = unzipSync(new Uint8Array(await readFile((await file.path())!)));
	expect(files['collection.anki2']).toBeDefined();

	// The deck list shows the catechism and how many questions it asks.
	await page.goto('/');
	await expect(page.getByText(/WSC · 3 questions · exported/)).toBeVisible();
});

test('a Baptist Catechism for Children deck starts with its sections and credits the church', async ({
	page
}) => {
	await page.goto('/');
	await page.getByLabel('Content').click();
	await page.getByRole('option', { name: 'The Baptist Catechism for Children' }).click();
	await page.getByRole('button', { name: 'Create deck' }).click();
	await expect(page).toHaveURL(/\/deck\/[a-z0-9]+$/);

	const list = page.getByLabel('Questions');
	await expect(list).toHaveValue(/^# God, Man and Sin\n1-37\n# Salvation\n38-72\n/);
	await expect(page.getByText('145 questions')).toBeVisible();

	await list.fill('# Prayer\n108-110');
	await expect(page.getByText('3 questions')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Prayer' })).toBeVisible();
	const q108 = page.locator('article').filter({ hasText: 'BCC 108' });
	await expect(q108).toContainText("How many requests are there in the Lord's Prayer?");
	await expect(q108).toContainText('Six.');
	await expect(page.locator('article').filter({ hasText: 'BCC 110' })).toContainText(
		'Psalm 145:21'
	);

	const download: Promise<Download> = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export for Anki' }).click();
	const files = unzipSync(new Uint8Array(await readFile((await (await download).path())!)));
	const collection = new TextDecoder().decode(files['collection.anki2']);
	expect(collection).toContain(
		'Psalm 145:21 · The Baptist Catechism for Children, © 2023 Cross &amp; Crown Press. Used by permission of Fairview Baptist Church.'
	);

	await page.goto('/about');
	await expect(
		page.getByText(
			'The Baptist Catechism for Children, © 2023 Cross & Crown Press. Used by permission of Fairview Baptist Church.'
		)
	).toBeVisible();
});

const retiredDeck = {
	v: 1,
	id: 'oldhc123',
	name: 'Heidelberg',
	translation: 'bsb',
	catechism: 'hc',
	list: '1-3',
	breaks: {},
	revision: 2
};

test('a saved deck for a retired catechism is listed, explained and can be deleted', async ({
	page
}) => {
	await page.goto('/');
	await page.evaluate(
		(def) => localStorage.setItem(`bm.deck.${def.id}`, JSON.stringify(def)),
		retiredDeck
	);
	await page.reload();
	await expect(page.getByRole('paragraph').filter({ hasText: /^Heidelberg$/ })).toBeVisible();
	await expect(page.getByText(/Heidelberg Catechism is no longer available/)).toBeVisible();

	await page.goto(`/deck/${retiredDeck.id}`);
	await expect(page.getByRole('alert')).toContainText('Heidelberg Catechism');
	await expect(page.getByRole('alert')).toContainText('no longer offers');

	await page.goto('/');
	await page.getByRole('button', { name: 'Delete Heidelberg' }).click();
	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	await expect(page.getByText(/no longer available/)).toHaveCount(0);
	expect(await page.evaluate((id) => localStorage.getItem(`bm.deck.${id}`), retiredDeck.id)).toBe(
		null
	);
});

test('a share link for a retired catechism names it', async ({ page }) => {
	const link = deflateRawSync(JSON.stringify({ ...retiredDeck, catechism: 'wlc' })).toString(
		'base64url'
	);
	await page.goto(`/open#${link}`);
	await expect(page.getByRole('alert')).toContainText(
		'This deck uses the Westminster Larger Catechism, which manna.cards no longer offers.'
	);
	await expect(page.getByText(/can no longer be built here/)).toBeVisible();
	await expect(page.getByText(/new link/)).toHaveCount(0);
});
