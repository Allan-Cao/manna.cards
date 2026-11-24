<script lang="ts">
	import type { ExportReport } from './browser.ts';
	import CopyField from './CopyField.svelte';
	import Modal from './Modal.svelte';
	import { notice } from './styles.ts';

	let {
		open = $bindable(false),
		report,
		error
	}: { open: boolean; report: ExportReport | null; error: string | null } = $props();

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
			<strong>File › Import</strong> in Anki. Leave the import options as they are.
		</p>

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
