import { getHighlighter as createShikiHighlighter } from 'shiki';
import { transformerTwoslash } from '@shikijs/twoslash';
import { escapeSvelte } from 'mdsvex';

let highlighterPromise = null;

function getHighlighter() {
	if (!highlighterPromise) {
		highlighterPromise = createShikiHighlighter({
			themes: ['github-light', 'github-dark'],
			langs: [
				'javascript', 'typescript', 'rust', 'nix', 'bash', 'shell',
				'json', 'toml', 'yaml', 'html', 'css', 'svelte', 'markdown',
				'zig', 'python', 'sql', 'diff', 'text', 'tsx', 'jsx',
			],
		});
	}
	return highlighterPromise;
}

/**
 * Custom Shiki highlighter for mdsvex.
 * Returns highlighted HTML that mdsvex inserts into the compiled Svelte component.
 */
export async function shikiHighlighter(code, lang, meta) {
	const highlighter = await getHighlighter();

	const effectiveLang = lang || 'text';

	// Load the language on demand if not already loaded
	const loadedLangs = highlighter.getLoadedLanguages();
	if (!loadedLangs.includes(effectiveLang)) {
		try {
			await highlighter.loadLanguage(effectiveLang);
		} catch {
			// Fall back to text if language not supported
			return `<pre><code>${escapeSvelte(code)}</code></pre>`;
		}
	}

	// Enable twoslash transformer when meta contains 'twoslash'
	const metaStr = meta || '';
	const transformers = [];
	if (metaStr.includes('twoslash')) {
		transformers.push(
			transformerTwoslash({
				explicitTrigger: false,
				twoslashOptions: {
					compilerOptions: {
						// Allow missing types (e.g. lodash) without failing
						noEmit: true,
						skipLibCheck: true,
						moduleResolution: 100, // bundler
					},
					handbookOptions: {
						errors: [], // Don't require @errors annotations
					},
				},
			})
		);
	}

	let html;
	try {
		html = highlighter.codeToHtml(code, {
			lang: effectiveLang,
			themes: {
				light: 'github-light',
				dark: 'github-dark',
			},
			transformers,
			meta: metaStr ? { __raw: metaStr } : undefined,
		});
	} catch (e) {
		// If twoslash fails (e.g. missing types), fall back to plain highlighting
		if (transformers.length > 0) {
			console.warn(`[shiki] Twoslash failed, falling back to plain highlight: ${e.message?.split('\n')[0]}`);
			html = highlighter.codeToHtml(code, {
				lang: effectiveLang,
				themes: { light: 'github-light', dark: 'github-dark' },
			});
		} else {
			throw e;
		}
	}

	// escapeSvelte prevents { } and other Svelte special chars in the
	// highlighted HTML from being interpreted as template expressions
	return `{@html \`${escapeSvelte(html)}\`}`;
}
