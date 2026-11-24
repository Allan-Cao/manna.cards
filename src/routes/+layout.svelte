<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { resolve } from '$app/paths';
	import { focus, link, muted } from '#lib/ui/styles.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>manna.cards</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<header class="border-b border-stone-200 dark:border-stone-800">
		<nav
			class="mx-auto flex max-w-6xl items-baseline justify-between gap-4 px-4 py-3"
			aria-label="Main"
		>
			<a
				href={resolve('/')}
				class="rounded font-serif text-lg font-semibold tracking-tight {focus}"
			>
				manna.cards
			</a>
			<div class="flex gap-4">
				<a href={resolve('/about')} class="text-sm {link}">About</a>
				<a href={resolve('/changelog')} class="text-sm {link}">Changelog</a>
			</div>
		</nav>
	</header>
	<div class="flex-1">
		{@render children()}
	</div>
	<footer class="border-t border-stone-200 dark:border-stone-800">
		<p class="mx-auto max-w-6xl px-4 py-6 text-sm {muted}">
			<a href="{resolve('/about')}#texts" class={link}>Bible and catechism texts</a> are public
			domain or used by permission. Code released under the
			<a href="https://github.com/Allan-Cao/Bible-Memorization" class={link}>MIT License</a>.
		</p>
	</footer>
</div>
