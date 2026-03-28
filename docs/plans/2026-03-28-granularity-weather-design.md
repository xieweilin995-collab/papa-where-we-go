# Trip Granularity And Weather-Aware Planning Design

**Goal**

Improve plan quality by making nearby same-day recommendations more local, long-weekend recommendations broader, and weather effects visible and actionable in the decision flow.

**Approved Direction**

- `当天遛娃` uses a city-plus-district lens with tighter candidate filtering and stronger distance bias.
- `小长假` uses a city-level lens with wider candidate filtering and more variety across districts.
- The second screen shows current weather inline with the existing editorial decision layout.
- The result page removes the map module for now.
- Plan generation should feel near-instant, with a target loading time around one second.

**Why The Current Behavior Feels Wrong**

- The system still leans on raw nearby coordinates too heavily, so central commercial areas can dominate the candidate pool.
- POI candidates are not diversified enough before being sent to the AI planner.
- Weather affects the generated prompt, but users do not see it in the decision screen, so the interface feels disconnected from the recommendation logic.
- Loading time remains too long because POI lookup and AI generation can stack sequential latency.

**New Behavior**

- Same-day trips:
  - prioritize district-local options
  - use tighter search radius and stronger anti-commercial bias
  - favor quick, weather-appropriate child activities
- Long weekends:
  - expand to city-level variety
  - allow cross-district candidates
  - favor destinations with stronger stay value
- Weather:
  - shown directly in the decision screen
  - influences candidate scoring and the generated plan summary
- Loading:
  - target around one second by shrinking candidate payloads and falling back to a deterministic heuristic plan when AI latency exceeds the budget

**Files To Touch**

- `server.ts`
- `src/App.tsx`
- `src/lib/location.ts`
- `src/lib/location.test.ts`
- `src/index.css`

**Key Risks**

- Over-constraining district-level search could reduce variety too far for same-day trips.
- A one-second timeout requires a graceful fallback planner, or users will still see long waits.
- Removing the map should not leave an awkward layout gap in the result screen.
