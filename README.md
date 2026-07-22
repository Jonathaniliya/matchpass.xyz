# Fan Ticketing Platform MVP

A Next.js-based ticketing and access-control platform for football clubs using Circle Managed Payments and Arc testnet.

## MVP Goals

- Club is Merchant of Record
- One Circle sub-wallet per club
- One transient Circle payment intent per order
- Ticket issued only after verified Circle webhook
- QR-based stadium entry validation
- Immutable payment event storage
- Strong idempotency and reconciliation

## Core Flow

1. Fan selects a ticket
2. Backend creates an order
3. Backend creates a transient Circle payment intent
4. Fan pays using USDC or EURC
5. Circle webhook confirms payment
6. Backend issues ticket and QR token
7. Gate scanner validates QR token

## Architecture Summary

- Next.js App Router
- TypeScript
- Postgres / Supabase
- Circle Managed Payments
- Arc testnet
- Zod for validation
- QR token lifecycle with anti-replay checks

## Core Entities

- clubs
- club_circle_accounts
- events
- ticket_types
- fans
- orders
- order_items
- payments
- payment_events
- tickets
- qr_tokens
- scan_events

## Important Rules

- Never issue tickets from frontend assumptions
- Only fulfill after verified Circle webhook
- One transient payment intent per order
- Shared continuous intents are not used for ticket checkout
- QR tokens must be single-use and short-lived
- All webhook processing must be idempotent

## Initial Setup

Install dependencies:

```bash
npm install next react react-dom zod qrcode @supabase/supabase-js postgres
npm install @circle-fin/circle-sdk
npm install --save-dev typescript tsx @types/node @types/react @types/react-dom eslint prettier
```

If using Drizzle:

```bash
npm install drizzle-orm
npm install --save-dev drizzle-kit
```

If using Prisma instead:

```bash
npm install prisma @prisma/client
```

## Environment Variables

Create `.env.local`:

```env
DATABASE_URL=
CIRCLE_API_KEY=
CIRCLE_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=
```

Add more once Circle wallet/account configuration is finalized.

## Suggested Folder Structure

```txt
src/
  app/
    api/
      orders/
      webhooks/
      gate/
  lib/
    server/
      circle/
      db/
      orders/
      tickets/
      gate/
  types/
```

## Status

This repository is currently in MVP scaffold phase.