<script lang="ts">
	import { Toggle } from 'bits-ui';
	import type { PreviewAnswer, PreviewQuestion } from '#lib/core/editor.ts';
	import type { Break } from '#lib/core/model.ts';
	import { verseWords } from '#lib/core/units.ts';
	import BreakEditor from './BreakEditor.svelte';
	import Lines from './Lines.svelte';
	import { muted, quiet } from './styles.ts';

	let {
		item,
		onbreaks
	}: {
		item: PreviewQuestion;
		/** `undefined` returns the answer to automatic breaks. */
		onbreaks: (breaks: Break[] | undefined) => void;
	} = $props();

	let editing = $state(false);
	/** Index of the card whose hint is shown. */
	let hints = $state<Record<number, boolean>>({});
	/** An answer of one word has nowhere to break. */
	const breakable = $derived(verseWords({ lines: item.answer }).length > 1);
</script>

{#snippet card(card: PreviewAnswer, first: boolean)}
	<article
		class="rounded-lg border border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900"
	>
		<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
			<p class="text-sm font-semibold">{card.reference}</p>
			<div class="flex gap-1">
				<Toggle.Root
					bind:pressed={() => !!hints[card.index], (on) => (hints[card.index] = on)}
					class={quiet}
				>
					Hint
				</Toggle.Root>
				{#if first && breakable}
					<Toggle.Root class={quiet} bind:pressed={editing}>Adjust breaks</Toggle.Root>
				{/if}
			</div>
		</div>
		<div class="mt-2 font-serif leading-relaxed text-stone-500 dark:text-stone-400">
			<p>{item.question}</p>
			{#if card.lead}
				<div class="mt-2"><Lines lines={card.lead} /></div>
			{/if}
		</div>
		<div
			class="mt-3 border-t border-dashed border-stone-200 pt-3 font-serif text-lg leading-relaxed dark:border-stone-700"
		>
			{#if hints[card.index]}
				<span class="sr-only">First letters:</span>
				<Lines lines={card.hint} />
			{:else}
				<Lines lines={card.answer} />
			{/if}
		</div>
		{#if item.proofs.length}
			<p class="mt-2 text-sm {muted}">{item.proofs.join('; ')}</p>
		{/if}
	</article>
{/snippet}

<div class="space-y-3">
	{#if editing}
		<BreakEditor
			label={item.reference}
			lines={item.answer}
			breaks={item.breaks}
			saved={item.saved}
			onchange={onbreaks}
			ondone={() => (editing = false)}
		/>
	{/if}
	{#each item.cards as c, i (c.index)}
		{@render card(c, i === 0)}
	{/each}
</div>
