import { expect, test, type Download } from '@playwright/test';
import { unzipSync } from 'fflate';
import { readFile } from 'node:fs/promises';
import { deflateRawSync } from 'node:zlib';

test('make a catechism deck, narrow its list and export it', async ({ page }) => {
	await page.goto('/');
	await page.getByLabel('Name').fill('Shorter Catechism');
	await page.getByRole('radio', { name: 'Catechism' }).click();
	await page.getByLabel('Catechism', { exact: true }).click();
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
	// The Assembly's proofs, from the 1649 printing.
	await expect(page.locator('article').filter({ hasText: 'WSC 1' })).toContainText(
		'1 Corinthians 10:31; Romans 11:36; Psalm 73:25–28'
	);

	const download: Promise<Download> = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export for Anki' }).click();
	const file = await download;
	expect(file.suggestedFilename().replaceAll('_', ' ')).toBe('Shorter Catechism.apkg');
	const files = unzipSync(new Uint8Array(await readFile((await file.path())!)));
	expect(files['collection.anki2']).toBeDefined();
	expect(new TextDecoder().decode(files['collection.anki2'])).toContain(
		'2 Timothy 1:13; 2 Timothy 3:16 · Westminster Shorter Catechism'
	);

	// The deck list shows the catechism and how many questions it asks.
	await page.goto('/');
	await expect(page.getByText(/WSC · 3 questions · exported/)).toBeVisible();
});

test('a long answer is asked in parts, whose breaks can be moved and are kept', async ({
	page
}) => {
	await page.goto('/');
	await page.getByLabel('Name').fill('Effectual calling');
	await page.getByRole('radio', { name: 'Catechism' }).click();
	await page.getByLabel('Catechism', { exact: true }).click();
	await page.getByRole('option', { name: 'Westminster Shorter Catechism' }).click();
	await page.getByRole('button', { name: 'Create deck' }).click();
	await expect(page).toHaveURL(/\/deck\/[a-z0-9]+$/);

	await page.getByLabel('Questions').fill('1\n31');
	await expect(page.getByText('2 questions · 3 cards')).toBeVisible();
	const card = (reference: string) =>
		page.locator('article').filter({ has: page.getByText(reference, { exact: true }) });
	await expect(card('WSC 1')).toBeVisible();
	await expect(card('WSC 31 (1/2)')).toContainText('What is effectual calling?');
	await expect(card('WSC 31 (1/2)')).toContainText(
		"Effectual calling is the work of God's Spirit, whereby, convincing us of our sin and misery, enlightening our minds in the knowledge of Christ,"
	);
	// The second part asks again, with the first part as its lead-in.
	const second = card('WSC 31 (2/2)');
	await expect(second).toContainText('What is effectual calling?');
	await expect(second).toContainText('enlightening our minds in the knowledge of Christ,');
	await expect(second).toContainText('and renewing our wills, he doth persuade and enable us');

	// Move the break: add one after “whereby,” and remove the automatic one.
	await card('WSC 31 (1/2)').getByRole('button', { name: 'Adjust breaks' }).click();
	await expect(page.getByRole('group', { name: 'Breaks in WSC 31' })).toBeVisible();
	await page.getByRole('button', { name: 'Break after “whereby,”' }).click();
	await expect(page.getByText('2 questions · 4 cards')).toBeVisible();
	await page.getByRole('button', { name: 'Remove the break after “Christ,”', exact: true }).click();
	await expect(page.getByText('2 questions · 3 cards')).toBeVisible();
	await expect(card('WSC 31 (1/2)')).toContainText(
		"Effectual calling is the work of God's Spirit, whereby,"
	);
	await expect(card('WSC 31 (2/2)')).toContainText('convincing us of our sin and misery');
	await page.getByRole('button', { name: 'Done' }).click();

	// The breaks are saved with the deck.
	await page.reload();
	await expect(page.getByText('2 questions · 3 cards')).toBeVisible();
	await expect(card('WSC 31 (2/2)')).toContainText('convincing us of our sin and misery');

	const download: Promise<Download> = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export for Anki' }).click();
	const files = unzipSync(new Uint8Array(await readFile((await (await download).path())!)));
	const collection = new TextDecoder().decode(files['collection.anki2']);
	expect(collection).toContain('WSC 31 (1/2)');
	expect(collection).toContain('WSC 31 (2/2)');
	expect(collection).toMatch(/bm1:[a-z0-9]+:cat:wsc:31:1/);

	// A catechism deck suggests 3 new cards a day.
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByRole('spinbutton', { name: 'New cards per day' })).toHaveValue('3');
	await expect(dialog.getByTestId('new-per-day-value')).toHaveText('3');
});

