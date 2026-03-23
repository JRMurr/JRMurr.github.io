# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal blog (johns.codes) built with SvelteKit 2 + Svelte 5, using mdsvex for markdown content processing. Statically prerendered via `@sveltejs/adapter-static` and deployed to Cloudflare Pages.

## Commands

| Task | Command |
|------|---------|
| Dev server | `just dev` (port 3000) |
| Production build | `just build` (builds + runs pagefind for search indexing) |
| Type check | `just check` |
| Preview build | `just preview` |
| New blog post | `just new` (interactive scaffolding via `scripts/initBlog.ts`) |

The dev environment uses Nix flakes (`flake.nix`) with Node.js 24 and `just`. Enter with `nix develop` or direnv.

## Architecture

### Content Pipeline

Markdown posts live in `src/content/blog/`. They are processed through a multi-stage pipeline configured in `svelte.config.js`:

1. **`escapeMathPreprocessor`** — escapes LaTeX math before mdsvex parses it (prevents `<` in math from being treated as HTML)
2. **`injectComponentsPreprocessor`** — injects component imports (TOCInline, Note, IFrame, Chess) into every `.md` file since mdsvex + Svelte 5 doesn't share layout script context
3. **mdsvex** — compiles markdown to Svelte components with remark/rehype plugins for math, code titles, Shiki syntax highlighting (with twoslash support), slug headings, and KaTeX

Posts are loaded at build time via `import.meta.glob` in `src/lib/utils/posts.ts`, which serves as the central data layer — all post queries (by slug, by tag, series info, pagination, prev/next) go through this module.

### Post Frontmatter

```yaml
title: Post Title
seriesTitle: Part N - Subtitle  # only for series posts
slug: post-slug                  # or series-slug/part-slug for series
date: ISO-8601
tags: ['tag1', 'tag2']
draft: true/false
summary: Short description
layout: PostSimple               # or PostLayout (default: PostSimple)
authors: ['default']             # optional, references src/content/authors/*.md
```

### Series

Multi-part series use subdirectories in `src/content/blog/` with an `info.yml` file containing `title` and `slug`. Individual parts use slugs like `series-slug/partNN`.

### Routing

- `/` — homepage with latest 5 posts
- `/blog` — paginated post listing
- `/blog/[...slug]` — individual post (uses catch-all for series slugs with slashes)
- `/tags`, `/tags/[tag]` — tag listing and filtered views
- `/about`, `/projects` — static pages

The blog post page (`src/routes/blog/[...slug]/+page.svelte`) switches between `PostLayout` and `PostSimple` layout components based on the post's `layout` frontmatter field.

### Key Conventions

- The site is fully prerendered (`export const prerender = true` in root layout)
- Tailwind CSS with `@tailwindcss/typography` for prose styling, dark mode via `class` strategy
- COEP/COOP headers are set for SharedArrayBuffer support (chess WASM engine) — in dev via Vite plugin + server hooks, in production via Cloudflare `static/_headers`
- Pagefind is used for client-side search, built as a post-build step
- Comments via Giscus (GitHub Discussions)
- CI runs `just check` (svelte-check) then `just build` on PRs
