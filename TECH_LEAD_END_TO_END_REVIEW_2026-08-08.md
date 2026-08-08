# CCA Platform — End-to-End Technical Review

**Review date:** 8 August 2026  
**Review scope:** Entire repository (`app`, `backend`, configuration, tests, and recent maintenance/payment changes)  
**Reviewer perspective:** Tech lead review of correctness, security, payments, data integrity, privacy, maintainability, operations, and delivery readiness

## 1. Executive summary

The platform has several good foundations: access/refresh token separation, HttpOnly refresh cookies, server-side gateway verification, payment replay checks, role-aware routes, server-side price calculation for the single-program path, payment audit logs, and basic unit coverage for recent pricing regressions.

However, the current code should **not be considered financially production-safe until the Critical findings are fixed**. The most serious confirmed issue is that cart checkout calculates its stored and charged subtotal from the client-provided `item.fee`, despite comments stating that pricing is authoritative on the server. There are also account/data-integrity, PayPal webhook, coupon, consent, capacity, and registration state consistency gaps.

### Finding count

| Severity | Count | Meaning |
|---|---:|---|
| Critical | 5 | Immediate financial, payment, privacy, or legal correctness risk |
| High | 10 | Material production risk; address before broad rollout |
| Medium | 12 | Reliability, security-hardening, maintainability, or UX risk |
| Low | 5 | Quality and operational improvements |

### Recommended release position

1. C-01 through C-04 were remediated in the working tree after this review; deploy and verify them before accepting more production registrations.
2. Run the historical pricing audit after the C-01 correction is deployed and database access is available.
3. Reconcile all orders where `status` and `paymentStatus` disagree.
4. Add integration tests around complete Stripe, PayPal, check, guest, registered-parent, cart, coupon, refund, and webhook paths.

### Remediation update — 8 August 2026

- **C-01 resolved in code:** cart charges and stored order-item prices now use database-derived pricing; a changed browser fee is rejected. Regression tests cover authoritative student multiplication and fee tampering.
- **C-02 resolved in code:** unauthenticated checkout cannot reuse an email belonging to an active parent portal account; the customer must sign in.
- **C-03 resolved in code:** PayPal webhook verification no longer references an undefined variable, with a mocked provider-request regression test.
- **C-04 resolved in code:** coupon reservation and registration persistence now share a MongoDB transaction. A lost limit race rejects the registration instead of retaining the discount. Reservations remain attached to retryable online-payment orders and are atomically released for terminal cancellation/check rejection.
- **C-05 deferred for client clarification:** the current check-payment email behavior is an explicit stated business requirement and was not changed in this remediation.

## 2. Review method and limitations

The review included:

- Repository-wide route, model, controller, service, context, and checkout-flow inspection.
- Authentication and authorization path review for parent, coach, admin, and super admin.
- Stripe, PayPal, check, coupon, retry, refund, failure-notification, and recovery logic review.
- Registration, student, messaging, attendance, reporting, uploads, maintenance mode, and email review.
- `node --check` on changed backend files.
- Backend test suite: **21/21 tests passed**.
- Frontend TypeScript production build: **passed**.
- Frontend ESLint: **failed with 152 findings (145 errors, 7 warnings)**.
- `git diff --check`: passed during the preceding change review.
- `npm audit`: attempted for both applications but the local environment could not verify the npm registry TLS certificate, so dependency vulnerability status remains unverified.

This was a static/code-level review. It did not execute real Stripe/PayPal transactions, receive live webhooks, send live email, inspect production logs, or query the production database.

## 3. Critical findings

### C-01 — Cart checkout trusts the client-provided fee — Resolved in working tree

**Evidence:** `backend/src/utils/pricing.js:312-350`, especially `:326` and `:344-348`.

`computeCartTotal()` calls `computeRegistrationTotal()`, but then discards the authoritative returned unit price and overwrites it with:

```js
const unitPrice = round2(Number(item.fee));
...
return { ...priced, unitPrice, subtotal: round2(unitPrice * studentCount) };
```

