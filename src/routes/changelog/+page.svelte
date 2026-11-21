<script lang="ts">
	import { changelog, planned } from '#lib/changelog.ts';
	import { muted } from '#lib/ui/styles.ts';
</script>

<svelte:head><title>Changelog · manna.cards</title></svelte:head>

<main class="mx-auto max-w-2xl space-y-10 px-4 py-10 leading-relaxed">
	<section>
		<h1 class="font-serif text-3xl font-semibold tracking-tight">Changelog</h1>
		<dl class="mt-4 space-y-3">
			{#each changelog as entry (entry.date + entry.note)}
				<div>
					<dt class="font-medium"><time datetime={entry.date}>{entry.date}</time></dt>
					<dd class={muted}>{entry.note}</dd>
				</div>
			{/each}
		</dl>
	</section>

	<section>
		<h2 class="text-xl font-semibold">Planned</h2>
		<ul class="mt-3 list-disc space-y-1 pl-5">
			{#each planned as item (item)}
				<li>{item}</li>
			{/each}
		</ul>
	</section>
</main>
