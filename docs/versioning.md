# Versioning and Release Workflow

This repository uses a lightweight release workflow designed for fast iteration without losing stable checkpoints.

## Branch Roles

- `main`: production-ready or demo-ready code only
- `develop`: integration branch for the next release
- `feature/*`: one feature or experiment at a time
- `fix/*`: targeted bug fixes

## Daily Workflow

1. Start from `develop`
2. Create a branch such as `feature/add-trip-filters`
3. Make changes and verify them locally
4. Open a pull request into `develop`
5. Merge after the feature is stable

## Release Workflow

1. Confirm `develop` is in a stable state
2. Merge `develop` into `main`
3. Update `CHANGELOG.md`
4. Bump the version in `package.json`
5. Create a git tag such as `v0.1.0`
6. Push the branch and tag
7. Create a GitHub Release from the tag

## Version Number Rules

- Minor release, for example `0.2.0`: adds a meaningful feature iteration
- Patch release, for example `0.2.1`: bug fixes or small polish only
- Major `1.0.0`: first version you consider stable enough to share broadly

## Pull Request Guidance

Keep each branch focused. If a change does not help the current release goal, keep it in a separate branch so releases stay easy to understand and easy to roll back.

## Release Checklist

- `npm install`
- `npm run lint`
- `npm run build`
- Update `CHANGELOG.md`
- Confirm the version in `package.json`
- Merge into `main`
- Tag release with `vX.Y.Z`
- Publish GitHub Release notes
