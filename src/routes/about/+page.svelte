<script lang="ts">
	import { CATECHISMS } from '#lib/core/catechisms.ts';
	import { ESV_COPYRIGHT_PAGE } from '#lib/core/translations.ts';
	import { link, muted } from '#lib/ui/styles.ts';
</script>

<svelte:head><title>About · manna.cards</title></svelte:head>

<main class="mx-auto max-w-2xl space-y-10 px-4 py-10 leading-relaxed">
	<section>
		<h1 class="font-serif text-3xl font-semibold tracking-tight">About</h1>
		<p class="mt-4">
			manna.cards makes flash cards for <a class={link} href="https://apps.ankiweb.net/">Anki</a>
			from a list of passages. Each card shows a verse's reference and the verse before it, and asks you
			to recite the verse; long verses are split into two or three cards. It runs entirely in your browser:
			there is no account, and your decks stay on this device unless you share them.
		</p>
	</section>

	<section>
		<h2 class="text-xl font-semibold">Updating a deck</h2>
		<p class="mt-3">
			Every card knows which verse it asks, so when you change a deck and import the new file, Anki
			recognizes the cards it already has, updates them in place and keeps your progress. New
			passages arrive as new cards. Anki never deletes cards on import, so after removing passages
			the export window gives you a search that finds the old cards to delete. Renaming a deck here
			also means renaming it in Anki, or the new cards land in a second deck.
		</p>
	</section>

	<section>
		<h2 class="text-xl font-semibold">Bible text</h2>
		<p class="mt-3 {muted}">
			{#if __ESV_ENABLED__}
				The BSB, WEB and KJV come from <a class={link} href="https://ebible.org/">eBible.org</a>;
				the ESV is fetched from Crossway's ESV API as you build a deck, and is not stored.
			{:else}
				All three translations come from <a class={link} href="https://ebible.org/">eBible.org</a>.
			{/if}
		</p>
		<dl class="mt-3 space-y-3">
			<div>
				<dt class="font-medium">Berean Standard Bible (BSB)</dt>
				<dd class={muted}>Public domain since 2023.</dd>
			</div>
			<div>
				<dt class="font-medium">World English Bible (WEB)</dt>
				<dd class={muted}>Public domain. “World English Bible” is a trademark of eBible.org.</dd>
			</div>
			<div>
				<dt class="font-medium">King James Version (KJV)</dt>
				<dd class={muted}>Public domain outside the United Kingdom.</dd>
			</div>
			{#if __ESV_ENABLED__}
				<div>
					<dt class="font-medium">English Standard Version (ESV)</dt>
					<dd class={muted}>
						{ESV_COPYRIGHT_PAGE}
						<a class={link} href="https://www.esv.org">www.esv.org</a>
					</dd>
				</div>
			{/if}
		</dl>
	</section>

	<section>
		<h2 class="text-xl font-semibold">Catechisms</h2>
		<dl class="mt-3 space-y-3">
			{#each Object.values(CATECHISMS) as catechism (catechism.id)}
				<div>
					<dt class="font-medium">{catechism.name} ({catechism.short})</dt>
					<dd class={muted}>
						{#if catechism.credit}
							{catechism.credit}
						{:else}
							Public domain, from
							<a class={link} href="https://github.com/NonlinearFruit/Creeds.json">Creeds.json</a>.
						{/if}
					</dd>
				</div>
			{/each}
		</dl>
	</section>
</main>
