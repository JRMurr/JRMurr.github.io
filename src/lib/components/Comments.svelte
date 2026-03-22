<script lang="ts">
	import { onMount } from 'svelte';
	import siteMetadata from '$lib/config/siteMetadata';

	let loadComments = $state(false);
	let mounted = $state(false);

	const { giscusConfig } = siteMetadata.comments;

	onMount(() => {
		mounted = true;
	});

	function load() {
		loadComments = true;
		// Dynamically import giscus web component
		import('giscus');
	}
</script>

{#if !loadComments}
	<button onclick={load}>Load Comments</button>
{/if}
{#if loadComments && mounted}
	<giscus-widget
		repo={giscusConfig.repo}
		repoid={giscusConfig.repositoryId}
		category={giscusConfig.category}
		categoryid={giscusConfig.categoryId}
		mapping={giscusConfig.mapping}
		reactionsenabled={giscusConfig.reactions}
		emitmetadata={giscusConfig.metadata}
		theme={giscusConfig.theme}
		lang={giscusConfig.lang}
		loading="lazy"
	></giscus-widget>
{/if}
