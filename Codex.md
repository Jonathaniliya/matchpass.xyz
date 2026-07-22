# CODEX.md

## Coding Standards
- Use TypeScript everywhere
- Prefer small, composable server-side modules
- Validate all external inputs with Zod
- Keep route handlers thin
- Put business logic in service modules
- Use explicit enums/status values for orders, payments, tickets, and scans
- Persist webhook payloads immutably before processing side effects

## Product-Driven Engineering Rules
- Fans authenticate with email-first UX
- Each fan should have a persistent Circle wallet mapping
- Each ticket checkout must create a transient Circle payment intent
- Club-level payment segregation is handled via Circle sub-wallet references
- Ticket issuance must occur only after verified payment confirmation
- QR validation must be secure, atomic, and replay-resistant

## UI Standards
- Use Chakra UI for layout, theming, and accessible components
- Design dark mode first
- Use modern, premium, slightly futuristic styling
- Prefer clean spacing, high contrast, and mobile-first composition
- Avoid clutter and crypto-native jargon in user-facing copy
- Prioritize seamless flows and fast screen transitions

## Folder Design
- `src/lib/server/circle/*` for Circle integration
- `src/lib/server/auth/*` for auth/session helpers
- `src/lib/server/fans/*` for fan account + wallet provisioning
- `src/lib/server/orders/*` for order lifecycle
- `src/lib/server/tickets/*` for ticket issuance
- `src/lib/server/gate/*` for QR verification and scans
- `src/lib/server/db/*` for queries and transactions
- `src/components/*` for reusable Chakra-based UI
- `src/theme/*` for Chakra theme customization

## Route Handler Rules
- Route handlers parse, validate, call service modules, and return serialized responses
- No direct Circle calls from client components
- No ticket issuance logic in frontend code
- No auth-sensitive mutations without server-side session validation

## Database Rules
- Persist raw webhook payloads before mutation logic
- Use uniqueness constraints for idempotency
- Keep external provider IDs indexed and searchable
- Store fan wallet references separately from payment intent references
- Use transactional updates for webhook fulfillment and scan consumption
- Store hashed QR tokens, not plaintext values

## Error Handling
- Fail closed on payment ambiguity
- Move uncertain cases to `review_required`
- Never guess which order a payment belongs to
- Log structured errors with `fan_id`, `order_id`, and `payment_intent_id` when available
- Return safe, minimal client-facing error messages

## QR Rules
- Use signed or opaque random tokens with hashed persistence
- Tokens must be short-lived where possible
- Token consumption must be atomic
- Record all scan attempts, including denied scans

## Security Rules
- Circle secrets stay server-side only
- Verify webhook signatures
- Keep wallet provisioning logic server-side
- Never trust client-provided payment state
- Enforce session ownership checks for ticket access