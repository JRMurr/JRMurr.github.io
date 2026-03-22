<script lang="ts">
	import siteMetadata from '$lib/config/siteMetadata';
	import SocialIcon from '$lib/components/SocialIcon.svelte';
	import { getAuthor } from '$lib/utils/posts';

	const author = getAuthor('default');
</script>

<svelte:head>
	<title>About | {siteMetadata.title}</title>
</svelte:head>

<div class="divide-y divide-gray-200 dark:divide-gray-700">
	<div class="space-y-2 pb-8 pt-6 md:space-y-5">
		<h1
			class="text-3xl font-extrabold leading-9 tracking-tight text-gray-900 dark:text-gray-100 sm:text-4xl sm:leading-10 md:text-6xl md:leading-14"
		>
			About
		</h1>
	</div>
	<div class="items-start space-y-2 xl:grid xl:grid-cols-3 xl:gap-x-8 xl:space-y-0">
		<div class="flex flex-col items-center space-x-2 pt-8">
			{#if author?.metadata.avatar}
				<img
					src={author.metadata.avatar}
					alt="avatar"
					width={192}
					height={192}
					class="h-48 w-48 rounded-full"
				/>
			{/if}
			{#if author}
				<h3 class="pb-2 pt-4 text-2xl font-bold leading-8 tracking-tight">
					{author.metadata.name}
				</h3>
				<div class="flex space-x-3 pt-6">
					<SocialIcon kind="mail" href="mailto:{author.metadata.email}" />
					<SocialIcon kind="github" href={author.metadata.github} />
					<SocialIcon kind="twitter" href={author.metadata.twitter} />
					<SocialIcon kind="bsky" href={author.metadata.bsky} />
					<SocialIcon kind="mastodon" href={author.metadata.mastodon} />
				</div>
			{/if}
		</div>
		<div class="prose max-w-none pb-8 pt-8 dark:prose-invert xl:col-span-2">
			{#if author}
				<svelte:component this={author.component} />
			{/if}
		</div>
	</div>
</div>
