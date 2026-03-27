# Repository Versioning Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a lightweight versioning and release workflow to the repository so each stable iteration is preserved.

**Architecture:** Keep the app code unchanged and add release-process documents plus lightweight repository metadata updates. Treat GitHub branch and tag creation as separate remote operations after local files are ready.

**Tech Stack:** Git, GitHub Releases, Markdown docs, npm package metadata

---

### Task 1: Document the workflow

**Files:**
- Create: `docs/versioning.md`
- Create: `CHANGELOG.md`
- Modify: `README.md`

**Step 1: Write the docs**

Add:
- branch roles for `main`, `develop`, `feature/*`, and `fix/*`
- release checklist
- semantic versioning rules
- changelog structure

**Step 2: Verify links and filenames**

Run: `test -f README.md && test -f CHANGELOG.md && test -f docs/versioning.md`
Expected: exit code `0`

**Step 3: Commit**

```bash
git add README.md CHANGELOG.md docs/versioning.md
git commit -m "docs: add versioning and release workflow"
```

### Task 2: Align repository metadata

**Files:**
- Modify: `package.json`

**Step 1: Set project identity**

Change:
- `name` to `papa-where-we-go`
- `version` to the next release target

**Step 2: Verify package.json parses**

Run: `node -e "const pkg=require('./package.json'); console.log(pkg.name, pkg.version)"`
Expected: prints `papa-where-we-go 0.1.0`

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: align package metadata for releases"
```

### Task 3: Standardize GitHub release inputs

**Files:**
- Create: `.github/pull_request_template.md`
- Create: `.github/release.yml`

**Step 1: Add templates**

Include:
- release note summary section
- testing checklist
- release note categories for features, fixes, and docs

**Step 2: Verify files exist**

Run: `test -f .github/pull_request_template.md && test -f .github/release.yml`
Expected: exit code `0`

**Step 3: Commit**

```bash
git add .github/pull_request_template.md .github/release.yml
git commit -m "chore: add GitHub release templates"
```

### Task 4: Create remote iteration lanes

**Files:**
- Remote branch: `develop`
- Remote tag: `v0.1.0`

**Step 1: Create the development branch**

Run: `git checkout -b develop && git push -u origin develop`
Expected: remote branch `develop` exists

**Step 2: Create the first stable tag**

Run: `git checkout main && git tag v0.1.0 && git push origin v0.1.0`
Expected: tag `v0.1.0` exists on GitHub

**Step 3: Publish the release**

Use GitHub Releases to publish notes from `CHANGELOG.md`.

**Step 4: Commit**

No local commit required. This is a remote repository operation.
