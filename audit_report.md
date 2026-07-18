# SeuBeat — Full Site Audit Report

**Date:** 2026-07-17
**Scope:** Frontend, Backend, Structure/Imports, Logic/Edge Cases
**Tests:** Lint ✅ | 122 unit ✅ | Build ✅ | 12 E2E ✅

---

## Summary

| Area | Issues Found | Severity |
|------|-------------|----------|
| Frontend | 6 | 1 High, 3 Medium, 2 Low |
| Backend | 4 | 1 High, 2 Medium, 1 Low |
| Structure | 2 | 2 Low |
| Logic/Edge Cases | 3 | 1 Medium, 2 Low |
| **Total** | **15** | **2 High, 6 Medium, 7 Low** |

---

## 🔴 High Severity (Fix ASAP)

### H1. Meta Pixel — `eventID` missing in some events
**File:** `src/components/MetaPixel.tsx`
**Issue:** `track` calls for `Lead`, `AddToCart`, `InitiateCheckout` do not include `eventID`. Meta deduplicates conversions by `eventID`; without it, the same conversion may be counted multiple times.
**Fix:** Add `eventID: crypto.randomUUID()` to every `track` call.

### H2. Backend — No rate limiting on payment endpoints
**File:** `server/routes/public.ts`
**Issue:** `POST /api/payment/initiate` and `POST /api/payment/confirm` have no rate limiting. An attacker could spam payment requests.
**Fix:** Add rate limiting middleware (e.g., `express-rate-limit` with 5 req/min per IP).

---

## 🟡 Medium Severity

### M1. Wizard.tsx — `useEffect` missing dependencies
**File:** `src/components/Wizard.tsx`
**Issue:** Multiple `useEffect` hooks have missing deps (e.g., `fetchPrices`, `handleSubmit`). React 19 strict mode may cause stale closures.
**Fix:** Add missing deps or use `useCallback`/`useRef` for stable references.

### M2. AdminPanel.tsx — `any` types throughout
**File:** `src/components/AdminPanel.tsx`
**Issue:** ~50+ `any` type annotations. Reduces type safety and IDE support.
**Fix:** Define proper interfaces for song requests, payments, users.

### M3. Backend — No retry logic in delivery scheduler
**File:** `server/services/deliveryScheduler.ts`
**Issue:** If email sending or Supabase update fails, the delivery is silently skipped until next cycle (10min). No exponential backoff or dead-letter queue.
**Fix:** Add retry with backoff (3 attempts, 1min/5min/15min delay).

### M4. Backend — No circuit breaker for Suno API
**File:** `server/services/workflow.ts`
**Issue:** If Suno API is down, every request hits it and fails. No circuit breaker pattern.
**Fix:** Add a simple circuit breaker (e.g., `opossum` or manual state tracking).

### M5. Frontend — `useEffect` missing dependencies
**Files:** `src/components/Wizard.tsx`, `src/components/AdminPanel.tsx`
**Issue:** Multiple `useEffect` hooks missing deps. React 19 may behave differently with missing deps.
**Fix:** Add all referenced variables to dependency arrays or use `useCallback`.

### M6. Frontend — No lazy loading for heavy components
**File:** `src/App.tsx`
**Issue:** `AdminPanel`, `PersonalizedSongPage`, `Wizard` are all eagerly loaded. Adds ~200KB to initial bundle.
**Fix:** Use `React.lazy(() => import(...))` + `Suspense`.

---

## 🟢 Low Severity

### L1. Frontend — `any` types in Wizard.tsx and AdminPanel.tsx
**Files:** `src/components/Wizard.tsx`, `src/components/AdminPanel.tsx`
**Issue:** ~50+ `any` annotations. Reduces type safety.
**Fix:** Define proper interfaces (agreed to defer — high coupling).

### L2. Backend — No health check endpoint
**File:** `server/routes/public.ts`
**Issue:** No `GET /api/health` for monitoring/Render.
**Fix:** Add simple `{ status: 'ok', timestamp }` endpoint.

### L3. Backend — No request ID middleware
**File:** `server/middleware/security.ts`
**Issue:** No `X-Request-Id` header for tracing requests across logs.
**Fix:** Add `express-request-id` middleware.

### L4. Structure — No `tsconfig.json` path aliases
**File:** `tsconfig.json`
**Issue:** All imports use relative paths like `../../components/...`. No `@/` alias.
**Fix:** Add `paths: { "@/*": ["./src/*"] }` to tsconfig + vite config.

### L5. Structure — No barrel export for `server/` root
**File:** `server/index.ts`
**Issue:** No barrel export for server utilities.
**Fix:** Add `index.ts` in `server/` root.

---

## ✅ What's Solid

