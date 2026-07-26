# Recovering an orphaned Stripe registration

Only an authenticated `ADMIN` or `SUPER_ADMIN` may call:

```http
POST /api/public/admin/stripe/recover-registration
Authorization: Bearer <admin-access-token>
Content-Type: application/json
```

The endpoint retrieves the PaymentIntent from Stripe, requires a successful USD
payment, prevents reuse of a PaymentIntent already present in `registrations`,
creates the parent/student/registration records, and sends the normal customer
confirmation plus admin copy.

Example request:

```json
{
  "paymentIntentId": "pi_...",
  "selectedProgram": {
    "_id": "PROGRAM_OBJECT_ID",
    "title": "Program title"
  },
  "selectedBatch": {
    "_id": "BATCH_OBJECT_ID",
    "title": "Batch title",
    "sessionsPerWeek": 1
  },
  "students": [
    {
      "firstName": "Student",
      "lastName": "Name",
      "dob": "2014-05-10",
      "gender": "Male"
    }
  ],
  "parent": {
    "parentName": "Parent Name",
    "email": "parent@example.com",
    "phone": "408-555-1234",
    "address": "123 Main St",
    "city": "Cupertino",
    "state": "CA",
    "zip": "95014"
  },
  "sessionsPerWeek": 1,
  "adminOrderNote": "Original paid order did not reach MongoDB after the payment callback failed."
}
```

Weekly programs must also include `selectedWeeklyBatches` in the same snapshot
shape used by the public registration flow. Cart recoveries may include
`cartItems` and `cartCheckoutMode: "cart"`.

Recovery records are marked as `ADMIN-BACKEND-ORDER`; customer waiver
signatures are intentionally not required. Multiple student objects may be
provided for a single parent/program/batch order.

The recorded total comes from Stripe's verified `amount_received`, so later
program price changes or expired historical coupons do not alter the recovered
payment amount.
