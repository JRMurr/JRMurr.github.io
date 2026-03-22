import adapter from '@sveltejs/adapter-static';
import { mdsvex } from 'mdsvex';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { remarkCodeTitles, remarkDefaultCodeLang, twoSlashInclude } from './src/lib/remarkPlugins/index.js';
import { escapeMathPreprocessor } from './src/lib/remarkPlugins/escapeMath.js';
import { injectComponentsPreprocessor } from './src/lib/remarkPlugins/injectComponents.js';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', '.md'],
	preprocess: [
		// Escape math expressions before mdsvex parses them, preventing `<` in
		// math from being treated as HTML element syntax
		escapeMathPreprocessor(),
		injectComponentsPreprocessor(),
		mdsvex({
			extensions: ['.md'],
			// Components are injected via injectComponentsPreprocessor instead of layout
			remarkPlugins: [
				remarkMath,
				remarkDefaultCodeLang,
				twoSlashInclude,
				remarkCodeTitles,
			],
			rehypePlugins: [
				rehypeSlug,
				rehypeAutolinkHeadings,
				rehypeKatex,
			],
		}),
	],
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: undefined,
			strict: false,
		}),
		alias: {
			'$content': 'src/content',
		},
		prerender: {
			handleHttpError: 'warn',
		},
	},
};

export default config;
