# Session Notes

## Previously reported issues (now fixed)

These were found in a prior session and have since been resolved:
- ~~Missing "All Posts" link on homepage~~ - now present
- ~~Table of Contents skips h1 headings~~ - TOC now includes h1s
- ~~Projects page missing subtitle~~ - subtitle now present
- ~~404 page is unstyled~~ - now has styled layout with "Back to homepage" button

## Open issues

### 1. Pagination route is missing
`/src/routes/blog/page/[page]/` directory exists but is **empty** - no `+page.svelte` or `+page.ts`. The blog listing (line 92 of `blog/+page.svelte`) links to `/blog/page/2` which will 404. Needs `+page.ts` with `load()` + `entries()` and a `+page.svelte`.

### 2. Date formatting lacks UTC timezone
`src/lib/utils/formatDate.ts` uses `new Date(date).toLocaleDateString()` without `timeZone: 'UTC'`. Posts with early-morning UTC timestamps (e.g., `2024-12-09T04:27:04.470Z`) display as the previous day in US timezones. Production (built in UTC CI) shows "December 9" while local dev shows "December 8". Fix: add `timeZone: 'UTC'` to the `Intl.DateTimeFormatOptions`.

### 3. Chess component is a stub
`src/lib/components/Chess.svelte` just renders a Note with a link to `/zigfish/index.html` instead of embedding the WASM chess game inline like the old React version. The old version had an interactive embedded chessboard. This was an intentional tradeoff to avoid COEP/Giscus conflicts, so may be acceptable.

### 4. Reading time calculation differs slightly
SvelteKit version shows slightly different reading times than production (e.g., 9 vs 12 min, 28 vs 29 min). The `posts.ts` calculation strips code blocks and HTML differently than the old Velite pipeline. Minor.

## Verified working correctly
- All routes migrated: /, /blog, /blog/[...slug], /tags, /tags/[tag], /about, /projects, /feed.xml, /robots.txt, /sitemap.xml
- Navigation (Blog, Tags, Projects, About) all functional
- Blog listing page with tag sidebar - identical to prod
- Tags page - identical
- About page - identical (avatar, social icons, bio)
- Projects page - identical (cards, images, links)
- Code syntax highlighting (Shiki) - matches prod
- Twoslash TypeScript error annotations - working
- Dark mode toggle - works, code blocks switch themes correctly
- Search modal (Pagefind) - opens with button click, has ESC to close
- Mobile responsive layout - works at 375px
- Mobile hamburger nav - works, identical overlay to prod
- Series navigation dropdown - works (build-a-db series)
- Table of Contents - works with collapsible disclosure
- Blog post prev/next navigation - works
- "Discuss on Twitter / View on GitHub" links - present
- "Load Comments" button (Giscus) - present
- Footer with social icons (mail, github, twitter, bsky, mastodon, rss) - matches
- Plausible analytics script in layout
- COEP/COOP headers for zigfish (static/_headers + Vite plugin)
- Prerendering configured (global + per-route entries())
