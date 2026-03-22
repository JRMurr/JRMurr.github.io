import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// Required for SharedArrayBuffer (chess WASM engine).
	// In production, Cloudflare Pages applies these via static/_headers
	// scoped to the chess post path only. In dev, we apply globally.
	response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');

	return response;
};
