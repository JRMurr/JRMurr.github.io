default:
  just --list

start:
  npm run start

build:
  npm run build

new:
  npx tsx ./scripts/initBlog.ts

run:
  npm run dev