`item.fee` comes from the browser cart and can be altered through DevTools or a direct API request. This value is then used by PayPal order creation, registration storage, coupon calculation, and payment comparison. An attacker can submit a lower positive fee and pay less than the database price.

The finding does **not** mean that multiplying by selected days/batches or students is itself incorrect. The intended calculation is valid:

```text
authoritative per-student fee = stored price for the server-validated month/frequency/day/batch selection
line subtotal                = authoritative per-student fee x actual number of submitted students
cart subtotal                = sum of all authoritative line subtotals
```

`computeRegistrationTotal()` attempts this reconstruction using the stored Program/Batch data together with `selectedDays`, `sessionsPerWeek`, `selectedMonth`, validated weekly-batch IDs, and the student count. However, in cart mode `computeCartTotal()` subsequently replaces that computed `priced.unitPrice` and `priced.subtotal` with `item.fee` from the request. `expectedUnitPrice` is described as being validated, but it is currently used to infer a month/frequency and no final mismatch rejection is performed. Therefore, the presence of the day/batch/student formula does not close the gap: the final charge remains controllable by changing the client fee while leaving the selection and student count unchanged.

Example: if the database-derived price is `$430 x 2 selected days x 1 student = $860`, a caller can submit the same program, batch, days, and student but set `item.fee` to `$1`. The server computes the authoritative result internally, then overwrites the line with `$1 x 1 student` and proceeds with a `$1` cart subtotal. Student count is taken from the submitted student array, which is appropriate for charging the students actually being registered; it does not protect the per-student fee.

**Impact:** Direct underpayment and incorrect registration totals for multi-program/cart checkout.

**Required fix:** Use `priced.unitPrice` and `priced.subtotal` only. Treat `item.fee` strictly as an optional expected-display value and reject the request if it differs from the authoritative price. The server must independently validate the selected month, frequency/day count, batch IDs, and actual student-array length before applying coupons. Add matrix tests for 1/2/3 selected days or weekly batches x 1/2/3 students, plus negative tests proving a modified `item.fee` cannot change the computed amount.

### C-02 — Guest checkout can mutate or register under an existing parent account — Resolved in working tree

**Evidence:** `backend/src/routes/public_registration.js:1155-1195`.

When no authenticated parent token is present, the code looks up a parent by submitted email. It blocks only when the requester supplies a new `accountPassword` and the existing record is already a portal account. Without `accountPassword`, it reuses the existing parent, updates their name/address/phone, and may update or create student records.

An unauthenticated caller who knows a registered parent's email can therefore attach registrations to that parent and alter profile/student information without proving ownership.

**Impact:** Parent and child data-integrity/privacy breach; false registrations and email spam under another account.

**Required fix:** If the email belongs to any active portal account, require authentication and return a generic “Please sign in” response. Guest reuse should be allowed only for a clearly separate guest identity model or via a signed, short-lived checkout token. Do not mutate existing parent/student records from unauthenticated input.

### C-03 — PayPal webhook signature verification throws at runtime — Resolved in working tree

**Evidence:** `backend/src/services/paypalService.js:101`.

`verifyWebhookSignature()` references `metadata.registrationId`, but `metadata` is not defined in that function:

```js
...(metadata.registrationId ? { 'PayPal-Request-Id': ... } : {})
```

This produces a `ReferenceError` before the verification request is made.

**Impact:** PayPal webhooks fail, so asynchronous payment success/failure recovery is unreliable. A browser/network interruption after payment may leave a paid registration unresolved.

**Required fix:** Remove the invalid header expression from webhook verification. Add a unit test that calls `verifyWebhookSignature()` with mocked PayPal HTTP responses, plus route-level tests for completed, denied, replayed, malformed, and unknown-order webhooks.

### C-04 — Coupon limit failure can still preserve the discounted total — Resolved in working tree

**Evidence:** `backend/src/routes/public_registration.js:1308-1393`.

