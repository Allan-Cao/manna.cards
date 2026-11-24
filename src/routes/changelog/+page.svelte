<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { changelog, planned } from '#lib/changelog.ts';

	/** How many entries each scroll batch adds. */
	const BATCH = 10;

	/** Entries grouped by date, newest first. */
	function byDate(entries: typeof changelog): { date: string; notes: string[] }[] {
		const days: { date: string; notes: string[] }[] = [];
		for (const { date, note } of entries) {
			const last = days.at(-1);
			if (last?.date === date) last.notes.push(note);
			else days.push({ date, notes: [note] });
		}
		return days;
	}

	let shown = $state(BATCH);
	const visible = $derived(byDate(changelog.slice(0, shown)));

	/** Shows the next batch when the element scrolls into view; shows everything without IntersectionObserver. */
	const more: Attachment = (sentinel) => {
		if (typeof IntersectionObserver === 'undefined') {
			shown = changelog.length;
			return;
		}
		// Reading `shown` re-runs this after each batch, so a sentinel still in view loads the next one.
		const next = Math.min(shown + BATCH, changelog.length);
		const observer = new IntersectionObserver((hits) => {
			if (hits.some((hit) => hit.isIntersecting)) shown = next;
		});
		observer.observe(sentinel);
		return () => observer.disconnect();
	};
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

<main class="mx-auto max-w-[1180px] space-y-10 px-4 py-10 leading-relaxed">
	<h1 class="font-heading text-3xl font-bold tracking-tight">Changelog</h1>

	{#if planned.length}
		<section aria-labelledby="planned-heading">
			<h2 id="planned-heading" class="font-heading text-xl font-bold">Planned</h2>
			<ul class="mt-3 list-disc space-y-1 pl-5">
				{#each planned as item (item)}
					<li>{item}</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section aria-labelledby="changes-heading" class="space-y-5">
		<h2 id="changes-heading" class="font-heading text-xl font-bold">Changes</h2>
		{@render days(visible)}
		{#if shown < changelog.length}
			<div {@attach more} aria-hidden="true"></div>
		{/if}
	</section>
</main>
