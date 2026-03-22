<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		asDisclosure?: boolean;
		collapse?: boolean;
		fromHeading?: number;
		toHeading?: number;
		exclude?: string | string[];
		// Accept toc prop for backwards compatibility with old markdown syntax, but ignore it
		toc?: unknown;
	}

	let {
		asDisclosure = false,
		collapse = false,
		fromHeading = 1,
		toHeading = 4,
		exclude = '',
	}: Props = $props();

	interface TocEntry {
		url: string;
		title: string;
		depth: number;
	}

	let headings = $state<TocEntry[]>([]);

	onMount(() => {
		const re = Array.isArray(exclude)
			? new RegExp('^(' + exclude.join('|') + ')$', 'i')
			: exclude
				? new RegExp('^(' + exclude + ')$', 'i')
				: null;

		const selectors = [];
		for (let i = fromHeading; i <= toHeading; i++) {
			selectors.push(`h${i}[id]`);
		}

		const elements = document.querySelectorAll(selectors.join(', '));
		const result: TocEntry[] = [];

		elements.forEach((el) => {
			const title = el.textContent?.trim() || '';
			if (re && re.test(title)) return;
			const depth = parseInt(el.tagName[1]);
			result.push({
				url: `#${el.id}`,
				title,
				depth,
			});
		});

		headings = result;
	});
</script>

{#if headings.length > 0}
	{#if asDisclosure}
		<details open={!collapse}>
			<summary class="ml-6 pb-2 pt-2 text-xl font-bold">Table of Contents</summary>
			<div class="ml-6">
				<ul>
					{#each headings as heading}
						<li style="margin-left: {(heading.depth - fromHeading) * 1}rem">
							<a href={heading.url}>{heading.title}</a>
						</li>
					{/each}
				</ul>
			</div>
		</details>
	{:else}
		<ul>
			{#each headings as heading}
				<li style="margin-left: {(heading.depth - fromHeading) * 1}rem">
					<a href={heading.url}>{heading.title}</a>
				</li>
			{/each}
		</ul>
	{/if}
{/if}
