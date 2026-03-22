default:
  just --list

dev:
  npm run dev

build:
  npm run build:prod

preview:
  npm run preview

check:
  npm run check

new:
  npx tsx ./scripts/initBlog.ts

pub-date:
  npx tsx -e 'export {}; const now = new Date(); console.log(now.toISOString())'
