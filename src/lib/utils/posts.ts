import type { Component } from 'svelte';
import readingTime from 'reading-time';
import { load as yamlLoad } from 'js-yaml';

// ==============================================================================
// Types
// ==============================================================================

export interface PostMetadata {
	title: string;
	seriesTitle?: string;
	slug: string;
	date: string;
	tags: string[];
	draft: boolean;
	summary: string;
	authors?: string[];
	layout?: string;
	lastmod?: string;
}

export interface Post {
	metadata: PostMetadata;
	component: Component;
	readingTime: { text: string; minutes: number; words: number };
}

export type PostSummary = Omit<Post, 'component'>;

export interface SeriesInfo {
	title: string;
	slug: string;
	posts: Post[];
}

// ==============================================================================
// Content Loading
// ==============================================================================

// mdsvex-compiled modules: each exports { default: SvelteComponent, metadata: frontmatter }
const postModules = import.meta.glob('/src/content/blog/**/*.md', { eager: true }) as Record<
	string,
	{ default: Component; metadata: PostMetadata }
>;

// Raw markdown for reading time calculation
const rawPosts = import.meta.glob('/src/content/blog/**/*.md', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>;

// Series info.yml files
const seriesFiles = import.meta.glob('/src/content/blog/**/info.yml', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>;

const isProduction = import.meta.env.PROD;

function buildPosts(): Post[] {
	const posts: Post[] = [];

	for (const [path, module] of Object.entries(postModules)) {
		const { metadata } = module;

		// Skip drafts in production
		if (isProduction && metadata.draft) continue;

		const raw = rawPosts[path] || '';
		const rt = readingTime(raw);

		posts.push({
			metadata,
			component: module.default,
			readingTime: { text: rt.text, minutes: rt.minutes, words: rt.words },
		});
	}

	// Sort by date descending
	posts.sort((a, b) => new Date(b.metadata.date).getTime() - new Date(a.metadata.date).getTime());

	return posts;
}

let _posts: Post[] | null = null;

export function getAllPosts(): Post[] {
	if (!_posts) {
		_posts = buildPosts();
	}
	return _posts;
}

export function getAllPostSummaries(): PostSummary[] {
	return getAllPosts().map(({ component: _, ...rest }) => rest);
}

// ==============================================================================
// Post Queries
// ==============================================================================

export function getPostBySlug(slug: string): Post | undefined {
	return getAllPosts().find((p) => p.metadata.slug === slug);
}

export function getPrevNext(slug: string): { prev: Post | undefined; next: Post | undefined } {
	const posts = getAllPosts();
	const index = posts.findIndex((p) => p.metadata.slug === slug);
	if (index === -1) return { prev: undefined, next: undefined };
	return {
		// Posts are sorted newest first, so "next" is newer (index - 1) and "prev" is older (index + 1)
		next: posts[index - 1],
		prev: posts[index + 1],
	};
}

// ==============================================================================
// Tags
// ==============================================================================

import { slug as githubSlug } from 'github-slugger';

export function getTagCounts(): Record<string, number> {
	const tagCount: Record<string, number> = {};
	for (const post of getAllPosts()) {
		for (const tag of post.metadata.tags) {
			const formattedTag = githubSlug(tag);
			tagCount[formattedTag] = (tagCount[formattedTag] || 0) + 1;
		}
	}
	return tagCount;
}

export function getPostsByTag(tag: string): Post[] {
	return getAllPosts().filter((post) =>
		post.metadata.tags.some((t) => githubSlug(t) === tag)
	);
}

// ==============================================================================
// Series
// ==============================================================================

function buildSeriesDescriptions(): Array<{ title: string; slug: string }> {
	const descriptions: Array<{ title: string; slug: string }> = [];
	for (const [path, raw] of Object.entries(seriesFiles)) {
		const parsed = yamlLoad(raw) as { title: string; slug: string };
		descriptions.push(parsed);
	}
	return descriptions;
}

let _seriesDescriptions: Array<{ title: string; slug: string }> | null = null;
function getSeriesDescriptions() {
	if (!_seriesDescriptions) {
		_seriesDescriptions = buildSeriesDescriptions();
	}
	return _seriesDescriptions;
}

export function getSeriesInfo(slug: string): SeriesInfo | null {
	const parts = slug.split('/');
	if (parts.length <= 1) return null;

	const seriesSlug = parts.slice(0, -1).join('/');
	const seriesDesc = getSeriesDescriptions().find((s) => s.slug === seriesSlug);
	if (!seriesDesc) return null;

	const seriesPosts = getAllPosts()
		.filter((p) => p.metadata.slug.startsWith(`${seriesSlug}/`))
		.sort((a, b) => new Date(a.metadata.date).getTime() - new Date(b.metadata.date).getTime());

	return { title: seriesDesc.title, slug: seriesSlug, posts: seriesPosts };
}

// ==============================================================================
// Authors
// ==============================================================================

export interface AuthorMetadata {
	slug: string;
	name: string;
	avatar: string;
	github: string;
	twitter: string;
	email: string;
	mastodon: string;
	bsky: string;
}

const authorModules = import.meta.glob('/src/content/authors/*.md', { eager: true }) as Record<
	string,
	{ default: Component; metadata: AuthorMetadata }
>;

export function getAuthor(slug: string): { metadata: AuthorMetadata; component: Component } | undefined {
	for (const module of Object.values(authorModules)) {
		if (module.metadata.slug === slug) {
			return { metadata: module.metadata, component: module.default };
		}
	}
	return undefined;
}

export function getAuthorDetails(authorSlugs?: string[]): AuthorMetadata[] {
	const slugs = authorSlugs || ['default'];
	return slugs
		.map((s) => getAuthor(s))
		.filter((a): a is NonNullable<typeof a> => a !== undefined)
		.map((a) => a.metadata);
}