test('a Baptist Catechism for Children deck starts with its sections and credits the church', async ({
	page
}) => {
	await page.goto('/');
	await page.getByRole('radio', { name: 'Catechism' }).click();
	await page.getByLabel('Catechism', { exact: true }).click();
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

test('a Compendium deck starts with its parts, keeps the Creed a line per article and credits its printing', async ({
	page
}) => {
	const credit =
		"Compendium of the Heidelberg Catechism (Faukelius, 1608), tr. Archibald Laidlie (1767), as printed in the Reformed Protestant Dutch Church's Psalms and Hymns (1860). Public domain.";
	await page.goto('/');
	await page.getByRole('radio', { name: 'Catechism' }).click();
	await page.getByLabel('Catechism', { exact: true }).click();
	await page.getByRole('option', { name: 'Compendium of the Heidelberg Catechism' }).click();
	await page.getByRole('button', { name: 'Create deck' }).click();
	await expect(page).toHaveURL(/\/deck\/[a-z0-9]+$/);

	const list = page.getByLabel('Questions');
	await expect(list).toHaveValue(
		"# Introduction\n1\n# The Misery of Man\n2-13\n# Man's Deliverance\n14-63\n# Gratitude to God\n64-74"
	);
	await expect(page.getByText('74 questions')).toBeVisible();

	await list.fill("# Man's Deliverance\n19-20");
	await expect(page.getByText('2 questions')).toBeVisible();
	// Both answers are long, so they are asked in parts.
	await expect(page.getByText('2 questions · 5 cards')).toBeVisible();
	const q19 = page.locator('article').filter({ hasText: 'HSC 19 (2/2)' });
	await expect(q19).toContainText('What is true faith?');
	await expect(q19).toContainText('an hearty confidence that all my sins are forgiven me');
	await expect(page.locator('article').filter({ hasText: 'HSC 20 (1/3)' })).toContainText(
		'I. I believe in God, the Father Almighty, maker of heaven and earth.'
	);
	await expect(page.locator('article').filter({ hasText: 'HSC 20 (3/3)' })).toContainText(
		'XII. And the life everlasting.'
	);

	const download: Promise<Download> = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export for Anki' }).click();
	const files = unzipSync(new Uint8Array(await readFile((await (await download).path())!)));
	const collection = new TextDecoder().decode(files['collection.anki2']);
	expect(collection).toContain(credit);
	expect(collection).toContain('XII. And the life everlasting.');

	await page.goto('/about');
	await expect(page.getByText(credit)).toBeVisible();
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
	await expect(page.getByRole('link', { name: /^Heidelberg/ })).toBeVisible();
	await expect(page.getByText(/Heidelberg Catechism is no longer available/)).toBeVisible();

	await page.goto(`/deck/${retiredDeck.id}`);
	await expect(page.getByRole('alert')).toContainText('Heidelberg Catechism');
	await expect(page.getByRole('alert')).toContainText('no longer available');

	await page.goto('/');
	await page.getByRole('button', { name: 'Options for Heidelberg' }).click();
	await page.getByRole('menuitem', { name: 'Delete' }).click();
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
	await expect(page.getByText('Its cards stay in Anki.')).toBeVisible();
	await expect(page.getByText(/new link/)).toHaveCount(0);
});
