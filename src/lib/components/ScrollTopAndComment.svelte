<script lang="ts">
	import { onMount } from 'svelte';
	import siteMetadata from '$lib/config/siteMetadata';

	let show = $state(false);

	onMount(() => {
		const handleScroll = () => {
			show = window.scrollY > 50;
		};
		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	});

	function scrollToTop() {
		window.scrollTo({ top: 0 });
	}

	function scrollToComment() {
		document.getElementById('comment')?.scrollIntoView();
	}
</script>

<div class="fixed bottom-8 right-8 hidden flex-col gap-3 {show ? 'md:flex' : 'md:hidden'}">
	{#if siteMetadata.comments?.provider}
		<button
			aria-label="Scroll To Comment"
			onclick={scrollToComment}
			class="rounded-full bg-gray-200 p-2 text-gray-500 transition-all hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
		>
			<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
				<path
					fill-rule="evenodd"
					d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
					clip-rule="evenodd"
				/>
			</svg>
		</button>
	{/if}
	<button
		aria-label="Scroll To Top"
		onclick={scrollToTop}
		class="rounded-full bg-gray-200 p-2 text-gray-500 transition-all hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
	>
		<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
			<path
				fill-rule="evenodd"
				d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z"
				clip-rule="evenodd"
			/>
		</svg>
	</button>
</div>
