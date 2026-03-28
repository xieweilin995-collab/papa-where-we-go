# Manual Location And Result Map Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add resilient location handling and a visual map result without changing the product's editorial visual tone.

**Architecture:** Keep the current React single-page flow and Express API structure. Add a server geocoding endpoint plus shared client-side location helpers, then extend the existing home and result screens rather than redesigning them.

**Tech Stack:** React 19, TypeScript, Express, Vite, Tailwind CSS, AMap geocoding service, Leaflet map rendering, Vitest

---

### Task 1: Add minimal test scaffolding and location helper coverage

**Files:**
- Create: `src/lib/location.ts`
- Create: `src/lib/location.test.ts`
- Modify: `package.json`
- Create: `vitest.config.ts`

**Step 1: Write the failing tests**

Cover:
- geolocation failure falls back to a default city
- successful geocoding produces a displayable location state
- recommendation points can be mapped into marker entries safely

**Step 2: Run the tests and verify they fail**

Run: `npm test -- --run`
Expected: failure because helper module or test runner is missing

**Step 3: Add the minimal helper implementation and test runner config**

Add pure helpers for:
- fallback location creation
- manual location normalization
- map marker shaping

**Step 4: Run tests and verify they pass**

Run: `npm test -- --run`
Expected: all new tests pass

### Task 2: Add backend geocoding support

**Files:**
- Modify: `server.ts`
- Modify: `.env.example`

**Step 1: Write the failing test or fixture expectations**

Define the response contract in helper tests or inline type assertions:
- `name`
- `lat`
- `lng`
- `source`

**Step 2: Add `/api/geocode`**

Implement:
- AMap geocoding when `AMAP_API_KEY` exists
- graceful empty-query validation
- default fallback when geocoding fails

**Step 3: Verify type-checking**

Run: `npm run lint`
Expected: no TypeScript errors

### Task 3: Update the home flow for non-blocking location handling

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/index.css`

**Step 1: Add new UI states**

Support:
- auto locating
- auto location success
- manual input expanded
- fallback city notice
- manual geocode submit and retry

**Step 2: Keep the existing visual structure**

Do not redesign the core layout. Add location controls in the existing decision section with minimal visual disruption.

**Step 3: Verify behavior locally**

Run:
- `npm run lint`
- `npm run build`

Expected:
- home screen loads even when geolocation is unavailable
- generate button remains usable with fallback or manual location

### Task 4: Add result-page map rendering

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/index.css`

**Step 1: Add a map card component**

Show:
- selected location
- current center marker
- recommendation markers
- nearby place labels

**Step 2: Harden empty states**

If no recommendation points exist:
- still show the center map
- keep result page readable

**Step 3: Verify build output**

Run: `npm run build`
Expected: successful production bundle with map assets

### Task 5: Replace the homepage artwork

**Files:**
- Copy: `public/carousel-reference.png`
- Modify: `src/App.tsx`

**Step 1: Add the provided reference image**

Copy the user-supplied carousel artwork into `public`.

**Step 2: Replace the current hero image**

Keep the same framing and motion treatment while switching to the new asset.

**Step 3: Final verification**

Run:
- `npm test -- --run`
- `npm run lint`
- `npm run build`

Expected: all commands pass