If the atomic coupon usage increment fails because the limit was reached, the code sets `couponHonored = false` and omits `couponCode`, but it does not restore `priced.discount` or `priced.total`. The registration can therefore retain the discount even though the coupon was not honored.

The coupon counter is also incremented before `reg.save()`. If registration save fails, the usage count remains consumed. Check rejection does not restore a consumed use.

**Impact:** Unauthorized discounts, inaccurate coupon counters, and stranded coupon inventory.

**Required fix:** Perform coupon reservation and registration creation in one MongoDB transaction. If reservation fails, reject checkout or recompute the undiscounted total before any gateway charge. Define explicit release rules for failed/cancelled/check-rejected orders.

### C-05 — Pending check orders receive a “Registration Confirmed” invoice email — Deferred for client clarification

**Evidence:** `backend/src/routes/public_registration.js:1455`; `backend/src/services/emailService.js:36-40`.

All check registrations call `sendRegistrationEmail()` immediately even though they are stored as `paymentStatus: PENDING`, `status: AWAITING_PAYMENT`, and `checkPaymentState: SUBMITTED`. That email is titled “CCA Registration Confirmed” and presents an “Official Registration Invoice” and student ID card. Conversely, `confirmCheck()` does not send the successful confirmation after approval.

**Impact:** Customers may reasonably believe an unpaid/unverified check registration is confirmed. This conflicts with the paid-only invoice rule and can create enrollment and accounting disputes.

**Required fix:** Introduce a distinct “Check received / awaiting verification” email with no paid invoice or confirmed ID card. Send the successful registration/invoice email only from `confirmCheck()` after `paymentStatus` becomes `SUCCESS`.

## 4. High-severity findings

### H-01 — Registration numbers are race-prone

**Evidence:** `backend/src/models/index.js:461-465`.

Registration numbers use `countDocuments() + 1`. Concurrent requests, record deletion, or imported data can produce the same number and trigger a unique-index failure after payment or related records have already been created.

**Recommendation:** Use an atomic counter collection, a transaction-safe sequence, or an ObjectId/ULID-based public number. Handle collisions with bounded retry logic.

### H-02 — Capacity is displayed but never enforced or maintained

**Evidence:** `backend/src/models/Program.js:49`; `backend/src/models/index.js:28-30`; repository search finds no registration-time capacity check/increment.

`maxCapacity` and `currentCapacity` exist, and the dashboard reports fill rate, but registration does not atomically reserve a seat and successful/cancelled/refunded flows do not update capacity.

**Impact:** Overselling and misleading dashboard capacity.

**Recommendation:** Model seat reservations explicitly. Atomically reserve at the appropriate lifecycle point, release on timeout/failure/cancellation/refund, and derive or reconcile counters from successful/reserved registrations.

### H-03 — Registration status can diverge from payment status and corrupt revenue

**Evidence:** `backend/src/controllers/registrationController.js:113-150`; `backend/src/controllers/dashboardController.js:25-51`; `backend/src/controllers/reportController.js:15-52`.

The generic admin status endpoint can set `CONFIRMED` or `PAID` without changing or validating `paymentStatus`. Dashboard and revenue reports count revenue by registration `status`, not `paymentStatus === SUCCESS`. An unpaid order manually marked confirmed is reported as revenue.

**Recommendation:** Implement a single state-transition service. Financial reports must require `paymentStatus: SUCCESS` and exclude refunded orders. Restrict payment-sensitive status changes to dedicated actions.

### H-04 — Consent flags are hardcoded to true

**Evidence:** `backend/src/routes/public_registration.js:1408-1409`.

`mediaConsent` and `medicalConsent` are always saved as `true`, even though the request carries only waiver acceptance/signatures and no affirmative values for these fields.

**Impact:** Incorrect legal/privacy record, especially because students are minors.

**Recommendation:** Present independent consent choices, send their exact boolean values, store timestamp/version/source, and default optional consent to false. Never infer consent.

### H-05 — Registration creation is not transactional

