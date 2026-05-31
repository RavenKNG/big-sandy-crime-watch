# Big Sandy Crime Watch

Mobile-first public-safety news and public-record transparency demo. This repository intentionally uses synthetic, de-identified fixtures only. The official-source adapter is disabled pending human legal and platform review.

## Local setup
`npm install`, `npm run typecheck`, `npm test`, then `npm run dev`.

## Demo commands
`npm run import:demo`, `npm run import:fixture`, `npm run import:csv`, `npm run import:dry-run`, `npm run fb:dry-run`, and `npm run scheduler:start`.

## Before launch
Configure PostgreSQL, generate Prisma Client, add admin authentication, persist correction requests, and keep the official-source adapter disabled until legal and platform review is complete.
