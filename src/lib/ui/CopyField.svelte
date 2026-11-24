<script lang="ts">
	import { button, focus } from './styles.ts';

	let { value, label }: { value: string; label: string } = $props();
	let copied = $state(false);
	let failed = $state(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			[copied, failed] = [true, false];
			setTimeout(() => (copied = false), 2000);
		} catch {
			failed = true;
		}
	}
</script>

<div class="flex items-start gap-2">
	<!-- A read-only text box rather than an input: long values wrap and scroll. -->
	<div
		role="textbox"
		aria-readonly="true"
		aria-label={label}
		tabindex="0"
		class="{focus} max-h-24 min-w-0 flex-1 overflow-y-auto rounded-md border border-field bg-paper px-3 py-2 font-mono text-sm break-all select-all dark:border-field-dark dark:bg-paper-dark"
	>
		{value}
	</div>
	<button type="button" class="{button} shrink-0" onclick={copy}>
		{copied ? 'Copied' : 'Copy'}
	</button>
</div>
{#if failed}
	<p class="mt-1 text-sm">Could not copy. Select the text and copy it.</p>
{/if}
