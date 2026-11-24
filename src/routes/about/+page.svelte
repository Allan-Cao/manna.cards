<script lang="ts">
	import { Accordion } from 'bits-ui';
	import { CATECHISMS } from '#lib/core/catechisms.ts';
	import { ESV_COPYRIGHT_PAGE } from '#lib/core/translations.ts';
	import { focus, link, muted } from '#lib/ui/styles.ts';

	const questions: { q: string; a: string }[] = [
		{
			q: 'What is on a card?',
			a: 'The front shows the reference and the verse before it; you recite the verse. Verses over about 30 words are split into two or three cards; choose Adjust breaks to move the split. Hint shows the first letter of each word. A catechism card asks one question, with its proof texts under the answer. Answers over about 30 words are split the same way, and each part is asked after the question and the part before it.'
		},
		{
			q: 'How do I get the deck into Anki?',
			a: 'Choose Export for Anki, then open the .apkg file with Anki, or choose File › Import in Anki. Leave the import options as they are.'
		},
		{
			q: 'Can I change a deck I already imported?',
			a: 'Yes. Edit the list and export again. Anki updates the cards you have and keeps their progress; new passages arrive as new cards. Anki does not delete cards on import, so when you remove passages the export window gives a search that finds the old cards.'
		},
		{
			q: 'Why did my cards go into a second deck?',
			a: 'Anki finds a deck by its name. If you rename a deck here, rename it in Anki too before you import.'
		},
		{
			q: 'Why do new cards come up out of order?',
			a: 'Anki keeps the order of cards it already has, so cards from a passage added in the middle of the list come up out of list order.'
		},
		{
			q: 'What happens if I change the translation?',
			a: 'The cards in the new translation are new cards in Anki and start with no progress. Breaks you set are cleared.'
		},
		{
			q: 'Where are my decks saved?',
			a: "Only in the browser that made them. There is no account. Clearing this site's data deletes them."
		},
		{
			q: 'How do I move or share a deck?',
			a: 'Choose Share. The link, or the deck file, holds the deck. Whoever opens it gets their own copy, and a newer link updates it.'
		}
	];
</script>

<svelte:head><title>About · manna.cards</title></svelte:head>

<main class="mx-auto max-w-2xl space-y-10 px-4 py-10 leading-relaxed">
	<section>
		<h1 class="font-serif text-3xl font-semibold tracking-tight">About</h1>
		<p class="mt-4">
			manna.cards makes <a class={link} href="https://apps.ankiweb.net/">Anki</a> flash cards from Bible
			passages and catechism questions.
		</p>
	</section>

	<section aria-labelledby="questions-heading">
		<h2 id="questions-heading" class="text-xl font-semibold">Questions</h2>
		<Accordion.Root
			type="multiple"
			class="mt-3 divide-y divide-stone-200 border-y border-stone-200 dark:divide-stone-800 dark:border-stone-800"
		>
			{#each questions as item (item.q)}
				<Accordion.Item value={item.q}>
					<Accordion.Header level={3}>
						<Accordion.Trigger
							class="group flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left font-medium {focus}"
						>
							{item.q}
							<span
								aria-hidden="true"
								class="text-stone-500 transition-transform group-data-[state=open]:rotate-180"
								>▾</span
							>
						</Accordion.Trigger>
					</Accordion.Header>
					<Accordion.Content class="pb-4">{item.a}</Accordion.Content>
				</Accordion.Item>
			{/each}
		</Accordion.Root>
	</section>

	<section id="texts" aria-labelledby="texts-heading" class="space-y-6">
		<h2 id="texts-heading" class="text-xl font-semibold">Texts and copyright</h2>
		<section>
			<h3 class="font-semibold">Bible translations</h3>
			<p class="mt-3 {muted}">
				{#if __ESV_ENABLED__}
					The BSB, WEB and KJV come from <a class={link} href="https://ebible.org/">eBible.org</a>;
					the ESV is fetched from Crossway's ESV API as you build a deck, and is not stored.
				{:else}
					From <a class={link} href="https://ebible.org/">eBible.org</a>.
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
			<h3 class="font-semibold">Catechisms</h3>
			<dl class="mt-3 space-y-3">
				{#each Object.values(CATECHISMS) as catechism (catechism.id)}
					<div>
						<dt class="font-medium">{catechism.name} ({catechism.short})</dt>
						<dd class={muted}>
							{#if catechism.credit}
								{catechism.credit}
							{:else}
								Public domain, from
								<a class={link} href="https://github.com/NonlinearFruit/Creeds.json">Creeds.json</a
								>.
							{/if}
							{#if catechism.id === 'wsc'}
								The proofs are the Westminster Assembly's, from the London printing of 1649, as
								transcribed by the
								<a class={link} href="https://github.com/textcreationpartnership/A80320"
									>Text Creation Partnership</a
								>.
							{/if}
						</dd>
					</div>
				{/each}
			</dl>
		</section>
	</section>

	<section aria-labelledby="code-heading">
		<h2 id="code-heading" class="text-xl font-semibold">Code</h2>
		<p class="mt-3">
			The code is on <a class={link} href="https://github.com/Allan-Cao/Bible-Memorization"
				>GitHub</a
			> under the MIT License.
		</p>
	</section>
</main>
