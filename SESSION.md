# Session Notes

## Issues found comparing dev (SvelteKit) vs prod (Next.js)

### 1. Missing "All Posts" link on homepage
The homepage is missing the "All Posts →" link at the bottom of the post list that prod has.

### 2. Table of Contents skips h1 headings
The ToC generator in the dev site excludes `h1` headings from the table of contents. On the chess engine post, prod shows "Try it out" and "How Does a Chess Engine Work?" (both h1s) in the ToC, while dev skips them and starts at h2 level ("A Gui"). Same issue on the AoC post where "Day 04" (h1) is missing from dev ToC.

### 3. Projects page missing subtitle
The dev projects page is missing the subtitle text: "A [small] selection of my projects, mostly out of date... maybe ill update some day..."

### 4. 404 page is unstyled
Dev 404 shows plain "404 / Post not found" text. Prod has a styled 404 page with "Sorry we couldn't find this page" message and a "Back to homepage" button.

### 5. Minor date discrepancy on first blog post
AoC Days 04-06 shows "December 8, 2024" on dev vs "December 9, 2024" on prod. Could be a timezone handling difference in date parsing.

### 6. Reading time slightly different
Chess engine post shows "28 min read" on dev vs "29 min read" on prod. Minor, possibly due to content differences in how the reading time is calculated.

### 7. Chess iframe sizing
The chess iframe has a fixed 990x720 size which may not be ideal for all desktop viewport widths. Could benefit from responsive sizing in the future.

## Working correctly
- Navigation (Blog, Tags, Projects, About) all functional
- Blog listing page with tag sidebar - identical
- Tags page - identical
- About page - identical
- Code syntax highlighting - matches
- Dark mode toggle - works
- Mobile responsive layout - works
- WASM chess board component - loads and renders
- Blog post prev/next navigation - works
- "Load Comments" button - present
- Footer with social links - works
