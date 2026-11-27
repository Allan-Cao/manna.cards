<script lang="ts">
	import { untrack } from 'svelte';
	import type { ExportReport } from './browser.ts';
	import CopyField from './CopyField.svelte';
	import Modal from './Modal.svelte';
	import { field, muted, notice } from './styles.ts';

	let {
		open = $bindable(false),
		report,
		error,
		catechism = false
	}: {
		open: boolean;
		report: ExportReport | null;
		error: string | null;
		catechism?: boolean;
	} = $props();

	/** Only the instructions use this: Anki does not let a deck file set the limit. A deck never changes kind. */
	const defaultPerDay = untrack(() => (catechism ? 3 : 5));
	let perDayInput = $state<number | null>(defaultPerDay);
	const perDay = $derived(
		Number.isInteger(perDayInput) && perDayInput! >= 1 && perDayInput! <= 9999
			? perDayInput!
			: defaultPerDay
	);

	const cards = (n: number) => (n === 1 ? '1 card' : `${n} cards`);
	const changes = $derived(report?.changes);
</script>

<Modal bind:open title={error ? 'Export failed' : 'Your deck is downloading'}>
	{#if error}
		<p role="alert" class="text-red-700 dark:text-red-400">{error}</p>
		<p>Nothing was downloaded. Try again, or reload the page.</p>
	{:else if report && changes}
		{#if report.renamedFrom}
			<p class={notice}>
				In Anki this deck is still “{report.renamedFrom}”. Rename it there before you import, or the
				new cards go into a second deck.
			</p>
		{/if}
		<p>
			Open <strong class="break-all">{report.fileName}</strong> with Anki, or choose
			<strong>File › Import</strong> in Anki.
		</p>

		<section aria-labelledby="limit-heading">
			<h3 id="limit-heading" class="font-semibold text-ink dark:text-ink-dark">
				New cards per day
			</h3>
			<div class="mt-1 flex items-center gap-2">
				<input
					id="new-per-day"
					type="number"
					min="1"
					max="9999"
					step="1"
					inputmode="numeric"
					class="{field} w-24"
					bind:value={perDayInput}
					aria-label="New cards per day"
				/>
				<span class="text-sm {muted}">
					{catechism ? 'Questions' : 'Verses'} a day is a good pace to start with.
				</span>
			</div>
			<ol class="mt-2 list-decimal space-y-1 pl-5">
				<li>When Anki shows the import options, tick <strong>Import any deck presets</strong>.</li>
				<li>
					After importing, click the gear beside this deck, choose <strong>Options</strong>, set
					<strong>New cards/day</strong> to
					<strong data-testid="new-per-day-value">{perDay}</strong>, and click
					<strong>Save</strong>.
				</li>
			</ol>
			<p class="mt-1 text-sm {muted}">
				Anki does not let a deck file set this, so you set it yourself. The limit is for this deck
				only; each deck has its own.
			</p>
		</section>

		{#if !changes.firstExport}
			<section aria-labelledby="changes-heading">
				<h3 id="changes-heading" class="font-semibold text-ink dark:text-ink-dark">
					Changes since your last export
				</h3>
				<ul class="mt-1 list-disc space-y-1 pl-5">
					{#if changes.addedPassages.length}
						<li>Added: {changes.addedPassages.join(', ')}</li>
					{/if}
					{#if changes.removedPassages.length}
						<li>Removed: {changes.removedPassages.join(', ')}</li>
					{/if}
					<li>
						{cards(changes.addedNotes)} added, {cards(changes.removedNotes)} removed. Existing cards keep
						their progress.
					</li>
				</ul>
			</section>
		{/if}

		{#if report.inserted.length}
			<p>
				New cards from {report.inserted.join(', ')} may come up out of list order: Anki keeps the order
				of cards it already has.
			</p>
		{/if}

		{#if changes.removedNotes > 0}
			<section aria-labelledby="cleanup-heading">
				<h3 id="cleanup-heading" class="font-semibold text-ink dark:text-ink-dark">
					Delete the old cards
				</h3>
				<p class="mt-1">Anki does not delete cards on import. After importing:</p>
				<ol class="mt-1 list-decimal space-y-1 pl-5">
					<li>In Anki, open <strong>Browse</strong>.</li>
					<li>Paste this into the search box and press Enter:</li>
				</ol>
				<div class="my-2"><CopyField value={report.search} label="Search for the old cards" /></div>
				<ol start="3" class="list-decimal space-y-1 pl-5">
					<li>Check that it finds {cards(changes.removedNotes)}.</li>
					<li>Select them all and delete them.</li>
				</ol>
			</section>
		{/if}
	{:else}
		<p>Making your deck…</p>
	{/if}
</Modal>
