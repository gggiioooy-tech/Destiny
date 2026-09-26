# 15월 공략 사이트

React + Vite frontend for https://destiny-lemon-sigma.vercel.app/.

## Scope

- GitHub: gggiioooy-tech/Destiny
- Vercel: tpskfltjfl-s-projects/destiny
- Supabase: kqygrszkbuzxmmfndhye

This repository is separate from Seori. Never apply these migrations to another project.

## Development

Use Node.js 22.12 or newer. Run `npm ci`, then `npm run dev`.
Run `npm run build` and `npm audit` before deployment.
Push main to the existing Vercel project; verify its deployment status and production page.

## Authentication

The site-auth Edge Function validates passwords through Supabase Auth. Database RLS enforces membership and administrator permissions. New members require approval. Browser storage remembers only the optional username; auth sessions use sessionStorage.

The existing 15month owner logs in with the existing password once, then must change it before accessing content. The migration removes plaintext passwords and retains a private one-time bcrypt hash until the first successful login. Never put service-role keys in frontend code.

Deploy database migrations and the site-auth function only to the Supabase project listed above. The function uses custom authentication, so gateway verify_jwt is disabled; password-changing requests verify their bearer token inside the function.

## Security verification

`npm run verify:security` checks anonymous read/write denial and branding against this project's API. The script also has explicit prepare/member/admin/rotation phases for controlled disposable-account integration testing. These phases create or modify live test data and require corresponding administrator setup between phases. Remove the exact test profile and Auth user afterward; never use the owner's account for these tests.

## Guild-war screenshot recognition

Approved members can upload a PNG, JPEG, or WebP in the attack page to recognize three defense heroes. The recognized team filters the existing defense/counter list; hero corrections immediately update the search. Corrections are stored in this browser only, under a Destiny-specific key. Shared Seori learning/admin RPCs and Android screenshot access are not connected.

The engine and public reference pack were ported together from Seori v4.5.11. Keep `public/guildwar-recognition.worker.js`, `public/hero-recognition` in deployment output. Nickname recognition is intentionally disabled. Run `npm run test:recognition` for correction regressions.
