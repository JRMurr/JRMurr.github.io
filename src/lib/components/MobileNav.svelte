<script lang="ts">
	import headerNavLinks from '$lib/config/headerNavLinks';

	let navShow = $state(false);

	function onToggleNav() {
		navShow = !navShow;
		document.body.style.overflow = navShow ? 'hidden' : 'auto';
	}
</script>

<button aria-label="Toggle Menu" onclick={onToggleNav} class="sm:hidden">
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 20 20"
		fill="currentColor"
		class="h-8 w-8 text-gray-900 dark:text-gray-100"
	>
		<path
			fill-rule="evenodd"
			d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
			clip-rule="evenodd"
		/>
	</svg>
</button>
<div
	class="fixed left-0 top-0 z-10 h-full w-full transform bg-white opacity-95 duration-300 ease-in-out dark:bg-gray-950 dark:opacity-[0.98] {navShow
		? 'translate-x-0'
		: 'translate-x-full'}"
>
	<div class="flex justify-end">
		<button class="mr-8 mt-11 h-8 w-8" aria-label="Toggle Menu" onclick={onToggleNav}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
				class="text-gray-900 dark:text-gray-100"
			>
				<path
					fill-rule="evenodd"
					d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
					clip-rule="evenodd"
				/>
			</svg>
		</button>
	</div>
	<nav class="fixed mt-8 h-full">
		{#each headerNavLinks as link}
			<div class="px-12 py-4">
				<a
					href={link.href}
					class="text-2xl font-bold tracking-widest text-gray-900 dark:text-gray-100"
					onclick={onToggleNav}
				>
					{link.title}
				</a>
			</div>
		{/each}
	</nav>
</div>
