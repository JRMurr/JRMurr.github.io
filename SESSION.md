## Migration Issues

- `build-a-db/part02.md` fails to build: `{O}` in `$\mathcal{O}(\log{_2}N)$` causes `ReferenceError: O is not defined`. remark-math v3 works with mdsvex but doesn't process this specific file's math for unclear reasons (possibly related to the injected `<script>` tag or file complexity). Fix options: rewrite the LaTeX to avoid `{` in inline math, or wrap in display math `$$...$$`.

- Shiki syntax highlighting not yet integrated. Code blocks render as plain `<pre><code>` without highlighting. Need to set up mdsvex's `highlight` option with a custom Shiki highlighter function since the rehype plugin approach is incompatible with mdsvex's internal unified version.

- Twoslash TypeScript annotations not yet integrated (depends on Shiki).

- Pagefind search not yet set up — build step and search modal component needed.

- Old Next.js files (app/, components/, layouts/, etc.) not yet deleted — keeping for reference during migration, should be removed before merging.
