## Migration Issues

- `build-a-db/part02.md` fails to build due to `{O}` in `$\mathcal{O}(\log{_2}N)$` inline math. remark-math v3 works with mdsvex in simple cases but `compile()` returns `undefined` for this specific file (likely due to file complexity or injected script tag interaction). The LaTeX braces need to be rewritten to avoid `{` in inline math, e.g. use `\lbrace O \rbrace` or use display math `$$...$$` instead. All other posts with math (using `<` `>` only) work fine.

- Shiki syntax highlighting not yet integrated — the `failed to load language javascript` warnings. Need to set up mdsvex's `highlight` option with a custom Shiki highlighter since `@shikijs/rehype` is incompatible with mdsvex's internal unified version.

- `svelte_component_deprecated` and `state_referenced_locally` Svelte 5 warnings in several files — cosmetic, not blocking.

- Pagefind search not yet set up (Phase 7).
- Giscus comments placeholder only (Phase 7).
- Chess WASM component is a placeholder (Phase 5).
- RSS feeds, sitemap, robots.txt not yet implemented (Phase 7).
- Old Next.js files not yet cleaned up (Phase 8).
