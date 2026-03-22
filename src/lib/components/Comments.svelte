<script lang="ts">
	let loadComments = $state(false);
</script>

{#if !loadComments}
	<button onclick={() => (loadComments = true)}>Load Comments</button>
{/if}
{#if loadComments}
	<p>Comments placeholder - Giscus will be added in Phase 7</p>
{/if}
