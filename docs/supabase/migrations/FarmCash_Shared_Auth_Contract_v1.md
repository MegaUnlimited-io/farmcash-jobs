# FarmCash Shared Auth Contract v1 (Web + Mobile + OCG)

Date: 2026-02-26  
Scope: Minimal "Do Not Break" contract for shared Supabase auth/data.

## 1) Identity contract (required)
- `auth.users.id` is the canonical user identity UUID.
- `public.users.id` must match `auth.users.id` 1:1.
- Any flow that authenticates a user MUST tolerate temporary mismatch where user exists in `auth.users` but profile row is missing.

## 2) Required profile fields (shared consumers)
Minimum fields expected to exist/behave consistently:
- `public.users.id`
- `public.users.email`
- `public.users.level`
- `public.users.xp`
- `public.users.seeds_balance`
- `public.users.referral_code`
- `public.users.referred_by`
- `public.users.referral_count`
- `public.users.waitlist_bonus_claimed`
- `public.users.email_verified_bonus_claimed`

## 3) Referral + bonus contract
- Referral code format: **8-char alphanumeric** (A-Z, 2-9, no ambiguous chars).
- Bonus awarding functions must remain idempotent.
- Re-verification/re-login must not double-credit seeds.

## 4) Compatibility guardrails for backend changes
For any migration/RPC change touching auth/profile/referrals:
1. Keep backward compatibility for a short window (recommended: 7 days).
2. Note changed fields/RPC signatures in docs changelog.
3. Run cross-platform checks:
   - mobile signup -> verify link -> web dashboard
   - web signup -> verify -> web dashboard
   - magic-link login from both origins
   - password reset works
   - email change works

## 5) Failure-mode expectation (important)
If `auth.users` exists but `public.users` is missing:
- Do not hard-fail with generic "user not found".
- Return a recoverable UX path (auto-create profile or clear remediation message).
- Log diagnostic event for investigation.
