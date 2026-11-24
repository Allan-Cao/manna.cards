<script lang="ts">
	import { DropdownMenu, RadioGroup } from 'bits-ui';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { CATECHISMS, defaultQuestionList, type CatechismId } from '#lib/core/catechisms.ts';
	import {
		encodeShare,
		newDeck,
		parseDeckDefinition,
		RetiredCatechismError
	} from '#lib/core/deckdef.ts';
	import { passageCount } from '#lib/core/editor.ts';
	import type { DeckDefinition, TranslationId } from '#lib/core/model.ts';
	import { TRANSLATIONS } from '#lib/core/translations.ts';
	import ConfirmDialog from '#lib/ui/ConfirmDialog.svelte';
	import CatechismSelect from '#lib/ui/CatechismSelect.svelte';
	import { downloadDeckFile } from '#lib/ui/browser.ts';
	import ShareDialog from '#lib/ui/ShareDialog.svelte';
	import {
		deleteDeck,
		listDecks,
		listRetiredDecks,
		loadExport,
		saveDeck,
		type RetiredDeck
	} from '#lib/ui/storage.ts';
	import { button, field, focus, label, link, muted, primary } from '#lib/ui/styles.ts';
	import TranslationSelect from '#lib/ui/TranslationSelect.svelte';
	import ot from '../../presets/ot.txt?raw';
	import nt from '../../presets/nt.txt?raw';

	let decks = $state<DeckDefinition[]>([]);
	/** Decks for a catechism that is no longer offered: listed so they can be deleted. */
	let retired = $state<RetiredDeck[]>([]);
	/** The page is prerendered: until it is running here, its buttons would do nothing or reload. */
	let ready = $state(false);
	onMount(() => {
		decks = listDecks();
		retired = listRetiredDecks();
		ready = true;
	});

	let name = $state('');
	let kind = $state<'bible' | 'catechism'>('bible');
	let catechism = $state<CatechismId>('wsc');
	let translation = $state<TranslationId>('bsb');
	let deleting = $state<{ id: string; name: string } | null>(null);
	let sharing = $state<DeckDefinition | null>(null);
	/** Until the page runs here it cannot know, so the prerendered page greets a first visit. */
	const hasDecks = $derived(decks.length > 0 || retired.length > 0);
	const menuItem = `flex min-h-11 cursor-default items-center rounded px-3 text-sm data-highlighted:bg-stone-100 dark:data-highlighted:bg-stone-800 ${focus}`;
	let fileError = $state('');

	function exported(def: DeckDefinition): string {
		const at = loadExport(def.id)?.at;
		return at ? `exported ${new Date(at).toLocaleDateString()}` : 'not exported';
	}

	function summary(def: DeckDefinition): string {
		const n = passageCount(def);
		if (def.catechism) {
			return `${CATECHISMS[def.catechism].short} · ${n} ${n === 1 ? 'question' : 'questions'}`;
		}
		return `${TRANSLATIONS[def.translation].short} · ${n} ${n === 1 ? 'passage' : 'passages'}`;
	}

	function create(deckName: string, list = '', catechism?: CatechismId) {
		const def = { ...newDeck(deckName.trim(), translation, catechism), list };
		saveDeck(def);
		goto(resolve('/deck/[id]', { id: def.id }));
	}

	/** A catechism deck starts with every question, under its section headings if it has them. */
	function createFromForm() {
		if (kind === 'bible') return create(name || 'Memory verses');
		create(name || CATECHISMS[catechism].name, defaultQuestionList(catechism), catechism);
	}

	/** A deck file goes through /open, so a deck that is already here is handled the same way. */
	async function openFile(event: Event & { currentTarget: HTMLInputElement }) {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';
		if (!file) return;
		fileError = '';
		try {
			const def = parseDeckDefinition(JSON.parse(await file.text()));
			goto(resolve(`/open#${await encodeShare(def)}`));
		} catch (e) {
			if (e instanceof RetiredCatechismError) {
				fileError = `${file.name}: ${e.message}`;
				return;
			}
			fileError = `${file.name} is not a deck file: ${e instanceof Error ? e.message : e}`;
		}
	}
</script>

