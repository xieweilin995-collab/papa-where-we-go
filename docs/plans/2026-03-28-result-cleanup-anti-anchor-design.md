# Result Cleanup And Anti-Anchor Design

**Date:** 2026-03-28

## Goal

Refine the result page so it feels lighter and more intentional, while fixing the recommendation bias that keeps promoting ordinary local parks such as "美丽洲公园" as the default first destination.

## Approved Decisions

### 1. Night Notice Copy

For same-day trips after 21:00, replace the current advisory copy with:

`现在夜深了，宝宝应该进入梦乡。下面优先给你隔天白天更适合执行的方案。`

This keeps the guidance warm and direct, and removes the more mechanical "21:00 以后" phrasing from the visible notice.

### 2. Result Page Simplification

Reduce the amount of information shown at the top of the result page.

Keep:
- Main recommendation title
- Night notice when present
- Main schedule section
- Recommended places list
- Re-plan entry

Reduce or remove:
- The top location/weather capsule if it does not materially help action
- The current fact-card strip if it repeats information already obvious from the user’s selection
- Decorative section chrome that adds density without helping decisions

### 3. Schedule Card Hierarchy

The current schedule section visually nests too many bordered containers.

New direction:
- One outer schedule container
- One schedule-option card per version
- Inside each option, use a clean timeline/list instead of another boxed sub-card for each day

This removes the "three-layer frame" look while still preserving multi-day grouping.

### 4. Fix First-Recommendation Bias

The current pipeline ranks POIs, deduplicates clusters, then slices the first few items directly into the plan. That means a location with consistently strong local-distance scoring can remain pinned at the front across many runs.

The fix should not be cosmetic randomness. It should change candidate selection and recommendation ordering so the first recommendation reflects the trip intent.

#### New ranking intent

For the first visible recommendation:
- Penalize ordinary neighborhood-style parks and generic nearby green spaces as primary destinations
- Prefer destination-style venues when available, such as museums, heritage parks, zoos, aquariums, science venues, and stronger themed family destinations
- Keep local parks available in the recommendation list for short same-day trips, but stop making them the default headline unless they are clearly the best fit

#### Scope-sensitive behavior

For same-day short outings:
- Still value same-district access and low travel burden
- But avoid locking the first slot to one recurring generic park if higher-intent family venues exist nearby

For holiday trips:
- Strongly favor destination POIs for the lead recommendation
- Continue filtering out neighborhood-only parks for longer durations

### 5. Validation

Add tests that prove:
- The new late-night notice copy appears
- The schedule options still behave correctly after 21:00
- Candidate selection no longer leaves generic local parks pinned as the lead option when stronger destination POIs are available

