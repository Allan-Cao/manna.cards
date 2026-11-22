// bible-memorization Worker: static assets plus the ESV proxy. Production has no Worker script
// (wrangler.production.toml).
//
// The live deployment (bible-memorization.allancao.workers.dev) is the open beta and must not
// offer ESV. ESV is tested on preview URLs (`<alias>-bible-memorization.allancao.workers.dev`,
// behind Cloudflare Access). Secrets are shared by every version of the Worker, so the proxy
// checks the host itself rather than relying on the beta build hiding the UI.
import { ESV_PATH, handleEsv } from './esv.ts';

interface Env {
	ASSETS: { fetch(request: Request): Promise<Response> };
	ESV_API_KEY?: string;
}

const PREVIEW_HOST = /^[a-z0-9-]+-bible-memorization\.allancao\.workers\.dev$/;

/** Preview URLs and `wrangler dev`. Not the open beta, not any other host. */
export function esvHost(hostname: string): boolean {
	return PREVIEW_HOST.test(hostname) || hostname === 'localhost' || hostname === '127.0.0.1';
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const { pathname, hostname } = new URL(request.url);
		if (pathname === ESV_PATH && esvHost(hostname)) return handleEsv(request, env.ESV_API_KEY);
		if (pathname.startsWith('/api/')) {
			return new Response(JSON.stringify({ detail: 'Not found' }), {
				status: 404,
				headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
			});
		}
		return env.ASSETS.fetch(request);
	}
};