**Evidence:** `backend/src/routes/public_registration.js:1155-1423`.

The flow updates/creates parent, updates/creates students, reserves coupon usage, then creates the registration. Failures after intermediate writes leave partial state: modified parent data, orphan students, consumed coupons, or a successful gateway payment without a saved registration.

**Recommendation:** Use a MongoDB session/transaction for all database mutations. External gateway actions need an order/payment state machine and idempotent reconciliation because they cannot participate in the DB transaction.

### H-06 — Payment gateway requests lack robust idempotency and timeouts

**Evidence:** `backend/src/services/stripeService.js`; `backend/src/services/paypalService.js`.

Stripe and PayPal HTTP calls have no explicit timeout/abort behavior. Stripe PaymentIntent creation has no idempotency key. PayPal order creation does not send `PayPal-Request-Id`. A network timeout after provider success but before local persistence can create duplicate remote objects on retry or hold Node requests indefinitely.

**Recommendation:** Add connect/request timeouts, bounded retries for safe operations, provider idempotency keys derived from registration/attempt IDs, and reconciliation jobs.

### H-07 — Refund initiation is not atomically claimed

**Evidence:** `backend/src/controllers/registrationController.js:497-544`.

Two simultaneous refund requests can both read `SUCCESS/NONE` before either stores `REFUNDED`, then both call the gateway. PayPal has a provider idempotency header; Stripe refund creation does not.

**Recommendation:** Atomically transition to `REFUND_PROCESSING` before calling the provider, include an idempotency key, then finalize `REFUNDED` or `REFUND_FAILED`. Persist provider response/error details.

### H-08 — Failure-email delivery has no retry/outbox

**Evidence:** `backend/src/services/paymentFailureService.js:6-51`.

The failure key is committed before email delivery. If customer or admin delivery fails, the same provider event is deduplicated on replay and cannot retry the email. The error is stored, but there is no worker or admin resend action.

**Recommendation:** Separate payment state transition from notification delivery using an outbox/job record with recipient-level delivery status and retry/backoff. Do not couple customer and admin delivery into one all-or-nothing call.

### H-09 — Child PII and medical notes persist in browser storage

**Evidence:** `app/src/context/CartContext.tsx:1-200`; `app/src/context/RegistrationContext.tsx:140-185`.

Cart items containing child name, DOB, school, gender, and medical notes are stored in `localStorage`; registration drafts store similar data in `sessionStorage`. Local storage survives logout and can remain on shared devices. Any XSS on the origin can read it.

**Recommendation:** Store only opaque cart/draft IDs client-side and keep sensitive details server-side with expiration. At minimum exclude medical notes/DOB from local storage, encrypt is not a substitute for XSS protection, expire drafts, and clear guest data after completion/cancellation.

### H-10 — Invalid batch IDs silently fall back to program pricing

**Evidence:** `backend/src/utils/pricing.js:52-62`.

If a submitted non-synthetic batch is not found or does not belong to the program, pricing silently falls back to program pricing instead of rejecting it.

**Impact:** Registration snapshots can reference invalid batches; schedule, capacity, coach roster, and pricing may diverge.

**Recommendation:** Reject unknown/inactive/mismatched batch IDs. Allow only the explicit synthetic program-batch convention and validate selected schedule entries against the program record.

## 5. Medium-severity findings

### M-01 — Coach rosters include unpaid registrations

**Evidence:** `backend/src/controllers/coachPortalController.js:15`.

`ACTIVE_REG_STATUSES` includes `PENDING` and `AWAITING_PAYMENT`. Coaches may see children whose online payment never completed. Define whether check-submitted registrations should reserve access, but failed/abandoned online registrations should not enter operational rosters.

### M-02 — PayPal cancel/retry can create duplicate pending registrations

**Evidence:** `app/src/pages/registration/PaymentPage.tsx:100-137`; `app/src/pages/cart/CartPage.tsx:232-269`.

Each PayPal `createOrder` callback first creates a fresh pending registration. After cancellation/error, a new PayPal attempt can create another registration rather than reuse the existing failed one.

