import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// Required for SharedArrayBuffer (chess WASM engine).
	// In production, Cloudflare Pages applies these via static/_headers
	// scoped to the chess post path only. In dev, we apply globally.
	// 'credentialless' is less strict than 'require-corp' — allows same-origin
	// subresources (like the WASM fetch) without needing CORP headers on each.
	// Supported in Chrome/Firefox, not Safari (but Safari doesn't need COEP for SAB).
	response.headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');

	return response;
};
