# Trip Granularity And Weather-Aware Planning Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make same-day recommendations district-local, long-weekend recommendations city-wide, expose weather in the decision flow, remove the result map, and cap perceived loading around one second.

**Architecture:** Keep the current React plus Express structure, but add deterministic recommendation helpers on the server so candidate selection is constrained before AI planning. Use a timeout-based fallback plan generator to keep latency bounded, and keep the frontend within the existing editorial layout by extending the decision section rather than redesigning it.

**Tech Stack:** React 19, TypeScript, Express, Vite, Vitest, AMap/OpenWeather APIs

---

### Task 1: Encode location granularity and recommendation helper tests

**Files:**
- Modify: `src/lib/location.ts`
- Modify: `src/lib/location.test.ts`

**Step 1: Write the failing tests**

Add tests for:
- same-day display label prefers city plus district
- long-weekend display label prefers city only
- recommendation marker helpers stay stable when some entries have no coordinates

**Step 2: Run test to verify it fails**

Run: `npm test -- --run`
Expected: helper tests fail because new granularity helpers do not exist

**Step 3: Write minimal implementation**

Add pure helpers that:
- derive a city-level label
- derive a city-plus-district label
- expose the correct label for each trip type

**Step 4: Run test to verify it passes**

Run: `npm test -- --run`
Expected: all helper tests pass

### Task 2: Fix server-side candidate bias and loading budget

**Files:**
- Modify: `server.ts`

**Step 1: Write the failing test or fixture expectation**

Define expectations in helper-oriented tests or direct command validation:
- same-day uses tighter radius and stronger nearby filtering
- commercial-heavy POIs are down-ranked
- AI fallback returns a valid plan shape within timeout budget

**Step 2: Write minimal implementation**

Implement:
- trip-type-aware POI filtering and scoring
- district-aware label shaping where possible
- one-second planning budget with a deterministic fallback plan

**Step 3: Verify behavior**

Run: `npm run lint`
Expected: no TypeScript errors

### Task 3: Update decision screen weather and location UI

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/index.css`

**Step 1: Write the failing UI expectation**

Add or document expectations for:
- weather row visible in second screen
- no `重新定位` tab/button in the location cluster
- trip-type-dependent location label

**Step 2: Write minimal implementation**

Change the decision screen to:
- show weather inline
- remove the redundant relocalize control
- keep only the lighter location-change path

**Step 3: Verify behavior**

Run:
- `npm run lint`
- `npm run build`

Expected:
- second screen shows weather
- layout remains visually consistent

### Task 4: Remove the result map and tighten result layout

**Files:**
- Modify: `src/App.tsx`

**Step 1: Write the failing expectation**

Document or verify that the result page should no longer render the map section.

**Step 2: Write minimal implementation**

Remove the map block and rebalance spacing so recommendation cards remain the main focus.

**Step 3: Verify build**

Run: `npm run build`
Expected: successful production bundle without result map rendering

### Task 5: Final verification

**Files:**
- No new files

**Step 1: Run full verification**

Run:
- `npm test -- --run`
- `npm run lint`
- `npm run build`

Expected:
- all tests pass
- lint passes
- build passes
