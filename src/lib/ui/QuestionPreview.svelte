<script lang="ts">
	import { Toggle } from 'bits-ui';
	import type { PreviewQuestion } from '#lib/core/editor.ts';
	import Lines from './Lines.svelte';
	import { muted, quiet } from './styles.ts';

	let { card }: { card: PreviewQuestion } = $props();
	let hint = $state(false);
</script>

<article
	class="rounded-lg border border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900"
>
	<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
		<p class="text-sm font-semibold">{card.reference}</p>
		<Toggle.Root bind:pressed={hint} class={quiet}>Hint</Toggle.Root>
	</div>
	<p class="mt-2 font-serif leading-relaxed text-stone-500 dark:text-stone-400">{card.question}</p>
	<div
		class="mt-3 border-t border-dashed border-stone-200 pt-3 font-serif text-lg leading-relaxed dark:border-stone-700"
	>
		{#if hint}
			<span class="sr-only">First letters:</span>
			<Lines lines={card.hint} />
		{:else}
			<Lines lines={card.answer} />
		{/if}
	</div>
	{#if card.proofs.length}
		<p class="mt-2 text-sm {muted}">{card.proofs.join('; ')}</p>
	{/if}
</article>
