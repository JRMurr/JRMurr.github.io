<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Note from './Note.svelte';

	// 11x8 ratio
	const cellSize = 90;
	const width = cellSize * 11;
	const height = cellSize * 8;

	let canvasEl = $state<HTMLCanvasElement>();
	let moduleRef: any = null;
	let isDesktop = $state(false);

	function updateMedia() {
		isDesktop = window.innerWidth > 1280;
	}

	async function loadWasm() {
		const savedTitle = document.title; // WASM overwrites this

		// Emscripten's generated JS references `global` (Node.js), polyfill for browser
		if (typeof globalThis.global === 'undefined') {
			(globalThis as any).global = globalThis;
		}

		const wasmModule: any = {
			print: (text: string) => console.log('[WASM] ' + text),
			printErr: (text: string) => console.log('[WASM-ERROR] ' + text),
			get canvas() {
				return canvasEl || undefined;
			},
			set canvas(_: any) {},
			onRuntimeInitialized: () => console.log('WASM runtime initialized'),
			forcedAspectRatio: 11 / 8,
			locateFile: (path: string) => `/zigfish/${path}`,
		};

		// Load the Emscripten ES module from static assets
		const zigfishUrl = new URL('/zigfish/zigfish.js', window.location.origin).href;
		const zigfishModule = await import(/* @vite-ignore */ zigfishUrl);
		const updatedModule = await zigfishModule.default(wasmModule);
		moduleRef = updatedModule;

		updatedModule.setCanvasSize(width, height, false);
		document.title = savedTitle;
	}

	onMount(() => {
		updateMedia();
		window.addEventListener('resize', updateMedia);

		return () => window.removeEventListener('resize', updateMedia);
	});

	// Load WASM when desktop and canvas available
	$effect(() => {
		if (isDesktop && canvasEl && !moduleRef) {
			loadWasm();
		}
	});

	onDestroy(() => {
		if (moduleRef) {
			try {
				moduleRef.force_exit(0);
				delete moduleRef['wasmMemory'];
			} catch (_) {
				/* empty */
			}
			console.debug('unloading chess wasm');
		}
	});
</script>

<div>
	{#if isDesktop}
		<canvas
			bind:this={canvasEl}
			id="canvas"
			oncontextmenu={(e) => e.preventDefault()}
			tabindex="-1"
		></canvas>
	{:else}
		<Note>
			Looks like you are on a small screen. If you load this on a desktop you can play against my
			engine in the browser!
		</Note>
	{/if}
</div>