{#snippet menu(deck: { id: string; name: string }, def?: DeckDefinition)}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger
			class="flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 {focus}"
			aria-label="Options for {deck.name}"
		>
			<span aria-hidden="true">⋯</span>
		</DropdownMenu.Trigger>
		<DropdownMenu.Portal>
			<DropdownMenu.Content
				align="end"
				sideOffset={4}
				class="z-50 min-w-48 rounded-md border border-stone-200 bg-white p-1 shadow-lg dark:border-stone-700 dark:bg-stone-900"
			>
				{#if def}
					<DropdownMenu.Item class={menuItem} onSelect={() => (sharing = def)}>
						Share link
					</DropdownMenu.Item>
					<DropdownMenu.Item class={menuItem} onSelect={() => downloadDeckFile(def)}>
						Download deck file
					</DropdownMenu.Item>
					<DropdownMenu.Separator class="my-1 h-px bg-stone-200 dark:bg-stone-700" />
				{/if}
				<DropdownMenu.Item class={menuItem} onSelect={() => (deleting = deck)}>
					Delete
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Portal>
	</DropdownMenu.Root>
{/snippet}

<main class="mx-auto max-w-6xl px-4 py-8 lg:py-10">
	<div class="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
		{#if hasDecks}
			<section aria-labelledby="decks-heading" class="min-w-0 lg:flex-1">
				<h1 id="decks-heading" class="font-serif text-2xl font-semibold tracking-tight">
					Your decks
				</h1>
				<ul
					class="mt-3 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900"
				>
					{#each decks as def (def.id)}
						<li class="flex items-center gap-2 pr-1">
							<a
								href={resolve('/deck/[id]', { id: def.id })}
								class="min-w-0 flex-1 rounded-lg px-4 py-3 {focus}"
							>
								<span class="block font-medium break-words">{def.name}</span>
								<span class="block text-sm {muted}">{summary(def)} · {exported(def)}</span>
							</a>
							{@render menu(def, def)}
						</li>
					{/each}
					{#each retired as deck (deck.id)}
						<li class="flex items-center gap-2 pr-1">
							<a
								href={resolve('/deck/[id]', { id: deck.id })}
								class="min-w-0 flex-1 rounded-lg px-4 py-3 {focus}"
							>
								<span class="block font-medium break-words">{deck.name}</span>
								<span class="block text-sm {muted}"
									>The {deck.catechism} is no longer available.</span
								>
							</a>
							{@render menu(deck)}
						</li>
					{/each}
				</ul>
			</section>
		{:else}
			<section class="lg:flex-1">
				<h1 class="font-serif text-3xl font-semibold tracking-tight">
					Memorize Scripture with Anki
				</h1>
				<p class="mt-3 text-lg {muted}">
					Build a deck from Bible passages or a catechism, then import it into
					<a class={link} href="https://apps.ankiweb.net/">Anki</a>.
				</p>
			</section>
		{/if}

		<section aria-labelledby="new-heading" class="lg:w-96 lg:shrink-0">
			<h2 id="new-heading" class="text-xl font-semibold">New deck</h2>
			<form
				class="mt-3 space-y-4"
				onsubmit={(e) => {
					e.preventDefault();
					createFromForm();
				}}
			>
				<RadioGroup.Root
					bind:value={() => kind, (v) => (kind = v as 'bible' | 'catechism')}
					aria-label="Content"
					class="grid grid-cols-2 gap-2"
				>
					{#each [{ value: 'bible', label: 'Bible passages' }, { value: 'catechism', label: 'Catechism' }] as option (option.value)}
						<RadioGroup.Item
							value={option.value}
							class="flex min-h-11 items-center gap-2 rounded-md border border-stone-300 px-3 text-left text-sm font-medium data-[state=checked]:border-stone-900 dark:border-stone-700 dark:data-[state=checked]:border-stone-100 {focus}"
						>
							{#snippet children({ checked })}
								<span
									aria-hidden="true"
									class="flex size-4 shrink-0 items-center justify-center rounded-full border border-current"
								>
									{#if checked}<span class="size-2 rounded-full bg-current"></span>{/if}
								</span>
								{option.label}
							{/snippet}
						</RadioGroup.Item>
					{/each}
				</RadioGroup.Root>
				{#if kind === 'bible'}
					<div>
						<label for="new-translation" class={label}>Translation</label>
						<div class="mt-1">
							<TranslationSelect id="new-translation" bind:value={translation} />
						</div>
					</div>
				{:else}
					<div>
						<label for="new-catechism" class={label}>Catechism</label>
						<div class="mt-1"><CatechismSelect id="new-catechism" bind:value={catechism} /></div>
					</div>
				{/if}
				<div>
					<label for="new-name" class={label}>Name (optional)</label>
					<input
						id="new-name"
						class="{field} mt-1"
						bind:value={name}
						placeholder={kind === 'bible' ? 'Memory verses' : CATECHISMS[catechism].name}
						autocomplete="off"
					/>
				</div>
				<button type="submit" class="{primary} min-h-11 w-full" disabled={!ready}>
					Create deck
				</button>
			</form>

			{#if kind === 'bible'}
				<p class="mt-6 text-sm {muted}">
					Or start from the verses on <a
						class={link}
						href="https://billygrahamlibrary.org/decision-card/"
						target="_blank">Billy Graham's decision card</a
					>:
				</p>
				<div class="mt-2 grid grid-cols-2 gap-2">
					<button
						type="button"
						class="{button} min-h-11"
						disabled={!ready}
						onclick={() => create('Old Testament Memory Verses', ot)}
					>
						Old Testament verses
					</button>
					<button
						type="button"
						class="{button} min-h-11"
						disabled={!ready}
						onclick={() => create('New Testament Memory Verses', nt)}
					>
						New Testament verses
					</button>
				</div>
			{/if}

			<label
				class="{button} mt-8 cursor-pointer focus-within:outline-2 focus-within:outline-amber-600"
			>
				Open a deck file…
				<input
					type="file"
					accept=".json,application/json"
					class="sr-only"
					disabled={!ready}
					onchange={openFile}
				/>
			</label>
			{#if fileError}<p role="alert" class="mt-2 text-sm text-red-700 dark:text-red-400">
					{fileError}
				</p>{/if}
		</section>
	</div>
</main>

<ConfirmDialog
	bind:open={() => deleting !== null, (open) => !open && (deleting = null)}
	title="Delete “{deleting?.name}”?"
	description="It is removed from this browser. Its cards stay in Anki."
	confirm="Delete"
	destructive
	onconfirm={() => {
		if (deleting) deleteDeck(deleting.id);
		decks = listDecks();
		retired = listRetiredDecks();
	}}
/>
{#if sharing}
	<ShareDialog
		bind:open={() => sharing !== null, (open) => !open && (sharing = null)}
		def={sharing}
	/>
{/if}
