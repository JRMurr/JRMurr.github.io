<script lang="ts">
	import PostSimple from '$lib/layouts/PostSimple.svelte';
	import PostLayout from '$lib/layouts/PostLayout.svelte';
	import siteMetadata from '$lib/config/siteMetadata';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.post.metadata.title} | {siteMetadata.title}</title>
	<meta name="description" content={data.post.metadata.summary} />
	<meta property="og:title" content={data.post.metadata.title} />
	<meta property="og:description" content={data.post.metadata.summary} />
	<meta property="og:type" content="article" />
	<meta
		property="article:published_time"
		content={new Date(data.post.metadata.date).toISOString()}
	/>
</svelte:head>

{#if data.post.metadata.layout === 'PostLayout'}
	<PostLayout
		post={data.post}
		authorDetails={data.authorDetails}
		series={data.seriesInfo}
		prev={data.prev}
		next={data.next}
	>
		<data.post.component />
	</PostLayout>
{:else}
	<PostSimple
		post={data.post}
		series={data.seriesInfo}
		prev={data.prev}
		next={data.next}
	>
		<data.post.component />
	</PostSimple>
{/if}
