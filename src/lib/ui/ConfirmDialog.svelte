<script lang="ts">
	import { AlertDialog } from 'bits-ui';
	import { button, danger, primary } from './styles.ts';

	let {
		open = $bindable(false),
		title,
		description,
		confirm,
		destructive = false,
		onconfirm
	}: {
		open: boolean;
		title: string;
		description: string;
		/** Label of the confirming button. */
		confirm: string;
		destructive?: boolean;
		onconfirm: () => void;
	} = $props();
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Portal>
		<AlertDialog.Overlay class="fixed inset-0 z-40 bg-ink/40" />
		<AlertDialog.Content
			class="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-paper p-6 dark:border-line-dark dark:bg-paper-dark"
		>
			<AlertDialog.Title class="text-lg font-semibold">{title}</AlertDialog.Title>
			<AlertDialog.Description class="mt-2 leading-relaxed text-ink dark:text-ink-dark">
				{description}
			</AlertDialog.Description>
			<div class="mt-6 flex flex-wrap justify-end gap-2">
				<AlertDialog.Cancel class={button}>Cancel</AlertDialog.Cancel>
				<AlertDialog.Action
					class={destructive ? danger : primary}
					onclick={() => {
						onconfirm();
						open = false;
					}}
				>
					{confirm}
				</AlertDialog.Action>
			</div>
		</AlertDialog.Content>
	</AlertDialog.Portal>
</AlertDialog.Root>
