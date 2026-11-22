// Preview Worker: static assets plus the ESV proxy. Production has no Worker script
// (wrangler.production.toml).
import { ESV_PATH, handleEsv } from './esv.ts';

interface Env {
	ASSETS: { fetch(request: Request): Promise<Response> };
	ESV_API_KEY?: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const { pathname } = new URL(request.url);
		if (pathname === ESV_PATH) return handleEsv(request, env.ESV_API_KEY);
		if (pathname.startsWith('/api/')) {
			return new Response(JSON.stringify({ detail: 'Not found' }), {
				status: 404,
				headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
			});
		}
		return env.ASSETS.fetch(request);
	}
};
