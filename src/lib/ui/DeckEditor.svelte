<script lang="ts">
	import { Tabs } from 'bits-ui';
	import { untrack } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { BuildResult } from '#lib/core/build.ts';
	import { buildDeck } from '#lib/core/build.ts';
	import { cleanDeckName } from '#lib/core/deckdef.ts';
	import { CATECHISMS } from '#lib/core/catechisms.ts';
	import { breaksLabel, previewDeck, previewQuestions, previewRows } from '#lib/core/editor.ts';
	import type { Break, DeckDefinition, TranslationId } from '#lib/core/model.ts';
	import { TRANSLATIONS } from '#lib/core/translations.ts';
	import { booksLoader, exportDeck, loadCatechism, type ExportReport } from './browser.ts';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import ExportDialog from './ExportDialog.svelte';
	import PassagePanel from './PassagePanel.svelte';
	import QuestionPreview from './QuestionPreview.svelte';
	import ShareDialog from './ShareDialog.svelte';
	import { deckStored, loadDeck, loadExport, saveDeck, watchDeck } from './storage.ts';
	import { button, field, focus, label, link, muted, notice, primary } from './styles.ts';
	import TranslationSelect from './TranslationSelect.svelte';

	let { initial }: { initial: DeckDefinition } = $props();

	// The editor keeps its own copy; the page remounts it for another deck.
	const def = $state(untrack(() => structuredClone(initial)));
	/** Set for a catechism deck, whose list holds question numbers. A deck never changes kind. */
	const catechism = untrack(() => (def.catechism ? CATECHISMS[def.catechism] : null));
	let exported = $state(loadExport(def.id));
	/** The browser refused to store the deck, so it lasts only as long as this page. */
	let unsaved = $state(false);
	$effect(() => {
		const snapshot = $state.snapshot(def);
		// Saving what is stored already would send a change taken from another tab back to it.
		if (JSON.stringify(snapshot) !== JSON.stringify(loadDeck(def.id))) saveDeck(snapshot);
		unsaved = !deckStored(def.id);
	});
	// Another tab may change or delete the deck: take its version rather than save over it.
	$effect(() =>
		watchDeck(def.id, () => {
			const stored = loadDeck(def.id);
			if (!stored) return goto(resolve('/'), { replaceState: true });
			Object.assign(def, stored);
			exported = loadExport(def.id);
		})
	);

	// The list is rebuilt a moment after typing stops; breaks and translation apply at once. A
	// remote translation (the ESV) waits longer, since each new passage is a request.
	let list = $state(def.list);
	$effect(() => {
		const text = def.list;
		const wait = TRANSLATIONS[def.translation].remote ? 800 : 300;
		const timer = setTimeout(() => (list = text), wait);
		return () => clearTimeout(timer);
	});

	let built = $state<{ result: BuildResult; def: DeckDefinition; added: string | null } | null>(
		null
	);
	let buildError = $state('');
	let labels = new Set<string>(); // of the previous build
	$effect(() => {
		// Only what changes the cards: renaming the deck does not rebuild them.
		const d: DeckDefinition = {
			v: 1,
			id: def.id,
			name: '',
			translation: def.translation,
			...(catechism && { catechism: catechism.id }),
			list,
			breaks: $state.snapshot(def.breaks),
			revision: 0
		};
		let current = true;
		buildDeck(
			d,
			booksLoader(() => current),
			0,
			loadCatechism
		).then(
			(result) => {
				if (!current) return;
				// A passage added on its own starts open, wherever it is in the list.
				const next = result.passages.map((p) => p.ref.label);
				const fresh = next.filter((label) => !labels.has(label));
				labels = new Set(next);
				[built, buildError] = [{ result, def: d, added: fresh.length === 1 ? fresh[0] : null }, ''];
			},
			(e) => current && (buildError = message(e))
		);
		return () => (current = false);
	});

	const result = $derived(built?.result);
	// A deck over the ESV limits has no passages to show, only the limit errors.
	const groups = $derived(
		built && !built.result.limitErrors.length ? previewDeck(built.def, built.result) : []
	);
	/** One flat list, so a passage's panel stays when a heading moves it into another group. */
	const rows = $derived(previewRows(groups));
	const questionRows = $derived(
		built ? previewQuestions(built.result.questions, built.def.breaks) : []
	);
	const verses = $derived(
		groups.flatMap((g) => g.passages.flatMap((p) => p.verses)).filter((v) => v.cards.length).length
	);
	const stale = $derived((result?.staleBreaks ?? []).map(breaksLabel));
	const translation = $derived(TRANSLATIONS[def.translation]);
	/** A stored deck in a translation this site does not offer (the ESV off the preview site). */
	const unavailable = $derived(!catechism && !!translation.remote && !__ESV_ENABLED__);
	const blocked = $derived(
		unavailable
			? `The ${translation.short} is not available on this site.`
			: !result
				? 'Making cards…'
				: result.errors.length
					? 'Fix the marked lines to export.'
					: result.limitErrors.length
						? 'Shorten the list to export.'
						: result.build.notes.length === 0
							? `Add a ${catechism ? 'question' : 'passage'} to export.`
							: ''
	);
	const renamed = $derived(exported && cleanDeckName(def.name) !== exported.name);

	function message(e: unknown): string {
		return e instanceof Error ? e.message : String(e);
	}

	function setBreaks(key: string, breaks: Break[] | undefined) {
		if (breaks) def.breaks[key] = breaks;
		else delete def.breaks[key];
	}

	let askTranslation = $state<TranslationId | null>(null);
	function setTranslation(t: TranslationId) {
		def.translation = t;
		def.breaks = {}; // word positions belong to the old text
	}

	let exportOpen = $state(false);
	let report = $state<ExportReport | null>(null);
	let exportError = $state<string | null>(null);
	/** One export at a time: each needs its own revision and compares with the one before. */
	let exporting = $state(false);
	async function runExport() {
		if (exporting) return;
		exporting = true;
		[report, exportError, exportOpen] = [null, null, true];
		// Another tab may have exported since this one loaded the deck.
		const revision = (def.revision = Math.max(def.revision, loadDeck(def.id)?.revision ?? 0) + 1);
		saveDeck($state.snapshot(def));
		try {
			report = await exportDeck($state.snapshot(def));
			exported = loadExport(def.id);
		} catch (e) {
			if (def.revision === revision) def.revision -= 1;
			exportError = message(e);
		} finally {
			exporting = false;
		}
	}

	let shareOpen = $state(false);

	/** Wide screens show the list and the cards side by side; narrow ones put them in tabs. */
	const wide = new MediaQuery('min-width: 64rem');
	/** A deck that already has a list opens on its cards. */
	let tab = $state(untrack(() => (def.list.trim() ? 'cards' : 'list')));
	const tabTrigger = `min-h-12 border-b-2 border-transparent -mb-px text-sm font-medium data-[state=active]:border-current ${focus}`;
