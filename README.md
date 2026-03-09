## BarterBiz API

Backend for BarterBiz MVP: Express + Prisma + PostgreSQL with JWT auth and barter marketplace flows.

### Prerequisites
- Node.js 18+
- PostgreSQL

### Setup
1) Install dependencies:
   ```bash
   npm install
   ```
2) Create `.env` from `.env.example` and set values (`DATABASE_URL`, `JWT_SECRET`, `PORT`).
3) Run migrations and generate Prisma client:
   ```bash
   npx prisma migrate dev
   ```
4) Seed sample data (optional for staging/local):
   ```bash
   npm run seed
   ```

### Scripts
- `npm run dev` — start in watch mode (ts-node-dev).
- `npm run build` — compile TypeScript to `dist`.
- `npm start` — run compiled server (Railway/production entrypoint).
- `npm run seed` — seed sample users/businesses/opportunities.
- `npm run prisma:generate` — regenerate Prisma client.
- `npm run prisma:migrate` — apply migrations in dev.
- `npm run prisma:deploy` — apply migrations in production.

### Deployment notes
- Railway command: `npm run start` (ensure `npm run build` runs first).
- Set env vars in Railway: `DATABASE_URL`, `JWT_SECRET`, `PORT` (Railway injects `PORT`; keep fallback 4000 locally).

### QA flows covered
- Signup/login, business profile, services, opportunities, proposals → deals, messaging, completion, ratings, notifications.
