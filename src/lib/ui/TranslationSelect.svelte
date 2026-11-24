<script lang="ts">
	import { Select } from 'bits-ui';
	import type { TranslationId } from '#lib/core/model.ts';
	import { TRANSLATIONS } from '#lib/core/translations.ts';
	import { field, focus } from './styles.ts';

	let { value = $bindable(), id }: { value: TranslationId; id: string } = $props();

	const labelOf = (id: TranslationId) => `${TRANSLATIONS[id].name} (${TRANSLATIONS[id].short})`;
	// The ESV is offered only where it is enabled (the preview site).
	const items = Object.values(TRANSLATIONS)
		.filter((t) => !t.remote || __ESV_ENABLED__)
		.map((t) => ({ value: t.id, label: labelOf(t.id) }));
</script>

<Select.Root
	type="single"
	{items}
	bind:value={() => value, (v) => (value = v as TranslationId)}
	allowDeselect={false}
>
	<Select.Trigger {id} class="{field} flex items-center justify-between gap-2 text-left">
		<!-- A stored deck may be in a translation not offered here. -->
		<span class="truncate">{labelOf(value)}</span>
		<span aria-hidden="true" class="text-muted">▾</span>
	</Select.Trigger>
	<Select.Portal>
		<Select.Content
			sideOffset={4}
			class="z-50 w-(--bits-select-anchor-width) min-w-56 rounded-md border border-line bg-paper p-1 dark:border-line-dark dark:bg-paper-dark"
		>
			<Select.Viewport>
				{#each items as item (item.value)}
					<Select.Item
						value={item.value}
						label={item.label}
						class="flex cursor-default items-center justify-between gap-3 rounded px-3 py-2 text-sm data-highlighted:text-accent data-highlighted:underline dark:data-highlighted:text-accent-dark {focus}"
					>
						{#snippet children({ selected })}
							{item.label}
							{#if selected}<span aria-hidden="true">✓</span>{/if}
						{/snippet}
					</Select.Item>
				{/each}
			</Select.Viewport>
		</Select.Content>
	</Select.Portal>
</Select.Root>
