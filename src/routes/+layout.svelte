<script>
	import '../app.css';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import siteMetadata from '$lib/config/siteMetadata';

	let { children } = $props();
</script>

<svelte:head>
	<meta name="description" content={siteMetadata.description} />
</svelte:head>

<div class="mx-auto max-w-3xl px-4 sm:px-6 xl:max-w-5xl xl:px-0">
	<div class="flex h-screen flex-col justify-between font-sans">
		<Header />
		<main class="mb-auto">
			{@render children()}
		</main>
		<Footer />
	</div>
</div>
