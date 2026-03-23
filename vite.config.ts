import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';

// Vite plugin that adds COEP/COOP headers to /zigfish/ responses in dev.
// Required for SharedArrayBuffer (chess WASM pthreads). Only the zigfish
// iframe needs these — the blog pages themselves have no COEP so Giscus works.
function coepPlugin(): Plugin {
	return {
		name: 'coep-headers',
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				if (req.url?.startsWith('/zigfish/')) {
					res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
					res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
				}
				next();
			});
		},
	};
}

export default defineConfig({
	plugins: [coepPlugin(), sveltekit()],
});
