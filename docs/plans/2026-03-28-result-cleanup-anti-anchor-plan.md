# Result Cleanup And Anti-Anchor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify the result page, update the late-night notice copy, and fix recommendation ordering so generic nearby parks no longer dominate the first recommendation.

**Architecture:** Update planning helpers first so recommendation ordering reflects trip intent instead of raw local proximity. Then simplify the React result page to remove repetitive framing and low-value metadata while keeping the core recommendation and schedule flow intact. Back the behavior with focused tests in the planning module and verification commands for the app.

**Tech Stack:** React, TypeScript, Vite, Vitest, Express

---

### Task 1: Lock The New Late-Night Notice And Anti-Anchor Rules In Tests

**Files:**
- Modify: `/Users/a995/vibecoding/papa-where-we-go/src/lib/planning.test.ts`
- Test: `/Users/a995/vibecoding/papa-where-we-go/src/lib/planning.test.ts`

**Step 1: Write the failing test**

Add tests that assert:
- The late-night same-day notice contains `现在夜深了，宝宝应该进入梦乡`
- A short same-day trip in 良渚 no longer returns a generic nearby park as the first recommendation when destination-style POIs are available

**Step 2: Run test to verify it fails**

Run: `npm test -- --run`

Expected: FAIL in the new assertions only.

**Step 3: Write minimal implementation**

Update the planning helpers so the new copy and lead-recommendation ordering satisfy the tests.

**Step 4: Run test to verify it passes**

Run: `npm test -- --run`

Expected: PASS for the new planning assertions.

**Step 5: Commit**

```bash
git add src/lib/planning.test.ts src/lib/planning.ts
git commit -m "fix: reduce lead recommendation anchor bias"
```

### Task 2: Simplify The Result Page Hierarchy

**Files:**
- Modify: `/Users/a995/vibecoding/papa-where-we-go/src/App.tsx`

**Step 1: Write the failing test**

No component test harness exists yet for this page, so validation for this task will rely on build verification plus visual structure review in code.

**Step 2: Run test to verify current limitation**

Run: `rg -n "resultFacts|WeatherLabel|建议完整方案|border border-ink/6 bg-paper/70" src/App.tsx`

Expected: Existing result page still contains redundant metadata and nested block framing.

**Step 3: Write minimal implementation**

Update the result section so it:
- Removes the fact-card strip and low-value capsule
- Keeps the main title and late-night notice
- Flattens nested schedule-day boxes into a cleaner grouped timeline layout

**Step 4: Run verification**

Run: `npm run build`

Expected: PASS with the simplified layout compiling cleanly.

**Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: simplify result page hierarchy"
```

### Task 3: Full Verification

**Files:**
- Verify: `/Users/a995/vibecoding/papa-where-we-go/src/lib/planning.ts`
- Verify: `/Users/a995/vibecoding/papa-where-we-go/src/App.tsx`
- Verify: `/Users/a995/vibecoding/papa-where-we-go/server.ts`

**Step 1: Run tests**

Run: `npm test -- --run`

Expected: PASS.

**Step 2: Run type/lint verification**

Run: `npm run lint`

Expected: PASS.

**Step 3: Run build verification**

Run: `npm run build`

Expected: PASS.

**Step 4: Commit final integration**

```bash
git add src/App.tsx src/lib/planning.ts src/lib/planning.test.ts docs/plans/2026-03-28-result-cleanup-anti-anchor-design.md docs/plans/2026-03-28-result-cleanup-anti-anchor-plan.md
git commit -m "fix: streamline result page and recommendation ordering"
```
