<script lang="ts">
	import siteMetadata from '$lib/config/siteMetadata';
	import Comments from './Comments.svelte';

	let { path }: { path: string } = $props();

	const editUrl = `${siteMetadata.siteRepo}/blob/main/content/${path}.md`;
	const discussUrl = `https://mobile.twitter.com/search?q=${encodeURIComponent(`${siteMetadata.siteUrl}/${path}`)}`;
</script>

<div>
	<div class="pb-6 pt-6 text-sm text-gray-700 dark:text-gray-300">
		<a href={discussUrl} target="_blank" rel="noopener noreferrer nofollow">Discuss on Twitter</a>
		{` • `}
		<a href={editUrl} target="_blank" rel="noopener noreferrer">View on GitHub</a>
	</div>
	{#if siteMetadata.comments}
		<div class="pb-6 pt-6 text-center text-gray-700 dark:text-gray-300" id="comment">
			<Comments />
		</div>
	{/if}
</div>