**Recommendation:** Persist and reuse one pending registration per checkout draft/attempt, or explicitly cancel/supersede the old registration.

### M-03 — Maintenance mode is frontend-only and fail-open

**Evidence:** `app/src/App.tsx:10-24`; `backend/src/routes/index.js:64-112`.

If the site-status API fails, the frontend defaults to maintenance disabled. Existing open pages remain visible until navigation/refresh, and public APIs/payment endpoints continue operating.

**Recommendation:** Decide and document desired semantics. For a true operational freeze, enforce maintenance at backend middleware while allowing health, webhooks, login, refresh/logout, and admin endpoints. Poll or push status changes to already-open clients. Preserve an emergency environment-variable override to prevent admin lockout.

### M-04 — Password reset uses weak generated passwords and email delivery

**Evidence:** `backend/src/routes/public_registration.js:389-414`; `backend/src/controllers/coachAuthController.js:173`; use of `Math.random()`.

The reset flow immediately replaces the password with a `Math.random()`-generated temporary password and emails it. This is weaker and less auditable than a single-use reset-token flow.

**Recommendation:** Use `crypto.randomBytes`, store only a hashed, short-lived reset token, send an HTTPS reset link, invalidate all sessions after reset, and require a new password.

### M-05 — Shared login UI advertises admin forgot-password but the endpoint does not exist

**Evidence:** `app/src/pages/LoginPage.tsx:81-89`; `backend/src/controllers/authController.js:3-5`; no `/api/auth/forgot-password` route.

The UI silently submits to a missing admin endpoint and still reports success. Admins receive no recovery path.

**Recommendation:** Either implement secure admin recovery or clearly direct admins to an offline super-admin support process.

### M-06 — Student matching uses unescaped regular expressions

**Evidence:** `backend/src/routes/public_registration.js:1212-1213`.

Student first/last names are inserted into `RegExp` without escaping. Special characters can broaden matches or cause expensive regex evaluation.

**Recommendation:** Normalize names into dedicated indexed fields or escape regex metacharacters before exact case-insensitive matching.

### M-07 — CSV export is vulnerable to spreadsheet formula injection

**Evidence:** `backend/src/controllers/reportController.js:225-254`.

Quoting CSV cells does not neutralize values beginning with `=`, `+`, `-`, or `@`. User/admin-controlled fields opened in Excel can execute formulas.

**Recommendation:** Prefix risky cells with an apostrophe, normalize line breaks, and use a tested CSV library.

### M-08 — Hardcoded default CC/BCC recipients create privacy/governance risk

**Evidence:** `backend/src/services/emailService.js:8-16`.

Registration/payment emails containing parent and child details default to named personal CC/BCC addresses when environment variables are absent.

**Recommendation:** Remove personal defaults. Require explicit production configuration, minimize recipients, document retention/authorization, and log configuration errors without exposing PII.

### M-09 — File validation checks extension, not content

**Evidence:** `backend/src/middleware/upload.js` image/PDF filters.

Uploads are accepted based on filename extension only. MIME type and magic bytes are not verified; PDFs/images are served directly from the application origin.

**Recommendation:** Verify signatures/content, re-encode images, scan PDFs, set safe `Content-Disposition`/content-type headers, and store uploads in managed object storage.

### M-10 — Upload storage is local and repository-tracked

**Evidence:** `backend/uploads/*` is tracked for gallery/program/sponsor/media assets; only `backend/uploads/media/` is currently ignored for new files.

Local disk may be ephemeral in common hosting platforms, and storing binaries in Git increases repository size and makes deletion/retention difficult.

**Recommendation:** Move to S3/R2/Cloudinary or equivalent, add lifecycle/backups, remove generated uploads from Git history where appropriate, and store immutable object keys in MongoDB.

### M-11 — API validation and error handling are inconsistent

