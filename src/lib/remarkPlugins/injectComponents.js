// Svelte preprocessor that injects component imports into markdown files.
// In mdsvex with Svelte 5, the layout's script context isn't shared with
// the markdown content, so we need to inject imports directly.

const COMPONENT_IMPORTS = `
import TOCInline from '$lib/components/TOCInline.svelte';
import Note from '$lib/components/Note.svelte';
import IFrame from '$lib/components/IFrame.svelte';
import Chess from '$lib/components/Chess.svelte';
`.trim();

export function injectComponentsPreprocessor() {
	return {
		markup({ content, filename }) {
			if (!filename?.endsWith('.md')) return;

			// Check if there's already a <script> tag
			const scriptMatch = content.match(/^<script[^>]*>([\s\S]*?)<\/script>/m);

			let output;
			if (scriptMatch) {
				// Inject imports into existing script block
				output = content.replace(
					scriptMatch[0],
					scriptMatch[0].replace(scriptMatch[1], '\n' + COMPONENT_IMPORTS + '\n' + scriptMatch[1])
				);
			} else {
				// Add script block after frontmatter
				const fmEnd = content.indexOf('---', content.indexOf('---') + 3);
				if (fmEnd !== -1) {
					const insertPos = fmEnd + 3;
					output =
						content.slice(0, insertPos) +
						'\n\n<script>\n' +
						COMPONENT_IMPORTS +
						'\n</script>\n' +
						content.slice(insertPos);
				} else {
					output = '<script>\n' + COMPONENT_IMPORTS + '\n</script>\n\n' + content;
				}
			}

			return { code: output };
		},
	};
}
