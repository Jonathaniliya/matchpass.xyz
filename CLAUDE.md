# CLAUDE.md

## Project Purpose
Build a modern football-club ticketing platform MVP using Circle Managed Payments, Circle fan wallets, Arc testnet, and QR-based access control.

## Product Vision
Create a seamless, premium, futuristic fan experience where users can sign up with email, receive a unique wallet behind the scenes, buy tickets with stablecoins, and enter events with a secure QR pass.

## Core Product Model
- Clubs are Merchant of Record
- The platform is the software + orchestration layer
- Each club has its own Circle sub-wallet/account partition
- Each fan has a unique Circle wallet linked to their account
- Each ticket order creates a transient Circle payment intent
- Tickets are issued only after verified Circle webhook confirmation
- QR validation is handled by the app, not Circle

## Architectural Decisions
- Use email-first authentication for fans
- Create one persistent Circle wallet per fan after signup
- Use one transient payment intent per order for ticket checkout
- Do not use continuous intents for ticket purchases
- Use club sub-wallets for clean merchant/account segregation
- Keep payment attribution deterministic via `paymentIntentId`
- Store immutable payment webhook events for reconciliation and auditability

## Technical Priorities
1. Correct payment attribution
2. Reliable order-to-payment mapping
3. Idempotent webhook processing
4. Secure ticket issuance
5. Fraud-resistant QR validation
6. Clean fan identity + wallet mapping
7. Premium UI/UX

## UX Direction
- Modern, seamless, and mobile-first
- Dark mode first
- Premium, sporty, slightly futuristic visual design
- Minimal visible crypto complexity
- Email-first onboarding with wallet creation hidden behind the scenes
- Tickets should feel instant and easy to access

## UI Stack
- Chakra UI
- Responsive layouts
- Custom theme with dark surfaces, gradients, and premium card styling
- Accessible interactions and strong mobile usability

## Architecture Rules
- Do not issue tickets from frontend assumptions
- Only fulfill after verified server-side Circle webhook
- Keep Circle integrations server-only
- Do not expose secrets in client code
- Use deterministic order matching through transient payment intents
- Store QR tokens hashed, not plaintext
- Enforce single-use validation atomically at scan time

## Data Rules
- `fans.email` should be unique when present
- `fan_wallets.circle_wallet_id` must be unique
- `orders.circle_payment_intent_id` must be unique
- `payment_events.circle_event_id` must be unique
- `payments.provider_transaction_id` must be unique when present

## Security Rules
- Verify Circle webhook signatures
- Validate all request payloads with Zod
- Enforce order expiry
- Enforce single-use QR scanning
- Fail closed on ambiguous payment states
- Use `review_required` states instead of guessing

## UCW Custody Model
- Fan wallets are Circle User-Controlled Wallets (UCW) using 2-of-2 MPC with Shamir secret sharing
- No party (fan, platform, or Circle) ever holds the full private key
- There is no "reveal key" or seed phrase export — UCW does not expose one
- Do not surface a private-key affordance in any UI; market the MPC model as the security feature
- To move assets out of a UCW, use Circle's `/user/transactions/transfer` endpoint to send to an external address (deferred to a later milestone)

## MVP Scope
- Email authentication
- Fan account creation
- Fan Circle wallet provisioning
- Club records and Circle sub-wallet references
- Events and ticket types
- Order creation
- Circle transient payment intent creation
- Webhook processing
- Ticket issuance
- QR ticket rendering and scan verification
- Basic reporting and reconciliation logs