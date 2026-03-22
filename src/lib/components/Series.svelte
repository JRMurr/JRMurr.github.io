<script lang="ts">
	import { goto } from '$app/navigation';
	import type { SeriesInfo } from '$lib/utils/posts';

	let { series, currSlug }: { series: SeriesInfo | null; currSlug: string } = $props();

	function onChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		goto(target.value);
	}
</script>

{#if series && series.posts.length > 1}
	<div class="pb-2">
		<p>This article is part of the {series.title} series.</p>
		<select
			value="/blog/{currSlug}"
			onchange={onChange}
			class="block w-3/12 rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-900 dark:bg-gray-800 dark:text-gray-100"
		>
			{#each series.posts as p}
				<option value="/blog/{p.metadata.slug}">
					{p.metadata.seriesTitle ?? p.metadata.title}
				</option>
			{/each}
		</select>
	</div>
{/if}
