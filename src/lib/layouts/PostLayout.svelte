<script lang="ts">
	import type { Snippet } from 'svelte';
	import siteMetadata from '$lib/config/siteMetadata';
	import ScrollTopAndComment from '$lib/components/ScrollTopAndComment.svelte';
	import Tag from '$lib/components/Tag.svelte';
	import Series from '$lib/components/Series.svelte';
	import Discuss from '$lib/components/Discuss.svelte';
	import type { Post, SeriesInfo, AuthorMetadata } from '$lib/utils/posts';

	const postDateTemplate: Intl.DateTimeFormatOptions = {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	};

	let {
		post,
		authorDetails = [],
		series = null,
		prev,
		next,
		children,
	}: {
		post: Post;
		authorDetails?: AuthorMetadata[];
		series?: SeriesInfo | null;
		prev?: Post;
		next?: Post;
		children: Snippet;
	} = $props();

	const { slug, date, title, tags } = post.metadata;
</script>

<ScrollTopAndComment />
<article>
	<div class="xl:divide-y xl:divide-gray-200 xl:dark:divide-gray-700">
		<header class="pt-6 xl:pb-6">
			<div class="space-y-1 text-center">
				<dl class="space-y-10">
					<div>
						<dt class="sr-only">Published on</dt>
						<dd class="text-base font-medium leading-6 text-gray-500 dark:text-gray-400">
							<time datetime={date}>
								{new Date(date).toLocaleDateString(siteMetadata.locale, postDateTemplate)}
							</time>
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
			class="grid-rows-[auto_1fr] divide-y divide-gray-200 pb-8 dark:divide-gray-700 xl:grid xl:grid-cols-4 xl:gap-x-6 xl:divide-y-0"
		>
			<dl class="pb-10 pt-6 xl:border-b xl:border-gray-200 xl:pt-11 xl:dark:border-gray-700">
				<dt class="sr-only">Authors</dt>
				<dd>
					<ul
						class="flex flex-wrap justify-center gap-4 sm:space-x-12 xl:block xl:space-x-0 xl:space-y-8"
					>
						{#each authorDetails as author}
							<li class="flex items-center space-x-2">
								{#if author.avatar}
									<img
										src={author.avatar}
										width={38}
										height={38}
										alt="avatar"
										class="h-10 w-10 rounded-full"
									/>
								{/if}
								<dl class="whitespace-nowrap text-sm font-medium leading-5">
									<dt class="sr-only">Name</dt>
									<dd class="text-gray-900 dark:text-gray-100">{author.name}</dd>
									{#if author.twitter}
										<dt class="sr-only">Twitter</dt>
										<dd>
											<a
												href={author.twitter}
												class="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400"
												target="_blank"
												rel="noopener noreferrer"
											>
												{author.twitter.replace('https://twitter.com/', '@')}
											</a>
										</dd>
									{/if}
								</dl>
							</li>
						{/each}
					</ul>
				</dd>
			</dl>
			<div
				class="divide-y divide-gray-200 dark:divide-gray-700 xl:col-span-3 xl:row-span-2 xl:pb-0"
			>
				<div class="prose max-w-none pb-8 pt-10 dark:prose-invert">
					<Series {series} currSlug={slug} />
					{@render children()}
				</div>
				<Discuss path={slug} />
			</div>
			<footer>
				<div
					class="divide-gray-200 text-sm font-medium leading-5 dark:divide-gray-700 xl:col-start-1 xl:row-start-2 xl:divide-y"
				>
					{#if tags && tags.length > 0}
						<div class="py-4 xl:py-8">
							<h2 class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Tags</h2>
							<div class="flex flex-wrap">
								{#each tags as tag}
									<Tag text={tag} />
								{/each}
							</div>
						</div>
					{/if}
					{#if next || prev}
						<div class="flex justify-between py-4 xl:block xl:space-y-8 xl:py-8">
							{#if prev}
								<div>
									<h2 class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
										Previous Article
									</h2>
									<div
										class="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400"
									>
										<a href="/blog/{prev.metadata.slug}">{prev.metadata.title}</a>
									</div>
								</div>
							{/if}
							{#if next}
								<div>
									<h2 class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
										Next Article
									</h2>
									<div
										class="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400"
									>
										<a href="/blog/{next.metadata.slug}">{next.metadata.title}</a>
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>
				<div class="pt-4 xl:pt-8">
					<a
						href="/blog"
						class="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400"
						aria-label="Back to the blog"
					>
						&larr; Back to the blog
					</a>
				</div>
			</footer>
		</div>
	</div>
</article>
