<script lang="ts">
	import { Select } from 'bits-ui';
	import { CATECHISMS, type CatechismId } from '#lib/core/catechisms.ts';
	import { field, focus } from './styles.ts';

	let { value = $bindable(), id }: { value: CatechismId; id: string } = $props();

	const items = Object.values(CATECHISMS).map((c) => ({ value: c.id, label: c.name }));
</script>

<Select.Root
	type="single"
	{items}
	bind:value={() => value, (v) => (value = v as CatechismId)}
	allowDeselect={false}
>
	<Select.Trigger {id} class="{field} flex items-center justify-between gap-2 text-left">
		<span class="truncate">{items.find((item) => item.value === value)?.label}</span>
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
