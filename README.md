<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Papa Where We Go

AI-powered outing planner for parents and kids.

View your app in AI Studio: https://ai.studio/apps/14f85b53-f3c2-40ef-84a5-c82272fe34b1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Development Workflow

Use these long-lived branches:

- `main`: stable versions only
- `develop`: day-to-day integration branch

Create short-lived feature branches from `develop`:

- `feature/<name>`
- `fix/<name>`

Recommended flow for each iteration:

1. Branch from `develop`
2. Build and verify locally
3. Merge back into `develop`
4. Promote `develop` into `main` when the iteration is stable
5. Tag the release on `main` using `v0.x.y`
6. Update [CHANGELOG.md](./CHANGELOG.md) and create a GitHub Release

## Versioning

This project uses semantic versioning:

- `v0.1.0`: first shareable milestone
- `v0.2.0`: new feature iteration
- `v0.2.1`: bug fix release

See [docs/versioning.md](./docs/versioning.md) for the full release checklist.
