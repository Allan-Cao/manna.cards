/**
 * Shared Tailwind class lists, so buttons and fields look the same everywhere. Colours are the
 * Umber tokens in `src/routes/layout.css`. Backgrounds stay plain paper: states are shown with
 * borders, text colour and underlines, never fills.
 */

export const focus =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent dark:focus-visible:outline-accent-dark';

const base = `inline-flex items-center justify-center gap-2 rounded-md border bg-paper px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:bg-paper-dark ${focus}`;

export const button = `${base} border-field font-medium text-ink hover:border-ink dark:border-field-dark dark:text-ink-dark dark:hover:border-ink-dark`;

export const primary = `${base} border-accent font-bold text-accent hover:border-ink hover:text-ink dark:border-accent-dark dark:text-accent-dark dark:hover:border-ink-dark dark:hover:text-ink-dark`;

export const danger = `${base} border-red-700 font-bold text-red-700 hover:border-red-900 hover:text-red-900 dark:border-red-400 dark:text-red-400 dark:hover:border-red-300 dark:hover:text-red-300`;

/** Small borderless button, for actions inside cards. */
export const quiet = `rounded px-1.5 py-0.5 text-xs font-medium text-muted hover:text-ink data-[state=on]:text-accent data-[state=on]:underline data-[state=on]:underline-offset-2 dark:text-muted-dark dark:hover:text-ink-dark dark:data-[state=on]:text-accent-dark ${focus}`;

export const field = `w-full rounded-md border border-field bg-paper px-3 py-2 text-base text-ink placeholder:text-muted dark:border-field-dark dark:bg-paper-dark dark:text-ink-dark dark:placeholder:text-muted-dark ${focus}`;

export const label = 'block text-sm font-medium text-ink dark:text-ink-dark';

export const link = `text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent dark:text-accent-dark dark:decoration-accent-dark/40 dark:hover:decoration-accent-dark ${focus}`;

export const muted = 'text-muted dark:text-muted-dark';

export const notice =
	'rounded-md border border-accent px-3 py-2 text-sm text-ink dark:border-accent-dark dark:text-ink-dark';
