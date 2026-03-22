import { getHighlighter as createShikiHighlighter } from 'shiki';
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

	const html = highlighter.codeToHtml(code, {
		lang: effectiveLang,
		themes: {
			light: 'github-light',
			dark: 'github-dark',
		},
	});

	// escapeSvelte prevents { } and other Svelte special chars in the
	// highlighted HTML from being interpreted as template expressions
	return `{@html \`${escapeSvelte(html)}\`}`;
}
