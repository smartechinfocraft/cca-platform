# C-01 to C-04 Pre-Commit Review

**Review date:** 8 August 2026  
**Decision after remediation:** **Ready for commit after the documented commit-gate checks pass.** The findings below are retained as the audit trail; the two blockers and five high-severity findings were corrected in the same working tree.

## Remediation completed

- Cart enrollment is now derived only from each cart line's student list; the separate top-level list cannot increase enrollment without increasing the price.
- Empty cart-line students, invalid/cross-program batches, unknown month options, altered schedule entries, and frequency mismatches are rejected.
- Weekly cart selections are preserved and validated by stored weekly-batch IDs.
- Existing ACTIVE and GUEST parent records cannot be reused, mutated, or activated by an unauthenticated caller who merely knows the email. Historical guests must verify ownership through support until a dedicated email-verification flow is introduced.
- Coupon reservation uses `mongoose.connection.transaction()`, counts qualifying legacy uses, and keeps Registration plus Coupon writes atomic and retry-aware.
- Paid cancellations retain coupon redemption; unpaid terminal cancellation/check rejection releases it atomically.
- Unstarted online-payment reservations expire after two hours and are lazily reconciled before coupon pricing/reservation. Started or retryable gateway attempts retain their quoted reservation.
- Coupon release requires an actual counter decrement or rolls back.
- PayPal verification rejects missing headers and non-2xx provider responses.
- Adversarial backend coverage increased to 33 passing tests, and the frontend production build passes.

## Release blockers

### B-01 — Cart price student count can differ from enrolled student count

**Evidence:** `backend/src/utils/pricing.js:334`, `backend/src/routes/public_registration.js:1021`, `backend/src/routes/public_registration.js:1336`, and `app/src/pages/cart/CartPage.tsx:81,125,159`.

Cart pricing counts `cartItems[n].students`, while the Registration and Student records are created from the separate top-level `students` array. The normal frontend keeps these arrays aligned, but the public API does not verify that alignment.

An altered request can therefore submit one student inside `cartItems` and multiple students at the top level. The server charges for one and enrolls all top-level students. The same bypass works by leaving a cart item's student array empty and supplying `studentCount: 1` while submitting multiple top-level students.

**Required correction:** In cart mode, derive the authoritative registration students from the cart lines, or validate a stable per-line student identity/key mapping and reject any mismatch. Never accept two independent sources of truth for billable enrollment count. Add negative route/integration tests for mismatched arrays and counts.

### B-02 — Invalid batch IDs fall back to a potentially cheaper program price

**Evidence:** `backend/src/utils/pricing.js:48-62`.

When a non-synthetic batch ID does not resolve to an active Batch belonging to the Program, pricing intentionally falls back to Program pricing. The registration later stores client-derived batch IDs. A modified request can therefore avoid a higher batch override or per-session price and may attach an invalid/cross-program batch reference.

**Required correction:** Permit only the documented synthetic case where `batchId === programId`. For every other supplied batch ID, require an active Batch whose `program` matches `programId`; otherwise reject with `400`.

## High-severity findings

### H-01 — Day/month selection is not fully server validated

**Evidence:** `backend/src/utils/pricing.js:83-117` and `:239-249`.

The selected month can be inferred from the client-provided expected price when its label does not match. Selected days are counted by splitting arbitrary client text, but the entries are not checked against `Program.scheduleDays` or the selected Batch schedule. The new fee mismatch protects the final fee value, but the client can still manipulate the selection inputs used to derive that authoritative fee.

**Required correction:** Resolve the month by a stored option ID (preferred) or exact enabled label, reject missing/unknown options when options exist, and validate every selected schedule entry against stored schedule IDs/data. Derive frequency from the validated selection rather than arbitrary text.

### H-02 — Guest parent/student ownership is still claimable by email

**Evidence:** `backend/src/routes/public_registration.js:246-263` and `:1159-1205`.

The new checkout guard correctly blocks unauthenticated reuse of an active portal account. It still allows anyone knowing an existing GUEST email to update that parent and matching students. More seriously, `/auth/register` reuses any existing guest Parent and converts it to an ACTIVE portal account without email ownership verification. That can expose previously stored child registrations/data to the attacker after login.

**Required correction:** Require email verification or a signed short-lived guest ownership token before reusing, mutating, or activating a guest identity. A portal account must not be claimable solely by knowing its email address.

