// ESV passage proxy (preview site only). The Crossway API key may not be shared or published,
// so it lives server-side: here in the Worker (secret ESV_API_KEY) and, in `vite dev`, in .env.
// Nothing is cached or stored: text passes through and every response is `no-store`.

export const ESV_ENDPOINT = 'https://api.esv.org/v3/passage/text/';
export const ESV_PATH = '/api/esv/passage';
export const MAX_QUERY_LENGTH = 2000;

/** Fixed by the server; the client may only send `q`. */
export const ESV_PARAMS: Readonly<Record<string, string>> = {
	'include-passage-references': 'false',
	'include-verse-numbers': 'true',
	'include-first-verse-numbers': 'true',
	'include-footnotes': 'false',
	'include-footnote-body': 'false',
	'include-headings': 'false',
	'include-short-copyright': 'false',
	'include-copyright': 'false',
	'include-passage-horizontal-lines': 'false',
	'include-heading-horizontal-lines': 'false',
	'include-selahs': 'true',
	'indent-using': 'space',
	'indent-paragraphs': '2',
	'indent-poetry': 'true',
	'indent-poetry-lines': '4',
	'indent-declares': '40',
	'indent-psalm-doxology': '30',
	'line-length': '0'
};

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra }
	});
}

function sameSite(request: Request): boolean {
	const site = request.headers.get('sec-fetch-site');
	if (site !== null) return site === 'same-origin';
	const origin = request.headers.get('origin');
	return origin !== null && origin === new URL(request.url).origin;
}

/** Handles `GET /api/esv/passage?q=...`. `key` is undefined when ESV is not configured. */
export async function handleEsv(
	request: Request,
	key: string | undefined,
	fetchImpl: Fetch = (input, init) => fetch(input, init)
): Promise<Response> {
	if (request.method !== 'GET')
		return json({ detail: 'Method not allowed' }, 405, { allow: 'GET' });
	if (!sameSite(request)) return json({ detail: 'Forbidden' }, 403);
	const q = new URL(request.url).searchParams.get('q');
	if (!q || !q.trim()) return json({ detail: 'Missing q' }, 400);
	if (q.length > MAX_QUERY_LENGTH) return json({ detail: 'q is too long' }, 400);
	if (!key) return json({ detail: 'ESV is not configured' }, 503);

	const url = new URL(ESV_ENDPOINT);
	url.searchParams.set('q', q);
	for (const [name, value] of Object.entries(ESV_PARAMS)) url.searchParams.set(name, value);

	let upstream: Response;
	try {
		upstream = await fetchImpl(url.toString(), {
			headers: { Authorization: `Token ${key}`, accept: 'application/json' }
		});
	} catch {
		return json({ detail: 'ESV request failed' }, 502);
	}
	const headers: Record<string, string> = {
		'content-type': upstream.headers.get('content-type') ?? 'application/json',
		'cache-control': 'no-store'
	};
	const retryAfter = upstream.headers.get('retry-after');
	if (retryAfter) headers['retry-after'] = retryAfter;
	return new Response(upstream.body, { status: upstream.status, headers });
}
