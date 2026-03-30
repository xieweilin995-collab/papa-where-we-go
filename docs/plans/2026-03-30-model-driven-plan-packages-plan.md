# Model-Driven Plan Packages Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single-destination result framing with model-assisted plan packages, and make `现在出发版` and `正常作息版` genuinely different in the final output.

**Architecture:** Keep Amap-based POI collection and ranking as the hard filter layer. Extend planning helpers so every schedule option has package-level metadata, then add one DeepSeek refinement pass that enhances all schedule options together. Finally, update the React result view to render package headlines and summaries instead of anchoring on `recommendations[0]`.

**Tech Stack:** React, TypeScript, Vite, Vitest, Express, Cloudflare Pages Functions, DeepSeek API

---

### Task 1: Lock Package Metadata Expectations In Tests

**Files:**
- Modify: `/Users/a995/vibecoding/papa-where-we-go/src/lib/planning.test.ts`
- Test: `/Users/a995/vibecoding/papa-where-we-go/src/lib/planning.test.ts`

**Step 1: Write the failing test**

Add tests that assert:
- same-day realtime plans expose package metadata per schedule option
- same-day `depart-now` and `regular-rhythm` fallback packages do not share the same headline or focus-stop list
- weekend plans expose multiple focus stops in package metadata instead of behaving like a single-point recommendation

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/planning.test.ts`

Expected: FAIL on the new package metadata assertions.

**Step 3: Write minimal implementation**

Update planning helpers so schedule options include fallback package headline, package summary, and focus-stop lists.

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/lib/planning.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/planning.ts src/lib/planning.test.ts
git commit -m "feat: add package metadata to schedule options"
```

### Task 2: Refine All Schedule Options With DeepSeek

**Files:**
- Modify: `/Users/a995/vibecoding/papa-where-we-go/server.ts`
- Modify: `/Users/a995/vibecoding/papa-where-we-go/functions/api/[[route]].ts`

**Step 1: Write the failing test**

No direct API test harness exists yet for these two entrypoints, so validation for this task will rely on focused planning tests plus live request verification after implementation.

**Step 2: Verify current limitation**

Run: `rg -n "maybeRefineDepartNowSchedule|refineDepartNowScheduleWithDeepSeek|scheduleOptions.find\\(\\(option\\) => option.id === \"depart-now\"" server.ts 'functions/api/[[route]].ts'`

Expected: Current implementation only refines `depart-now`.

**Step 3: Write minimal implementation**

Replace the single-option refinement path with one shared refinement path that:
- sends all schedule options to DeepSeek together
- asks DeepSeek to preserve structure but make scenario packages meaningfully different
- returns package-level metadata for each option
- falls back to the rule-generated options if the model fails

**Step 4: Run verification**

Run: `npm run lint`

Expected: PASS.

**Step 5: Commit**

```bash
git add server.ts functions/api/[[route]].ts
git commit -m "feat: refine plan packages with deepseek"
```

### Task 3: Update The Result Page To Render Package-Oriented Output

**Files:**
- Modify: `/Users/a995/vibecoding/papa-where-we-go/src/App.tsx`

**Step 1: Write the failing test**

No component test harness exists for this page. Validation will rely on typecheck, build, and live inspection of the returned data shape.

**Step 2: Verify current limitation**

Run: `rg -n "建议前往：\\{result\\.recommendations\\[0\\]|精选推荐地点|Kids Play" src/App.tsx`

Expected: The hero still anchors on a single recommendation.

**Step 3: Write minimal implementation**

Update the result UI so it:
- shows a package-oriented hero instead of one-place headline
- surfaces package headline, package summary, and focus stops inside each schedule option
- keeps individual recommendation cards as supporting destinations, not the main plan title

**Step 4: Run verification**

Run: `npm run build`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: present result packages instead of single-place headline"
```

### Task 4: Full Verification And Deploy

**Files:**
- Verify: `/Users/a995/vibecoding/papa-where-we-go/src/lib/planning.ts`
- Verify: `/Users/a995/vibecoding/papa-where-we-go/server.ts`
- Verify: `/Users/a995/vibecoding/papa-where-we-go/functions/api/[[route]].ts`
- Verify: `/Users/a995/vibecoding/papa-where-we-go/src/App.tsx`

**Step 1: Run tests**

Run: `npm test -- --run src/lib/planning.test.ts`

Expected: PASS.

**Step 2: Run type/lint verification**

Run: `npm run lint`

Expected: PASS.

**Step 3: Run build verification**

Run: `npm run build`

Expected: PASS.

**Step 4: Deploy**

Run: `env -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID npm run cf:deploy`

Expected: PASS with a new Pages deployment URL.

**Step 5: Commit final integration**

```bash
git add docs/plans/2026-03-30-model-driven-plan-packages-design.md docs/plans/2026-03-30-model-driven-plan-packages-plan.md src/lib/planning.ts src/lib/planning.test.ts server.ts functions/api/[[route]].ts src/App.tsx
git commit -m "feat: generate model-driven plan packages"
```
