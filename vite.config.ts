import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		headers: {
			// Required for SharedArrayBuffer (used by the chess WASM engine).
			// In production, Cloudflare Pages applies these via static/_headers
			// only on the chess post path. In dev, we apply them globally since
			// there's no per-route header support in Vite's dev server.
			'Cross-Origin-Embedder-Policy': 'require-corp',
			'Cross-Origin-Opener-Policy': 'same-origin',
		},
	},
});
