# gurgenBudget

A personal budget website that plans monthly transactions and tells you how much you can safely spend per day. Full spec: [PROJECT.md](PROJECT.md).

## Stack

Vite + React + TypeScript, Firebase (Auth + Firestore), deployed to GitHub Pages via GitHub Actions on every push to `main`.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your Firebase project's config
npm run dev
```

## Deployment

Push to `main` and the [deploy workflow](.github/workflows/deploy.yml) builds and publishes to GitHub Pages automatically. The build needs these repo secrets, matching `.env.example`:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

GitHub Pages must be set to deploy from **GitHub Actions** (Settings → Pages → Source).
