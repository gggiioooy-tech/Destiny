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
