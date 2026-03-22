<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, class: className = '' }: { children: Snippet; class?: string } = $props();
</script>

<div class="grid place-content-center">
	<div class="rounded bg-gray-100 dark:bg-gray-800 {className}">
		<div class="box-content px-3 py-0">
			{@render children()}
		</div>
	</div>
</div>
