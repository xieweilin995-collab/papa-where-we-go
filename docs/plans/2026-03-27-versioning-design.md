# Repository Versioning Workflow Design

**Goal**

Give the project a repeatable workflow that preserves every meaningful iteration without slowing down development.

**Recommended Approach**

Use `main` for stable snapshots, `develop` for ongoing integration, and short-lived `feature/*` or `fix/*` branches for focused work. Track release history in `CHANGELOG.md`, keep the runtime version in `package.json`, and publish stable milestones as `vX.Y.Z` tags and GitHub Releases.

**Why This Approach**

- It is simple enough for a solo project.
- It keeps unstable work off `main`.
- It gives each milestone a clear version number and release note.
- It leaves room to add CI or protected branches later without changing the workflow.

**Files and Process Changes**

- Add `CHANGELOG.md` for release history.
- Add `docs/versioning.md` for branch and release instructions.
- Add `.github` templates to make releases and pull requests consistent.
- Update `README.md` so the workflow is visible at the top level.
- Set the package version to the first tracked milestone.

**Risks**

- GitHub branches, tags, and protections still need remote write access.
- The current environment can read GitHub but cannot push to GitHub, so remote setup may need to be completed later from a connected shell.
