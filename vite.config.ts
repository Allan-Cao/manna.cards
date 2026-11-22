import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { ESV_PATH, handleEsv } from './worker/esv.ts';

export default defineConfig(({ command, mode }) => ({
	// ESV is a preview-only translation: on for `vite dev` (unless MANNA_ESV=0) and for builds
	// with MANNA_ESV=1; off for tests and production builds.
	define: {
		__ESV_ENABLED__: JSON.stringify(
			mode === 'test'
				? false
				: command === 'serve'
					? process.env.MANNA_ESV !== '0'
					: process.env.MANNA_ESV === '1'
		)
	},
	plugins: [
		{
			// Dev twin of worker/index.ts. The key comes from .env (ESV=...) and stays server-side:
			// Vite only exposes VITE_-prefixed vars to the client.
			name: 'manna-esv-dev',
			configureServer(server) {
				const key = loadEnv(mode, process.cwd(), '').ESV;
				server.middlewares.use(async (req, res, next) => {
					if (!req.url?.startsWith(ESV_PATH)) return next();
					const host = req.headers.host ?? 'localhost';
					const headers = new Headers();
					for (const [k, v] of Object.entries(req.headers)) {
						if (typeof v === 'string') headers.set(k, v);
					}
					const request = new Request(`http://${host}${req.url}`, { method: req.method, headers });
					const response = await handleEsv(request, key);
					res.statusCode = response.status;
					response.headers.forEach((v, k) => res.setHeader(k, v));
					res.end(Buffer.from(await response.arrayBuffer()));
				});
			}
		},
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// 404.html is the app shell: hosts serve it for unknown paths, and static/_redirects
			// serves it with status 200 for the client-only deck pages.
			adapter: adapter({ fallback: '404.html' })
		})
	],
	test: {
		environment: 'node',
		include: ['src/lib/core/**/*.test.ts', 'scripts/**/*.test.ts', 'worker/**/*.test.ts'],
		expect: { requireAssertions: true }
	}
}));
