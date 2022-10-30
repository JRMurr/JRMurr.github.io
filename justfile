default:
  just --list

start:
  npm run start

run:
  npm run dev

new:
  npx ts-node ./scripts/compose.ts

type-check:
  npx tsc -p ./tsconfig.json --noEmit