### H-03 — Raw `session.withTransaction()` does not restore Mongoose document state on transaction retry/abort

**Evidence:** `backend/src/services/couponReservationService.js:21-55`.

The same new Registration document instance is mutated and saved inside the driver's `session.withTransaction()` callback. Mongoose recommends `mongoose.connection.transaction()` for document operations because it integrates transaction rollback with Mongoose change tracking. If the driver retries the callback after a transient transaction error, the reused document may retain `isNew`/modified state from the aborted attempt. This can produce an update instead of an insert or otherwise leave coupon and registration persistence inconsistent.

**Required correction:** Use `mongoose.connection.transaction()` or create/hydrate the document inside each callback attempt in a retry-safe way. Add an integration test using a replica-set MongoDB that forces an abort/transient retry and proves both records commit or neither does.

### H-04 — Cancelling a successfully paid registration releases its coupon use

**Evidence:** `backend/src/controllers/registrationController.js:142-154`.

The generic status endpoint releases a reservation whenever the new status is `CANCELLED`, regardless of `paymentStatus`. An admin can therefore cancel a successfully paid registration and decrement `Coupon.usedCount`, making a genuinely redeemed limited coupon available again. Payment and registration status can also diverge.

**Required correction:** Release only an unpaid reservation (`paymentStatus !== SUCCESS`) under an explicit terminal cancellation transition. Paid cancellations must use the refund/business policy and must normally retain coupon redemption history.

### H-05 — Per-user coupon checks omit historical coupon uses

**Evidence:** `backend/src/services/couponReservationService.js:28-37`.

The new per-user query counts only registrations having `couponUsageRecordedAt`. Older registrations with `couponCode` but without this newly introduced timestamp are excluded, allowing a parent to exceed `perUserLimit` after deployment.

**Required correction:** Backfill reservation/redemption state before enabling this logic, or make the query include qualifying legacy paid/check records. Run a migration/audit that reconciles `Coupon.usedCount` with registrations.

## Medium-severity findings

### M-01 — Abandoned retryable orders can reserve coupons indefinitely

Failed online payments intentionally retain their reservation for retry, but no reservation expiry or stale-order cleanup exists. A user or bot can reserve all uses of a limited coupon without completing payment.

Define a reservation expiry, renewal-on-retry rule, and scheduled cleanup/reconciliation job. A successful payment must retain a permanent redemption; a genuinely abandoned unpaid order should eventually release its reservation.

### M-02 — Coupon release can silently lose its registration marker without decrementing inventory

**Evidence:** `backend/src/services/couponReservationService.js:64-79`.

The Registration marker is unset first. If `Coupon.updateOne()` modifies no record—for example due to drift, deletion, or `usedCount` already being zero—the transaction still commits and reports the release as successful. The registration can no longer be used to reconcile that reservation.

Require `modifiedCount === 1`; otherwise throw so the transaction rolls back. Preserve a separate immutable coupon redemption/reservation audit record rather than using only a timestamp on Registration.

### M-03 — PayPal verifier fix lacks route-level behavior coverage

The undefined-variable crash is fixed, and the service test proves a success response. Missing cases include absent signature headers, non-2xx PayPal responses, malformed JSON, verification failure, completed/denied events, duplicate events, and unknown registrations. The verifier also ignores HTTP status and trusts only the parsed body field.

Add service and controller tests for these cases and explicitly require a 2xx verification response plus `verification_status === SUCCESS`.

### M-04 — Parent/student writes remain outside the coupon-registration transaction

Parent profile updates and Student creation/updates occur before coupon reservation and Registration save. If the coupon loses a race or Registration persistence fails, those writes remain. This does not recreate the unauthorized discount, but it leaves partial checkout data and can mutate profiles even though checkout failed.

Either include checkout-created/updated records in the transaction or defer nonessential profile mutations until the financial reservation succeeds.

## Positive verification

- The cart no longer overwrites the calculated unit price with `item.fee`.
- Stored cart order-item prices now prefer the calculated line price.
- Active portal emails are blocked from unauthenticated checkout reuse.
- The immediate PayPal `metadata is not defined` exception is removed.
- Coupon increment and Registration save are attempted in one transaction.
- Existing automated suite passes: 27/27 tests.
- Frontend production build passes.

These checks do not offset the release blockers because the current tests exercise utility/service happy paths, not adversarial route payloads or real MongoDB transaction rollback/retry behavior.
