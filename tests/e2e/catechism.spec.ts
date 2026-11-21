import { expect, test, type Download } from '@playwright/test';
import { unzipSync } from 'fflate';
import { readFile } from 'node:fs/promises';

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
