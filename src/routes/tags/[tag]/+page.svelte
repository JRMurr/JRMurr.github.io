<script lang="ts">
	import Tag from '$lib/components/Tag.svelte';
	import { formatDate } from '$lib/utils/formatDate';
	import siteMetadata from '$lib/config/siteMetadata';

	let { data } = $props();

	const sortedTags = $derived(Object.entries(data.tagCounts).sort(([, a], [, b]) => b - a));
</script>

<svelte:head>
	<title>{data.tag} | {siteMetadata.title}</title>
</svelte:head>

<div>
	<div class="pb-6 pt-6">
		<h1
			class="text-3xl font-extrabold leading-9 tracking-tight text-gray-900 dark:text-gray-100 sm:hidden sm:text-4xl sm:leading-10 md:text-6xl md:leading-14"
		>
			{data.tag}
		</h1>
	</div>
	<div class="flex sm:space-x-24">
		<div
			class="hidden h-full max-h-screen min-w-[280px] max-w-[280px] flex-wrap overflow-auto rounded bg-gray-50 pt-5 shadow-md dark:bg-gray-900/70 dark:shadow-gray-800/40 sm:flex"
		>
			<div class="px-6 py-4">
				<a
					href="/blog"
					class="font-bold uppercase text-gray-700 hover:text-primary-500 dark:text-gray-300 dark:hover:text-primary-500"
				>
					All Posts
				</a>
				<ul>
					{#each sortedTags as [tag, count]}
						<li class="my-3">
							<a
								href="/tags/{tag}"
								class="px-3 py-2 text-sm font-medium uppercase {tag === data.tag
									? 'text-primary-500'
									: 'text-gray-500 hover:text-primary-500 dark:text-gray-300 dark:hover:text-primary-500'}"
								aria-label="View posts tagged {tag}"
							>
								{tag} ({count})
							</a>
						</li>
					{/each}
				</ul>
			</div>
		</div>
		<div>
			<ul>
				{#each data.posts as post}
					<li class="py-5">
						<article class="flex flex-col space-y-2 xl:space-y-0">
							<dl>
								<dt class="sr-only">Published on</dt>
								<dd class="text-base font-medium leading-6 text-gray-500 dark:text-gray-400">
									<time datetime={post.metadata.date}
										>{formatDate(post.metadata.date, siteMetadata.locale)}</time
									>
								</dd>
							</dl>
							<div class="space-y-3">
								<div>
									<h2 class="text-2xl font-bold leading-8 tracking-tight">
										<a
											href="/blog/{post.metadata.slug}"
											class="text-gray-900 dark:text-gray-100"
										>
											{post.metadata.title}
										</a>
									</h2>
									<div class="flex flex-wrap">
										{#each post.metadata.tags as tag}
											<Tag text={tag} />
										{/each}
									</div>
								</div>
								<div class="prose max-w-none text-gray-500 dark:text-gray-400">
									{post.metadata.summary}
								</div>
							</div>
						</article>
					</li>
				{/each}
			</ul>
		</div>
	</div>
</div>