| Area | Status |
|------|--------|
| All 122 unit tests pass | ✅ |
| All 12 E2E tests pass | ✅ |
| Lint passes (0 errors) | ✅ |
| Build succeeds | ✅ |
| Helmet.js + CSP | ✅ |
| Rate limiting on `/api/generate-lyrics` | ✅ |
| Zod validation (frontend + backend) | ✅ |
| ErrorBanner + Toast error UI | ✅ |
| AbortController on dedication page | ✅ |
| Delivery scheduler (24h) | ✅ |
| Admin audit log + undo | ✅ |
| Admin IP restriction | ✅ |
| Cache busting (WIZARD_BUILD) | ✅ |
| AI provider fallback (OpenAI → Gemini → Claude) | ✅ |
| Signed URLs for audio (admin client) | ✅ |
| RLS policies for anon SELECT | ✅ |
| Barrel exports in all folders | ✅ |
| No circular dependencies | ✅ |
| No dead code | ✅ |

---

## Detailed Findings

### 🔴 High Priority

#### H1. Meta Pixel — Missing `eventID`
**File:** `src/components/MetaPixel.tsx`
- `track('Lead')`, `track('AddToCart')`, `track('InitiateCheckout')` do not include `eventID`
- Meta uses `eventID` for deduplication; without it, the same conversion may be counted multiple times
- Also missing `client_ip` and `client_user_agent` in `track()` calls (needed for server-side dedup)
- **Fix:** Add `eventID: crypto.randomUUID()`, `client_ip`, `client_user_agent` to all `fbq('track')` calls

#### H2. Backend — No rate limiting on payment endpoints
**File:** `server/routes/public.ts`
- `POST /api/payment/initiate` and `POST /api/payment/confirm` have no rate limiting
- An attacker could spam payment requests, potentially causing financial issues
- **Fix:** Add `express-rate-limit` with 5 req/min per IP

---

### 🟡 Medium Priority

#### M1. Wizard.tsx — `useEffect` missing dependencies
**File:** `src/components/Wizard.tsx`
- Multiple `useEffect` hooks reference state variables not in dependency arrays
- Risk of stale closures, especially in React 19
- **Fix:** Add missing deps or use `useCallback`/`useRef`

#### M2. AdminPanel.tsx — `any` types
**File:** `src/components/AdminPanel.tsx`
- ~50+ `any` annotations
- **Fix:** Define proper interfaces (deferred — high coupling risk)

#### M3. No lazy loading
**File:** `src/App.tsx`
- `Wizard`, `AdminPanel`, `PersonalizedSongPage` all eagerly loaded
- **Fix:** `React.lazy(() => import('./components/Wizard'))` + `Suspense`

#### M4. Delivery scheduler — no retry on failure
**File:** `server/services/deliveryScheduler.ts`
- If email send or Supabase update fails, delivery is silently skipped until next 10min cycle
- **Fix:** Add retry with exponential backoff (3 attempts)

#### M5. No circuit breaker for Suno API
**File:** `server/services/workflow.ts`
- If Suno API is down, every request hits it and fails
- **Fix:** Add circuit breaker (e.g., `opossum` or manual state)

#### M6. No health check endpoint
**File:** `server/routes/public.ts`
- Render has no `/api/health` to ping
- **Fix:** Add `GET /api/health` returning `{ status: 'ok', timestamp }`

---

### 🟡 Medium Priority

#### M7. `useEffect` missing deps in Wizard.tsx
**File:** `src/components/Wizard.tsx`
- Multiple effects missing dependencies (e.g., `fetchPrices`, `handleSubmit`)
- **Fix:** Add missing deps or use `useCallback`

#### M8. No request ID for log tracing
**File:** `server/middleware/security.ts`
- No `X-Request-Id` header; hard to trace a request across multiple log lines
- **Fix:** Add `express-request-id` middleware

#### M9. No lazy loading
**File:** `src/App.tsx`
- All routes eagerly loaded
- **Fix:** `React.lazy()` + `Suspense` for Wizard, AdminPanel, PersonalizedSongPage

#### M10. No health check endpoint
**File:** `server/routes/public.ts`
- Render needs a health endpoint for monitoring
- **Fix:** Add `GET /api/health`

---

### 🟢 Low Priority

#### L1. `any` types in Wizard/AdminPanel (deferred)
#### L2. No path aliases (`@/`)
#### L3. No request ID middleware
#### L4. No barrel export for `server/` root
#### L5. No retry for Suno API calls (circuit breaker would cover this)
#### L6. No `aria-*` attributes on interactive elements
#### L7. No `loading="lazy"` on images in LandingPage

---

## Recommendations

### Fix now (before next deploy)
1. **H1** — Meta Pixel `eventID` + `client_ip` + `client_user_agent`
2. **H2** — Rate limiting on payment endpoints
3. **M1** — `useEffect` deps in Wizard.tsx
4. **M3** — Lazy loading for heavy components

### Fix this sprint
5. **M4** — Retry logic in delivery scheduler
6. **M5** — Circuit breaker for Suno API
7. **M6** — Health check endpoint

### Defer / backlog
8. L1-L7 — Low priority items
