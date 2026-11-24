<script lang="ts">
	import { Collapsible } from 'bits-ui';
	import { changelog, planned } from '#lib/changelog.ts';
	import { button } from '#lib/ui/styles.ts';

	/** How many entries show before "Show earlier changes". */
	const RECENT = 10;

	/** Entries grouped by date, newest first; a date split by the cut appears in both groups. */
	function byDate(entries: typeof changelog): { date: string; notes: string[] }[] {
		const days: { date: string; notes: string[] }[] = [];
		for (const { date, note } of entries) {
			const last = days.at(-1);
			if (last?.date === date) last.notes.push(note);
			else days.push({ date, notes: [note] });
		}
		return days;
	}

	const recent = byDate(changelog.slice(0, RECENT));
	const earlier = byDate(changelog.slice(RECENT));
	let open = $state(false);
</script>

<svelte:head><title>Changelog · manna.cards</title></svelte:head>

{#snippet days(list: { date: string; notes: string[] }[])}
	{#each list as day (day.date)}
		<div>
			<h3 class="font-semibold"><time datetime={day.date}>{day.date}</time></h3>
			<ul class="mt-1 list-disc space-y-1 pl-5">
				{#each day.notes as note (note)}
					<li>{note}</li>
				{/each}
			</ul>
		</div>
	{/each}
{/snippet}

<main class="mx-auto max-w-2xl space-y-10 px-4 py-10 leading-relaxed">
	<h1 class="font-serif text-3xl font-semibold tracking-tight">Changelog</h1>

	{#if planned.length}
		<section aria-labelledby="planned-heading">
			<h2 id="planned-heading" class="text-xl font-semibold">Planned</h2>
			<ul class="mt-3 list-disc space-y-1 pl-5">
				{#each planned as item (item)}
					<li>{item}</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section aria-labelledby="changes-heading" class="space-y-5">
		<h2 id="changes-heading" class="text-xl font-semibold">Changes</h2>
		{@render days(recent)}
		{#if earlier.length}
			<Collapsible.Root bind:open class="space-y-5">
				<Collapsible.Content class="space-y-5">
					{@render days(earlier)}
				</Collapsible.Content>
				<Collapsible.Trigger class="{button} min-h-11">
					{open ? 'Hide earlier changes' : 'Show earlier changes'}
				</Collapsible.Trigger>
			</Collapsible.Root>
		{/if}
	</section>
</main>
