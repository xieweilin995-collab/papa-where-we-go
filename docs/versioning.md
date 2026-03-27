# Versioning and Release Workflow

This repository uses a lightweight release workflow designed for fast iteration without losing stable checkpoints.

## Branch Strategy

- `main`: the only long-lived branch
- All day-to-day development happens directly on `main`
- Stable milestones are preserved with git tags and GitHub Releases

## Daily Workflow

1. Pull the latest `main`
2. Make changes directly on `main`
3. Verify locally
4. Commit with a clear message
5. Push `main`

## Release Workflow

1. Confirm `main` is in a stable state
2. Update `CHANGELOG.md`
3. Bump the version in `package.json`
4. Create a git tag such as `v0.1.0`
5. Push `main` and the tag
6. Create a GitHub Release from the tag

## Version Number Rules

- Minor release, for example `0.2.0`: adds a meaningful feature iteration
- Patch release, for example `0.2.1`: bug fixes or small polish only
- Major `1.0.0`: first version you consider stable enough to share broadly

## Commit Guidance

Keep commits focused. If a change is experimental or risky, finish and verify it locally before pushing so `main` stays understandable and easy to recover with tags.

## Release Checklist

- `npm install`
- `npm run lint`
- `npm run build`
- Update `CHANGELOG.md`
- Confirm the version in `package.json`
- Confirm `main` is clean
- Tag release with `vX.Y.Z`
- Publish GitHub Release notes
