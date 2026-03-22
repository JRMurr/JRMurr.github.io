<script lang="ts">
	import type { Snippet } from 'svelte';
	import { formatDate } from '$lib/utils/formatDate';
	import siteMetadata from '$lib/config/siteMetadata';
	import ScrollTopAndComment from '$lib/components/ScrollTopAndComment.svelte';
	import Series from '$lib/components/Series.svelte';
	import Discuss from '$lib/components/Discuss.svelte';
	import type { Post, SeriesInfo } from '$lib/utils/posts';

	let {
		post,
		series = null,
		prev,
		next,
		children,
	}: {
		post: Post;
		series?: SeriesInfo | null;
		prev?: Post;
		next?: Post;
		children: Snippet;
	} = $props();

	const slug = $derived(post.metadata.slug);
	const date = $derived(post.metadata.date);
	const title = $derived(post.metadata.title);
</script>

<ScrollTopAndComment />
<article>
	<div>
		<header>
			<div class="space-y-1 border-b border-gray-200 pb-10 text-center dark:border-gray-700">
				<dl>
					<div>
						<dt class="sr-only">Published on</dt>
						<dd class="text-base font-medium leading-6 text-gray-500 dark:text-gray-400">
							<time datetime={date}>{formatDate(date, siteMetadata.locale)}</time>
							<span class="mx-2">-</span>
							<span class="ml-1">{post.readingTime.text}</span>
						</dd>
					</div>
				</dl>
				<div>
					<h1
						class="text-3xl font-extrabold leading-9 tracking-tight text-gray-900 dark:text-gray-100 sm:text-4xl sm:leading-10 md:text-5xl md:leading-14"
					>
						{title}
					</h1>
				</div>
			</div>
		</header>
		<div
			class="grid-rows-[auto_1fr] divide-y divide-gray-200 pb-8 dark:divide-gray-700 xl:divide-y-0"
		>
			<div
				class="divide-y divide-gray-200 dark:divide-gray-700 xl:col-span-3 xl:row-span-2 xl:pb-0"
			>
				<div class="prose max-w-none pb-8 pt-10 dark:prose-invert">
					<Series {series} currSlug={slug} />
					{@render children()}
				</div>
				<Discuss path={post.metadata.slug} />
			</div>

			<footer>
				<div class="flex flex-col text-sm font-medium sm:flex-row sm:justify-between sm:text-base">
					{#if prev}
						<div class="pt-4 xl:pt-8">
							<a
								href="/blog/{prev.metadata.slug}"
								class="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400"
								aria-label="Previous post: {prev.metadata.title}"
							>
								&larr; {prev.metadata.title}
							</a>
						</div>
					{/if}
					{#if next}
						<div class="pt-4 xl:pt-8">
							<a
								href="/blog/{next.metadata.slug}"
								class="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400"
								aria-label="Next post: {next.metadata.title}"
							>
								{next.metadata.title} &rarr;
							</a>
						</div>
					{/if}
				</div>
			</footer>
		</div>
	</div>
</article>