**Evidence:** Many handlers in `backend/src/routes/index.js` and controllers return raw `err.message`, parse dates/ObjectIds directly, and accept unbounded strings/arrays. The app imports `express-validator` but applies no consistent schema layer.

**Recommendation:** Add route schemas (Zod/Joi/express-validator), normalize 400/404/409/422 responses, cap pagination/array sizes/message sizes, reject invalid dates/ObjectIds before database calls, and centralize safe error mapping.

### M-12 — Frontend lint gate is substantially red

**Evidence:** `npm run lint` reports **152 problems: 145 errors and 7 warnings**.

Findings include extensive `any`, unused values, unstable hook/effect patterns, impure render logic (`Date.now()` in `SuccessPage`), and suppressed type errors. The build passes, but lint is not acting as a release gate.

**Recommendation:** Baseline and fix by risk area, beginning with checkout/payment/registration components. Add lint to CI and prohibit new violations.

## 6. Low-severity and maintainability findings

### L-01 — Very large modules increase regression risk

Largest examples:

- `backend/src/routes/public_registration.js` — 2,146 lines
- `app/src/admin/pages/Registrations.jsx` — 1,523 lines
- `app/src/admin/pages/ProgramForm.jsx` — 1,426 lines
- `app/src/components/chatbot/ChatbotRegistrationFlow.tsx` — 1,127 lines
- `backend/src/routes/index.js` — 1,095 lines
- `app/src/components/ProgramCard.tsx` — 980 lines

Split by bounded domain: auth, checkout, payment gateways, parent portal, messaging, attendance, admin content, and maintenance.

### L-02 — No backend lint/type checking

The backend is untyped CommonJS and has no lint script. The PayPal `metadata` defect is exactly the kind of undefined identifier a basic lint run would catch.

### L-03 — No CI/CD quality gate is present

No repository CI workflow was found to require tests, build, lint, audit, or migration checks before merge/deploy.

### L-04 — Reports and date handling use server-local timezone inconsistently

Some attendance utilities explicitly use California time, while email/report/admin notes use `toLocaleString()`/`toLocaleDateString()` without a fixed timezone. Production output can vary with server region.

### L-05 — Frontend bundle is very large

The production build emits an approximately 2.35 MB minified main JS chunk (about 670 KB gzip), with warnings about ineffective `jspdf` dynamic import and chunks over 500 KB.

**Recommendation:** Route-level lazy loading for admin/coach/media/PDF tooling, remove duplicate static/dynamic imports, and load third-party widgets only where needed.

## 7. Positive controls already present

The following controls are worth preserving:

- Parent/admin/coach access tokens are held in memory, with hashed rotating refresh tokens in HttpOnly cookies.
- Token types are checked so portal tokens cannot be interchanged.
- Parent dashboard queries are scoped by authenticated parent ID.
- Coach message and student access generally validate batch/program assignment.
- Stripe webhook signatures use HMAC and timestamp tolerance.
- Payment transaction IDs have sparse unique indexes and gateway verification.
- Stripe/PayPal confirmation email sending has a claim/stale-lock pattern.
- Refund actions are limited to super admins.
- Recent selected-day parsing regression has unit tests, including comma-containing addresses.
- Maintenance settings are restricted to super admins and keep `/login` plus `/admin/*` accessible.
- Upload size limits and role-gated admin upload routes are present.

## 8. Test coverage gap analysis

Current backend tests cover selected helper/validation behavior but not full workflows. No frontend automated tests were found.

### Required backend integration tests

1. Cart price tampering and authoritative multi-item totals.
2. Guest email collision with active parent accounts.
3. Concurrent registration-number generation.
4. Coupon last-use concurrency, save rollback, failed/check-rejected release.
5. Stripe create/fail/webhook/success/retry/refund idempotency.
6. PayPal order/capture/webhook/retry/refund, including the actual signature-verification call.
7. Check submitted versus approved email behavior.
8. Valid and invalid status transitions and revenue/report filtering.
9. Capacity reservation under concurrency.
10. Failure-email outbox retries and customer/admin partial delivery.
11. Parent/coach/admin authorization matrix and IDOR attempts.
12. Maintenance mode allow/deny matrix.

