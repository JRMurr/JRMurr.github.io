<script lang="ts">
	let { title, width, height, src }: { title: string; width: number; height: number; src: string } =
		$props();
</script>

<iframe {title} {width} {height} {src} allow="cross-origin" class="scale-75"></iframe>
