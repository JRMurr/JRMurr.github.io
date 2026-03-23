<script lang="ts">
	import { onMount } from 'svelte';
	import Note from './Note.svelte';

	// 11x8 ratio
	const cellSize = 90;
	const width = cellSize * 11;
	const height = cellSize * 8;

	let isDesktop = $state(false);

	function updateMedia() {
		isDesktop = window.innerWidth > 1280;
	}

	onMount(() => {
		updateMedia();
		window.addEventListener('resize', updateMedia);

		return () => window.removeEventListener('resize', updateMedia);
	});
</script>

<div>
	{#if isDesktop}
		<iframe
			src="/zigfish/index.html"
			title="Zigfish Chess Engine"
			{width}
			{height}
			style="border: none;"
		></iframe>
	{:else}
		<Note>
			Looks like you are on a small screen. If you load this on a desktop you can play against my
			engine in the browser!
		</Note>
	{/if}
</div>