### Required frontend tests

1. Single and cart checkout totals with 1/2/3 selected days.
2. Quick registration and program detail schedule/location fidelity.
3. Review-order edit/remove and recalculation.
4. PayPal cancel/retry without duplicate pending registrations.
5. Stripe redirect recovery and failed-payment reporting.
6. Paid-only invoice visibility.
7. Maintenance mode routing, login/admin bypass, and API failure behavior.
8. Guest versus registered cart/draft isolation and cleanup.

### End-to-end environment tests

- Stripe test-mode card success, decline, 3DS redirect, webhook delay, browser close, retry, and refund.
- PayPal sandbox approve, cancel, deny, webhook delay/replay, retry, and refund.
- Email sandbox assertions for recipients, subject, order details, paid/unpaid wording, and links.
- Production-like Mongo replica set to exercise transactions and concurrency.

## 9. Prioritized remediation plan

### Phase 0 — Immediate containment (same day)

1. Disable cart checkout or fix C-01 and deploy with tampering tests.
2. Block unauthenticated checkout using an existing active parent email (C-02).
3. Fix PayPal webhook verification (C-03) and verify provider delivery logs.
4. Stop sending confirmed/invoice emails for pending checks (C-05).
5. Audit recent cart orders, coupon discounts, PayPal webhook failures, and status/payment mismatches.

### Phase 1 — Financial/data correctness (1–3 days)

1. Implement transactional registration/coupon persistence.
2. Introduce state-transition services for registration/payment/refund.
3. Fix capacity reservation and registration-number generation.
4. Make reports depend on `paymentStatus` and refund state.
5. Correct consent collection and historical records where possible.

### Phase 2 — Reliability and privacy (within 1 week)

1. Add provider idempotency, HTTP timeouts, reconciliation jobs, and notification outbox.
2. Remove child medical/DOB data from browser persistence.
3. Secure password reset and add super-admin MFA.
4. Harden uploads and migrate them to object storage.
5. Add CSV neutralization and consistent validation/error handling.

### Phase 3 — Engineering quality (1–2 weeks)

1. Add CI for backend tests, frontend build, lint, dependency audit, and migration checks.
2. Clear frontend lint debt, prioritizing payment and registration files.
3. Split large route/UI modules into domain services/components.
4. Add integration/E2E suites and production observability dashboards/alerts.

## 10. Historical/data audits to run

1. **Cart pricing:** Compare every cart order's stored `feePerStudent/itemTotal/subtotal` with the authoritative program/month/day price at registration time.
2. **Day-count regression:** Run `npm run audit:historical-pricing` after database network access is available; manually review all `HIGH` results.
3. **Payment consistency:** Find `status in [CONFIRMED, PAID]` with `paymentStatus != SUCCESS`, and `paymentStatus == SUCCESS` with non-confirmed/non-refunded status.
4. **Coupon consistency:** Compare `Coupon.usedCount` with qualifying successful/check-policy registrations; identify discounts with no `couponCode`.
5. **Duplicate/partial registrations:** Group by parent, program, students, amount, and close timestamps, especially PayPal cancellation windows.
6. **Check emails:** Identify pending/rejected checks that were sent confirmed registration emails.
7. **Capacity:** Compare successful active enrollments with program/batch limits.
8. **Consent:** Identify records with hardcoded `mediaConsent/medicalConsent` and determine whether valid affirmative evidence exists.
9. **PayPal webhooks:** Review provider delivery history for failures caused by the undefined `metadata` reference and reconcile affected captures.

## 11. Final assessment

The codebase is recoverable and has useful security improvements, but recent feature velocity has outpaced integration testing and lifecycle design. The primary architectural need is to make registration/payment a single explicit state machine with authoritative pricing, transactional persistence, idempotent gateway operations, and durable notifications. Fixing that core will remove many of the current defects simultaneously and make future admin/cart/payment changes much safer.
