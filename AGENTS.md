# AGENT.md

## Mission
Help build a stablecoin-enabled football ticketing platform MVP with clean fan identity, deterministic payment-to-order matching, secure QR-based access control, and a premium modern UI.

## Product Model
- Club is Merchant of Record
- Platform provides UX, orchestration, ticketing, and access control
- Each club has a Circle sub-wallet/account reference
- Each fan has a unique Circle wallet linked to email-based identity
- Each checkout order creates a transient Circle payment intent
- Circle webhook confirmation triggers ticket issuance
- QR access is generated and validated by the app

## Primary Workflow
1. Fan signs up with email 
2. Backend creates fan record
3. Backend provisions Circle wallet for fan
4. Fan browses events and selects ticket(s)
5. Backend creates order
6. Backend creates transient Circle payment intent
7. Fan pays
8. Verified Circle webhook arrives
9. Backend confirms payment
10. Ticket is issued
11. QR token is generated
12. Gate scan validates the token and logs result

## Source of Truth
- Circle webhook is the source of truth for payment confirmation
- Internal database is the source of truth for orders, tickets, QR tokens, and scan events
- Frontend is never the source of truth for payment success

## Key System Principles
- Deterministic order attribution beats heuristic matching
- Persistent fan identity should be separated from one-off checkout intents
- Money events and entitlement events should be modeled separately
- Auditability matters from day one
- QR replay protection is a first-class requirement
- The user experience should hide crypto complexity wherever possible

## Stack Decisions
- UI: Tailwind v4 (already installed) — not Chakra
- ORM: Prisma
- Framework: Next.js 16.2.6 App Router (newer than my training — consult `node_modules/next/dist/docs/` before writing App Router code)

## Immediate Build Priorities
- project scaffold
- Tailwind v4 base styling + dark premium mobile-first theme
- auth flow
- fan model
- fan wallet provisioning flow
- Circle client wrapper
- order creation route
- transient payment intent creation
- webhook route
- DB schema
- QR issuance and validation
- dark premium mobile-first UI

## Avoid
- continuous intents for ticket purchases
- order matching by amount and timestamp
- frontend-driven payment success handling
- exposing wallet or payment secrets in client code
- long-lived static QR codes without lifecycle/state
- mixing payment adapters directly into UI components