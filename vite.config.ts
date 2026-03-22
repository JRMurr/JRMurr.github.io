import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';

// Vite plugin that adds COEP/COOP headers to ALL dev server responses
// (both SSR pages and static files). Required for SharedArrayBuffer
// which the chess WASM engine needs.
function coepPlugin(): Plugin {
	return {
		name: 'coep-headers',
		configureServer(server) {
			server.middlewares.use((_req, res, next) => {
				res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
				res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
				next();
			});
		},
	};
}

export default defineConfig({
	plugins: [coepPlugin(), sveltekit()],
});