</script>

<svelte:head><title>{cleanDeckName(def.name)} · manna.cards</title></svelte:head>

{#snippet actions()}
	<button type="button" class="{button} min-h-11" onclick={() => (shareOpen = true)}>Share</button>
	<button
		type="button"
		class="{primary} min-h-11"
		disabled={!!blocked || exporting}
		aria-describedby="export-blocked"
		onclick={runExport}
	>
		Export for Anki
	</button>
{/snippet}

{#snippet listPanel()}
	<section aria-label="Deck" class="space-y-5 {wide.current ? 'sticky top-4 self-start' : ''}">
		<div>
			<label for="deck-name" class={label}>Name</label>
			<input id="deck-name" class="{field} mt-1" bind:value={def.name} autocomplete="off" />
			{#if renamed && exported}
				<p class="{notice} mt-2">
					In Anki this deck is still “{exported.name}”. Rename it there to “{cleanDeckName(
						def.name
					)}” before you import, or the new cards go into a second deck.
				</p>
			{/if}
		</div>
		{#if catechism}
			<p class="text-sm {muted}">{catechism.name}</p>
		{:else}
			<div>
				<label for="deck-translation" class={label}>Translation</label>
				<div class="mt-1">
					<TranslationSelect
						id="deck-translation"
						bind:value={
							() => def.translation,
							(t) => {
								if (t === def.translation) return;
								if (exported) askTranslation = t;
								else setTranslation(t);
							}
						}
					/>
				</div>
			</div>
		{/if}
		<div>
			<label for="deck-list" class={label}>{catechism ? 'Questions' : 'Passages'}</label>
			<p id="list-help" class="mt-1 text-sm {muted}">
				{#if catechism}
					One per line: a number (<code>5</code>) or a range (<code>1-10</code>), from 1 to
					{catechism.count}. Start a line with <code>#</code> for a heading.
				{:else}
					One per line: <code>Psalm 23</code>, <code>John 3:16-18</code>,
					<code>John 14:1-3, 6</code>. Start a line with <code>#</code> for a heading.
				{/if}
			</p>
			<textarea
				id="deck-list"
				class="{field} mt-2 min-h-64 resize-y leading-relaxed"
				rows="12"
				spellcheck="false"
				aria-describedby="list-help list-errors"
				aria-invalid={!!result?.errors.length}
				bind:value={def.list}></textarea>
			<ul id="list-errors" aria-live="polite" class="mt-2 space-y-1 text-sm">
				{#each result?.errors ?? [] as error (error.line)}
					<li class="text-red-700 dark:text-red-400">
						<span class="font-semibold">Line {error.line}:</span>
						{error.message}
					</li>
				{/each}
			</ul>
		</div>
	</section>
{/snippet}

{#snippet cardsPanel()}
	<section aria-labelledby="cards-heading" class="min-w-0">
		<div class="flex flex-wrap items-baseline justify-between gap-x-4">
			<h2 id="cards-heading" class="font-heading text-xl font-bold">Cards</h2>
			{#if result && catechism}
				<p class="text-sm {muted}" aria-live="polite">
					{result.labels.length}
					{result.labels.length === 1 ? 'question' : 'questions'} · {result.build.notes.length}
					{result.build.notes.length === 1 ? 'card' : 'cards'}
				</p>
			{:else if result}
				<p class="text-sm {muted}" aria-live="polite">
					{result.passages.length}
					{result.passages.length === 1 ? 'passage' : 'passages'} · {verses}
					{verses === 1 ? 'verse' : 'verses'} · {result.build.notes.length}
					{result.build.notes.length === 1 ? 'card' : 'cards'}
				</p>
			{/if}
		</div>
		{#if unavailable}
			<p role="alert" class="{notice} mt-3">Choose another translation to see this deck's cards.</p>
		{:else if buildError}
			<p role="alert" class="mt-3 text-red-700 dark:text-red-400">{buildError}</p>
		{/if}
		{#if result?.limitErrors.length}
			<ul role="alert" class="mt-3 space-y-1 text-red-700 dark:text-red-400">
				{#each result.limitErrors as error (error)}
					<li>{error}</li>
				{/each}
			</ul>
		{/if}
		{#if !catechism && def.translation === 'esv' && !unavailable}
			<p class="mt-3 text-sm {muted}">
				Scripture quotations are from the {TRANSLATIONS.esv.copyright}
				<a class={link} href="https://www.esv.org">www.esv.org</a>
			</p>
		{/if}
		{#if stale.length}
			<p class="{notice} mt-3">
				The text of {stale.join(', ')} has changed. Your breaks there were replaced with automatic ones.
			</p>
		{/if}
		{#if result && groups.length === 0 && questionRows.length === 0}
			<p class="mt-3 {muted}">No cards yet.</p>
		{/if}
		{#if catechism}
			<div class="mt-4 space-y-3">
				{#each questionRows as row (row.key)}
					{#if row.kind === 'heading'}
						<h3
							class="border-b border-line pb-1 font-heading text-lg font-bold not-first:mt-6 dark:border-line-dark"
						>
							{row.heading}
						</h3>
					{:else}
						<QuestionPreview
							item={row.item}
							onbreaks={(breaks) => setBreaks(row.item.key, breaks)}
						/>
					{/if}
				{/each}
			</div>
		{/if}
		<div class="mt-4">
			{#each rows as row (row.key)}
				{#if row.kind === 'heading'}
					<h3
						class="mb-2 border-b border-line pb-1 font-heading text-lg font-bold not-first:mt-6 dark:border-line-dark"
					>
						{row.heading}
					</h3>
				{:else}
					<PassagePanel
						passage={row.passage}
						startOpen={row.index < 3 || row.passage.label === built?.added}
						level={row.underHeading ? 4 : 3}
						translation={TRANSLATIONS[def.translation].short}
						onbreaks={setBreaks}
					/>
				{/if}
			{/each}
		</div>
	</section>
{/snippet}

<main class="mx-auto max-w-6xl px-4 pt-8 {wide.current ? 'pb-8' : 'pb-4'}">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<h1 class="min-w-0 font-heading text-2xl font-bold tracking-tight break-words sm:text-3xl">
			{cleanDeckName(def.name)}
		</h1>
		{#if wide.current}
			<div class="flex flex-col items-end gap-1">
				<div class="flex gap-2">{@render actions()}</div>
				<p id="export-blocked" class="text-right text-sm {muted}">{blocked}</p>
			</div>
		{/if}
	</div>

	{#if unsaved}
		<p class="{notice} mt-4">
			This browser is not saving this deck. It is lost when you close or reload the page. To keep
			it, choose Share › Download deck file.
		</p>
	{/if}

	{#if wide.current}
		<div class="mt-6 grid grid-cols-[minmax(0,24rem)_minmax(0,1fr)] gap-10">
			{@render listPanel()}
			{@render cardsPanel()}
		</div>
	{:else}
		<Tabs.Root bind:value={tab} class="mt-4">
			<Tabs.List class="grid grid-cols-2 border-b border-line dark:border-line-dark">
				<Tabs.Trigger value="list" class={tabTrigger}
					>{catechism ? 'Questions' : 'Passages'}</Tabs.Trigger
				>
				<Tabs.Trigger value="cards" class={tabTrigger}>Cards</Tabs.Trigger>
			</Tabs.List>
			<Tabs.Content value="list" class="pt-5">{@render listPanel()}</Tabs.Content>
			<Tabs.Content value="cards" class="pt-5">{@render cardsPanel()}</Tabs.Content>
		</Tabs.Root>
	{/if}
</main>

{#if !wide.current}
	<div
		class="sticky bottom-0 z-10 border-t border-line bg-paper px-4 py-3 dark:border-line-dark dark:bg-paper-dark"
	>
		{#if blocked}<p id="export-blocked" class="mb-2 text-sm {muted}">{blocked}</p>{/if}
		<div class="grid grid-cols-[1fr_2fr] gap-2">{@render actions()}</div>
	</div>
{/if}

<ConfirmDialog
	bind:open={() => askTranslation !== null, (open) => !open && (askTranslation = null)}
	title="Change to the {askTranslation ? TRANSLATIONS[askTranslation].short : ''}?"
	description="Your next export makes new cards in the {askTranslation
		? TRANSLATIONS[askTranslation].short
		: ''}, with no progress. The old cards stay in Anki until you delete them. Breaks you set are cleared."
	confirm="Change translation"
	onconfirm={() => askTranslation && setTranslation(askTranslation)}
/>
<ExportDialog bind:open={exportOpen} {report} error={exportError} />
<ShareDialog bind:open={shareOpen} {def} />
