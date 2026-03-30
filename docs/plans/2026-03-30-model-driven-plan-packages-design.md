# Model-Driven Plan Packages Design

**Date:** 2026-03-30

## Goal

Upgrade the planning result from a single highlighted place plus lightly varied schedule text into model-assisted plan packages. The result page should present complete outing schemes that feel different by scenario, especially:

- `today`: a real `现在出发版` and a real `正常作息版`
- `weekend`: a coherent `2d1n` or `3d2n` multi-stop family plan instead of a single-place headline

## Approved Decisions

### 1. Keep Amap As The Candidate Source, Not The Final Narrator

Realtime POIs from Amap remain the hard data layer:

- fetch live family-friendly candidates
- filter out unsuitable or non-public places
- rank by age, distance, weather, trip type, and duration

The model should not invent places. It should only organize, describe, and differentiate the final schemes using the candidate pool that already passed ranking and filtering.

### 2. Upgrade From "Single Recommendation" To "Plan Package"

The current result page treats the top recommendation like a single destination headline. That breaks both the same-day and holiday use cases.

The new result should be package-oriented:

- every schedule option can expose a package headline
- every schedule option can expose a short package summary
- every schedule option can expose a small list of focus stops

This allows the UI to talk about a route or combination, not only one place.

### 3. Let DeepSeek Differentiate All Schedule Options, Not Only Depart-Now

The current pipeline only asks DeepSeek to polish the `depart-now` option. That makes the final two options too similar because `regular-rhythm` still comes from the rule template alone.

The new behavior should call DeepSeek for the full option set:

- if `today` returns two options, DeepSeek must refine both together in one response
- the prompt must explicitly require the two options to differ in pacing, first stop, and execution logic
- if `weekend` returns one option, the prompt must treat it as a full multi-day package and not a single stop

### 4. Preserve Rule-Based Fallbacks

The rules engine still matters for resilience.

If DeepSeek is unavailable, too slow, or returns invalid JSON:

- keep the existing schedule structure
- generate fallback package headlines and focus-stop summaries from the ranked POIs
- continue returning a result that is package-oriented in the UI

This keeps the experience usable even when the model layer is unavailable.

### 5. UI Should Stop Anchoring On One Place

The result hero should no longer render as:

`建议前往：某个地点`

New direction:

- if there are multiple options, the hero should frame the result as multiple plan packages
- each option card should show its own package headline and short package summary
- if there is only one option, the hero may use that package headline
- the existing place cards can remain as supporting POIs, but they are no longer the main scheme title

### 6. Validation

Add tests and verification for:

- richer schedule-option metadata such as package headline and focus stops
- same-day options producing different package metadata in fallback mode
- weekend plans exposing multi-stop package metadata instead of only one destination
- typecheck and production build remaining clean

