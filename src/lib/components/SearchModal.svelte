<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let open = $state(false);
	let query = $state('');
	let results = $state<Array<{ id: string; url: string; title: string; excerpt: string }>>([]);
	let pagefind: any = null;
	let inputEl: HTMLInputElement | undefined = $state();

	async function loadPagefind() {
		if (pagefind) return;
		try {
			const pagefindPath = '/pagefind/pagefind.js';
			// Check that the pagefind script exists before importing — in dev mode it
			// won't, and browsers (especially Firefox) throw uncatchable module-loader
			// errors for non-JS responses.
			const probe = await fetch(pagefindPath, { method: 'HEAD' });
			if (!probe.ok) return;
			pagefind = await import(/* @vite-ignore */ pagefindPath);
			await pagefind.init();
		} catch {
			// Pagefind not available in dev mode (only after build)
			console.warn('Pagefind not available — run a production build first');
		}
	}

	async function search(q: string) {
		if (!pagefind || !q.trim()) {
			results = [];
			return;
		}
		const searchResult = await pagefind.search(q);
		const items = await Promise.all(
			searchResult.results.slice(0, 8).map(async (r: any) => {
				const data = await r.data();
				return {
					id: r.id,
					url: data.url,
					title: data.meta?.title || data.url,
					excerpt: data.excerpt,
				};
			})
		);
		results = items;
	}

	function toggle() {
		open = !open;
		if (open) {
			loadPagefind();
			// Focus input after DOM updates
			setTimeout(() => inputEl?.focus(), 50);
		} else {
			query = '';
			results = [];
		}
	}

	function navigate(url: string) {
		open = false;
		query = '';
		results = [];
		goto(url);
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			toggle();
		}
		if (e.key === 'Escape' && open) {
			toggle();
		}
	}

	onMount(() => {
		document.addEventListener('keydown', handleKeydown);
		return () => document.removeEventListener('keydown', handleKeydown);
	});

	$effect(() => {
		search(query);
	});
</script>

<!-- Search trigger button -->
<button
	aria-label="Search"
	onclick={toggle}
	class="text-gray-900 dark:text-gray-100"
>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		fill="none"
		viewBox="0 0 24 24"
		stroke-width="1.5"
		stroke="currentColor"
		class="h-6 w-6"
	>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
		/>
	</svg>
</button>

<!-- Modal overlay -->
{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[20vh]"
		onkeydown={(e) => e.key === 'Escape' && toggle()}
		onclick={(e) => { if (e.target === e.currentTarget) toggle(); }}
	>
		<div class="w-full max-w-lg rounded-lg bg-white shadow-2xl dark:bg-gray-900">
			<div class="flex items-center border-b border-gray-200 px-4 dark:border-gray-700">
				<svg
					class="mr-3 h-5 w-5 text-gray-400"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
					/>
				</svg>
				<input
					bind:this={inputEl}
					bind:value={query}
					type="text"
					placeholder="Search posts..."
					class="w-full border-0 bg-transparent py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0 dark:text-gray-100"
				/>
				<kbd class="ml-2 rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-400 dark:border-gray-600">
					ESC
				</kbd>
			</div>
			{#if results.length > 0}
				<ul class="max-h-80 overflow-y-auto py-2">
					{#each results as result}
						<li>
							<button
								class="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
								onclick={() => navigate(result.url)}
							>
								<div class="text-sm font-medium text-gray-900 dark:text-gray-100">
									{result.title}
								</div>
								<div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
									{@html result.excerpt}
								</div>
							</button>
						</li>
					{/each}
				</ul>
			{:else if query.trim()}
				<div class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
					No results for "{query}"
				</div>
			{:else}
				<div class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
					Type to search...
				</div>
			{/if}
		</div>
	</div>
{/if}
