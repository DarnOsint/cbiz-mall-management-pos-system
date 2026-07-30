# Celebiz — Mall Management & POS System

Full-featured mall management and point-of-sale system built for a 3-floor,
150-shop L-shaped shopping centre.

## Stack

- React 19 + TypeScript
- Vite 7
- Tailwind CSS 4
- Supabase (auth, database, RLS)
- Three.js / react-three-fiber (3D floor plan)
- Recharts (analytics)
- jsPDF (receipts/invoices)

## Getting Started

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in your Supabase credentials.

```bash
cp .env.example .env
```

## Available Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start dev server + print service |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright E2E tests |

## Deployment

Deployed on Vercel at [celebiz.vercel.app](https://celebiz.vercel.app).
