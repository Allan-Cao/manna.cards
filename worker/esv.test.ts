import { describe, expect, it } from 'vitest';
import { ESV_PARAMS, handleEsv } from './esv.ts';
import worker from './index.ts';

const KEY = 'k'.repeat(40);
const ORIGIN = 'https://preview.example';
const sameOrigin = { 'sec-fetch-site': 'same-origin' };

function fake(body: unknown = { passages: ['  [35] Jesus wept.'] }, init: ResponseInit = {}) {
	const calls: { url: URL; init?: RequestInit }[] = [];
	const fetchImpl = async (input: string, i?: RequestInit) => {
		calls.push({ url: new URL(input), init: i });
		return new Response(JSON.stringify(body), {
			headers: { 'content-type': 'application/json' },
			...init
		});
	};
	return { calls, fetchImpl };
}

const req = (q: string | null, headers: Record<string, string> = sameOrigin, method = 'GET') =>
	new Request(`${ORIGIN}/api/esv/passage${q === null ? '' : `?q=${encodeURIComponent(q)}`}`, {
		method,
		headers
	});

describe('handleEsv', () => {
	it('fixes upstream params, ignores client params, and sends the key only upstream', async () => {
		const { calls, fetchImpl } = fake();
		const r = new Request(`${ORIGIN}/api/esv/passage?q=John+11:35&include-headings=true`, {
			headers: sameOrigin
		});
		const res = await handleEsv(r, KEY, fetchImpl);
		expect(res.status).toBe(200);
		expect(calls).toHaveLength(1);
		const { url, init } = calls[0];
		expect(url.origin + url.pathname).toBe('https://api.esv.org/v3/passage/text/');
		expect(url.searchParams.get('q')).toBe('John 11:35');
		for (const [k, v] of Object.entries(ESV_PARAMS)) expect(url.searchParams.get(k)).toBe(v);
		expect(url.searchParams.get('include-headings')).toBe('false');
		expect((init?.headers as Record<string, string>).Authorization).toBe(`Token ${KEY}`);
		expect(url.toString()).not.toContain(KEY);
		const text = await res.text();
		expect(text).not.toContain(KEY);
		expect(JSON.parse(text).passages[0]).toContain('Jesus wept');
		expect(res.headers.get('cache-control')).toBe('no-store');
	});

	it('passes upstream status and Retry-After through', async () => {
		const { fetchImpl } = fake(
			{ detail: 'throttled' },
			{ status: 429, headers: { 'retry-after': '7' } }
		);
		const res = await handleEsv(req('John 1:1'), KEY, fetchImpl);
		expect(res.status).toBe(429);
		expect(res.headers.get('retry-after')).toBe('7');
		expect(res.headers.get('cache-control')).toBe('no-store');
	});

	it('rejects non-GET with 405', async () => {
		const { calls, fetchImpl } = fake();
		const res = await handleEsv(req('John 1:1', sameOrigin, 'POST'), KEY, fetchImpl);
		expect(res.status).toBe(405);
		expect(calls).toHaveLength(0);
	});

	it('requires q and limits its length', async () => {
		const { calls, fetchImpl } = fake();
		expect((await handleEsv(req(null), KEY, fetchImpl)).status).toBe(400);
		expect((await handleEsv(req('  '), KEY, fetchImpl)).status).toBe(400);
		expect((await handleEsv(req('a'.repeat(2001)), KEY, fetchImpl)).status).toBe(400);
		expect((await handleEsv(req('a'.repeat(2000)), KEY, fetchImpl)).status).toBe(200);
		expect(calls).toHaveLength(1);
	});

	it('rejects cross-site requests', async () => {
		const { calls, fetchImpl } = fake();
		for (const headers of <Record<string, string>[]>[
			{ 'sec-fetch-site': 'cross-site' },
			{ 'sec-fetch-site': 'same-site' },
			{ origin: 'https://evil.example' },
			{}
		]) {
			expect((await handleEsv(req('John 1:1', headers), KEY, fetchImpl)).status).toBe(403);
		}
		expect(calls).toHaveLength(0);
	});

	it('allows a missing Sec-Fetch-Site with a matching Origin', async () => {
		const { fetchImpl } = fake();
		const res = await handleEsv(req('John 1:1', { origin: ORIGIN }), KEY, fetchImpl);
		expect(res.status).toBe(200);
	});

	it('returns 503 without a key, and 502 when upstream is unreachable', async () => {
		const { calls, fetchImpl } = fake();
		const res = await handleEsv(req('John 1:1'), undefined, fetchImpl);
		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({ detail: 'ESV is not configured' });
		expect(calls).toHaveLength(0);
		const boom = async () => {
			throw new Error(`failed with ${KEY}`);
		};
		const bad = await handleEsv(req('John 1:1'), KEY, boom);
		expect(bad.status).toBe(502);
		expect(await bad.text()).not.toContain(KEY);
	});
});

describe('worker', () => {
	const assets = { fetch: async (r: Request) => new Response(`asset:${new URL(r.url).pathname}`) };

	it('passes non-API requests to assets', async () => {
		const res = await worker.fetch(new Request(`${ORIGIN}/deck/abc`), { ASSETS: assets });
		expect(await res.text()).toBe('asset:/deck/abc');
	});

	it('serves the ESV route and 404s other /api paths', async () => {
		const res = await worker.fetch(req('John 1:1'), { ASSETS: assets });
		expect(res.status).toBe(503);
		const other = await worker.fetch(new Request(`${ORIGIN}/api/other`), { ASSETS: assets });
		expect(other.status).toBe(404);
	});
});
