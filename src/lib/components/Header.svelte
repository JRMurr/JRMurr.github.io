<script lang="ts">
	import siteMetadata from '$lib/config/siteMetadata';
	import headerNavLinks from '$lib/config/headerNavLinks';
	import ThemeSwitch from './ThemeSwitch.svelte';
	import MobileNav from './MobileNav.svelte';
	import SearchModal from './SearchModal.svelte';
</script>

<header class="flex items-center justify-between py-10">
	<div>
		<a href="/" aria-label={siteMetadata.headerTitle}>
			<div class="flex items-center justify-between">
				<div class="hidden h-6 text-2xl font-semibold sm:block">
					{siteMetadata.headerTitle}
				</div>
			</div>
		</a>
	</div>
	<div class="flex items-center space-x-4 leading-5 sm:space-x-6">
		{#each headerNavLinks.filter((link) => link.href !== '/') as link}
			<a
				href={link.href}
				class="hidden font-medium text-gray-900 dark:text-gray-100 sm:block"
			>
				{link.title}
			</a>
		{/each}
		<SearchModal />
		<ThemeSwitch />
		<MobileNav />
	</div>
</header>
