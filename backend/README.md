# Car Doctor Backend (NestJS + Prisma + Supabase)

## Stack
- NestJS API
- Prisma ORM
- Supabase PostgreSQL
- Supabase Auth

## Environment
Copy `.env.example` to `.env` and set:
- `DATABASE_URL`
- `DIRECT_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Install
```bash
npm install
```

## Prisma workflow
```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

## Run API
```bash
npm run start:dev
```

## Module endpoints (REST CRUD)
- `GET /dashboard/overview`
- `POST|GET|GET/:id|PATCH/:id|DELETE/:id /customers`
- `POST|GET|GET/:id|PATCH/:id|DELETE/:id /vehicles`
- `POST|GET|GET/:id|PATCH/:id|DELETE/:id /job-orders`
- `POST|GET|GET/:id|PATCH/:id|DELETE/:id /service-history`
- `POST|GET|GET/:id|PATCH/:id|DELETE/:id /inventory-items`
- `GET /inventory-items/alerts/low-stock`
- `POST|GET|GET/:id|PATCH/:id|DELETE/:id /suppliers`
- `POST|GET|GET/:id|PATCH/:id|DELETE/:id /pos/sales`
- `POST|GET|GET/:id|PATCH/:id|DELETE/:id /invoices`
- `POST|GET|GET/:id|PATCH/:id|DELETE/:id /accounts-receivable`
- `POST|GET|GET/:id|PATCH/:id|DELETE/:id /expenses`
- `POST|GET|GET/:id|PATCH/:id|DELETE/:id /accounts-payable`
- `GET /reports/summary`
- `POST|GET|PATCH|DELETE /admin/users`
- `POST|GET /admin/users/technicians`

## Supabase auth endpoints
- `POST /auth/supabase/signup`
- `POST /auth/supabase/signin`
- `GET /auth/supabase/verify` (Bearer token)

## Database artifacts
- Prisma schema: `prisma/schema.prisma`
- Sample migration: `prisma/migrations/202603040001_init/migration.sql`
- Seed data: `prisma/seed.ts`
