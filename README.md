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

## 자유게시판과 다크모드

- 자유게시판은 서리 사이트의 글, 댓글, 사진 첨부 화면을 사용합니다. 승인된 회원과 관리자만 이용할 수 있고, 작성자 또는 관리자만 삭제할 수 있습니다.
- 첨부 사진은 비공개 `guild-board-images` 버킷에 저장합니다. 최대 3장, 장당 10MB이며, 게시글 삭제 시 댓글과 해당 첨부 사진도 정리합니다.
- 회원 관리는 관리자 메뉴에 표시됩니다. 다크모드는 PC 사이드바와 모바일 상단에서 전환하며 이 브라우저에 저장합니다.
- 게시판 스키마: `supabase/migrations/20260926010437_add_guild_board.sql`. 15월 프로젝트에만 적용합니다.
- 게시판 통합 검증은 `scripts/verify-board.mjs`의 prepare/verify 단계로 실행합니다. prepare가 만든 임시 계정은 관리자가 테스트 용도로 승인한 뒤 verify를 실행하고, 테스트 후 세션과 계정을 제거해야 합니다. 실제 회원 계정을 테스트 권한 변경에 사용하지 마세요.
