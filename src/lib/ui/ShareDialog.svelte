<script lang="ts">
	import { resolve } from '$app/paths';
	import { encodeShare } from '#lib/core/deckdef.ts';
	import type { DeckDefinition } from '#lib/core/model.ts';
	import { downloadDeckFile } from './browser.ts';
	import CopyField from './CopyField.svelte';
	import Modal from './Modal.svelte';
	import { button } from './styles.ts';

	let { open = $bindable(false), def }: { open: boolean; def: DeckDefinition } = $props();

	let url = $state('');
	$effect(() => {
		if (!open) return;
		const snapshot = $state.snapshot(def);
		encodeShare(snapshot).then(
			(text) => (url = new URL(resolve(`/open#${text}`), location.href).href)
		);
	});
</script>

<Modal bind:open title="Share this deck">
	<p>
		Anyone with the link gets their own copy. After you change the deck, send a new link to update
		theirs.
	</p>
	{#if url}<CopyField value={url} label="Share link" />{/if}
	<button type="button" class={button} onclick={() => downloadDeckFile($state.snapshot(def))}>
		Download deck file
	</button>
</Modal>
