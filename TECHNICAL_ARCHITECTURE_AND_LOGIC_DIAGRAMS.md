# CCA Platform — Current Technical Architecture and Logic Diagrams

**Document date:** 8 August 2026  
**Scope:** Current implementation in `app/` and `backend/`  
**Notation:** Mermaid diagrams render in GitHub, GitLab, many Markdown viewers, and Mermaid Live Editor.

> This is an **as-built/current-state** document. Red nodes describe known risk points identified in `TECH_LEAD_END_TO_END_REVIEW_2026-08-08.md`; they are not proposed behavior.

## 1. System context

```mermaid
flowchart LR
    Visitor[Public visitor or guest]
    Parent[Registered parent]
    Coach[Coach]
    Admin[Admin]
    Super[Super admin]

    SPA[React 19 and Vite SPA]
    API[Node.js and Express API]
    DB[(MongoDB Atlas)]
    Stripe[Stripe REST API and webhooks]
    PayPal[PayPal REST API and webhooks]
    Resend[Resend email API]
    Groq[Groq chatbot API]
    Disk[(Local upload storage)]
    Widget[ElevenLabs widget]

    Visitor --> SPA
    Parent --> SPA
    Coach --> SPA
    Admin --> SPA
    Super --> SPA

    SPA -->|HTTPS JSON and multipart| API
    API --> DB
    API --> Stripe
    Stripe -->|Signed webhook| API
    API --> PayPal
    PayPal -->|Verified webhook| API
    API --> Resend
    API --> Groq
    API --> Disk
    SPA --> Widget
```

## 2. Repository/module structure

```mermaid
flowchart TB
    Root[cca-platform]

    Root --> App[app]
    Root --> Backend[backend]
    Root --> Docs[Operational and review documents]

    App --> PublicUI[Public pages and components]
    App --> RegUI[Registration and checkout]
    App --> ParentUI[Parent dashboard]
    App --> AdminUI[Admin portal]
    App --> CoachUI[Coach portal]
    App --> Contexts[Auth, cart, registration contexts]
    App --> ClientServices[Axios clients and services]
    App --> Utilities[PDF, month, weekly-batch utilities]

    Backend --> Server[server.js middleware and startup]
    Backend --> Routes[index.js, public_registration.js, chatbot.js]
    Backend --> Controllers[Auth, program, registration, coach, reports, webhooks]
    Backend --> Services[Stripe, PayPal, email, payment confirmation/failure]
    Backend --> Models[MongoDB and Mongoose models]
    Backend --> Middleware[Auth, RBAC, uploads, chatbot security]
    Backend --> Utils[Pricing, validation, tokens, logging, time]
    Backend --> Tests[node:test unit tests]
    Backend --> Scripts[Seed, migrations, historical pricing audit]
```

## 3. Frontend route topology

```mermaid
flowchart TB
    Browser[Browser URL]
    AppGate[App.tsx site-status gate]
    StatusAPI[GET /api/public/site-status]
    Maintenance[MaintenancePage]
    Router[AppRoutes]

    Browser --> AppGate
    AppGate --> StatusAPI
    AppGate -->|Enabled and route is not login or admin| Maintenance
    AppGate -->|Disabled or bypass route| Router

    Router --> PublicRoutes[Public routes]
    Router --> Login[/login]
    Router --> ParentGuard[Parent ProtectedRoute]
    Router --> AdminGuard[AdminProtectedRoute]
    Router --> CoachGuard[CoachProtectedRoute]

    PublicRoutes --> Home[/]
    PublicRoutes --> Programs[/programs and /programs/:id]
    PublicRoutes --> Content[/about /media /faq /donate]
    PublicRoutes --> Cart[/cart]
    PublicRoutes --> Checkout[/register-program /student-details /review-order /payment /success]

    ParentGuard --> ParentLayout[/dashboard]
    ParentLayout --> ParentHome[Dashboard home]
    ParentLayout --> Purchases[Purchases]
    ParentLayout --> Retry[Purchase payment retry]
    ParentLayout --> Students[Students]
    ParentLayout --> ParentMessages[Messages]
    ParentLayout --> Profile[Profile]

    AdminGuard --> AdminLayout[/admin]
    AdminLayout --> AdminDomains[Programs, registrations, content, reports, coaches, coupons]
    AdminLayout --> Recovery[Stripe and PayPal recovery]
    AdminLayout --> SiteSettings[Site maintenance settings]

    CoachGuard --> CoachLayout[/coach]
    CoachLayout --> CoachDomains[Dashboard, batches, students, scan, attendance, messages, profile]
```

## 4. Backend request pipeline

```mermaid
flowchart TB
    Request[Incoming request]
    Helmet[Helmet security headers]
    CORS[CORS allowlist]
    LoginLimit[Login-specific limiter]
    GeneralLimit[General API limiter]
    PaymentLimit[Payment or webhook limiter]
    StripeRaw{Stripe webhook?}
    StripeWebhook[Raw body Stripe webhook handler]
    Parsers[JSON, URL encoded, cookies]
    PayPalWebhook[PayPal webhook handler]
    Uploads[Static /uploads]
    ApiRouter[/api router]
    NotFound[JSON 404]
    ErrorHandler[Global error handler]

    Request --> Helmet --> CORS --> LoginLimit --> GeneralLimit --> PaymentLimit --> StripeRaw
    StripeRaw -->|Yes| StripeWebhook
    StripeRaw -->|No| Parsers
    Parsers --> PayPalWebhook
    Parsers --> Uploads
    Parsers --> ApiRouter
    ApiRouter --> NotFound
    StripeWebhook -. error .-> ErrorHandler
    ApiRouter -. error .-> ErrorHandler
```

## 5. API/domain map

```mermaid
flowchart LR
    API[/api]

    API --> Public[/public]
    API --> AdminAuth[/auth]
    API --> AdminDomain[Admin domain endpoints]
    API --> CoachAuth[/coach-auth]
    API --> CoachPortal[/coach-portal]

    Public --> Catalog[Programs, batches, categories, locations, content, coupons, coaches]
    Public --> ParentAuth[Parent auth]
    Public --> Payments[Stripe, PayPal, check registration, donations]
    Public --> ParentPortal[Parent dashboard, students, profile, messages]
    Public --> Chatbot[Chatbot]
    Public --> SiteStatus[Site status]

    AdminDomain --> MasterData[Programs, categories, locations, levels, age groups, batches]
    AdminDomain --> Registrations[Registrations, check actions, refunds, edit emails]
    AdminDomain --> Operations[Attendance, messages, reports, students, coaches]
    AdminDomain --> Content[Media, FAQs, sponsors, coupons]
    AdminDomain --> Settings[Site settings]
    AdminDomain --> AdminRecovery[Gateway recovery]

    CoachPortal --> CoachRoster[Batches and students]
    CoachPortal --> CoachAttendance[Scan and attendance]
    CoachPortal --> CoachMessages[Messages]
    CoachPortal --> CoachProfile[Profile and password]
```

## 6. Authentication and session lifecycle

```mermaid
sequenceDiagram
    participant U as Browser user
    participant SPA as React auth context
    participant API as Auth endpoint
    participant DB as MongoDB

    U->>SPA: Submit credentials
    SPA->>API: POST login
    API->>DB: Find live account and compare bcrypt hash
    DB-->>API: Account
    API->>API: Create 15-minute access token
    API->>API: Create refresh token and hash it
    API->>DB: Store current refresh-token hash
    API-->>SPA: Access token in JSON plus HttpOnly refresh cookie
    SPA->>SPA: Keep access token in memory

    Note over SPA,API: Page refresh loses in-memory access token
    SPA->>API: POST refresh with HttpOnly cookie
    API->>DB: Verify token type, account status, and stored hash
    API->>DB: Rotate refresh-token hash
    API-->>SPA: New access token and rotated cookie

    SPA->>API: Protected API with Bearer access token
    API->>API: Verify signature and portal token type
    API->>DB: Reload account and live role/status
    API-->>SPA: Authorized response

    U->>SPA: Logout
    SPA->>API: POST logout
    API->>DB: Clear refresh-token hash
    API-->>SPA: Clear refresh cookie
    SPA->>SPA: Clear in-memory user/token
```

### Portal separation

```mermaid
flowchart LR
    Token[JWT token]
    Token --> Type{Token type}
    Type -->|parent| ParentMiddleware[parentAuth]
    Type -->|admin| AdminMiddleware[protect]
    Type -->|coach| CoachMiddleware[coachAuth]

    ParentMiddleware --> ParentModel[(Parent)]
    AdminMiddleware --> UserModel[(User)]
    CoachMiddleware --> CoachModel[(Coach)]

    AdminMiddleware --> Role{Live admin role}
    Role --> Admin[ADMIN]
    Role --> Super[SUPER_ADMIN]
```

## 7. Core data model

```mermaid
erDiagram
    USER {
        ObjectId id
        string username
        string email
        string passwordHash
        string role
        string status
        string refreshTokenHash
    }
    PARENT {
        ObjectId id
        string email
        string passwordHash
        string accountStatus
        string refreshTokenHash
        string address
    }
    COACH {
        ObjectId id
        string email
        string username
        string passwordHash
        string status
        string refreshTokenHash
    }
    PROGRAM {
        ObjectId id
        ObjectId category
        ObjectId location
        ObjectId coachId
        string title
        string batchType
        number basePrice
        number discountedPrice
        number maxCapacity
        array scheduleDays
        array monthOptions
        array weeklyBatches
    }
    BATCH {
        ObjectId id
        ObjectId program
        ObjectId location
        ObjectId coach
        number price
        number pricePerSession
        number maxCapacity
        number currentCapacity
        array monthOptions
    }
    REGISTRATION {
        ObjectId id
        string registrationNumber
        ObjectId parentId
        ObjectId programId
        array students
        array batches
        array orderItems
        string status
        string paymentMethod
        string paymentStatus
        number subtotal
        number discountAmount
        number totalAmount
        string transactionId
        string paypalOrderId
        array paymentAuditLog
        array editAuditLog
    }
    STUDENT {
        ObjectId id
        ObjectId parentId
        string studentCode
        string firstName
        string lastName
        date dob
        string medicalNotes
        array fitnessLogs
    }
    COUPON {
        ObjectId id
        string code
        string type
        number value
        number usedCount
        number maxUses
        number perUserLimit
    }
    ATTENDANCE {
        ObjectId id
        ObjectId studentId
        ObjectId registrationId
        ObjectId batchId
        ObjectId programId
        date date
        string status
    }
    MESSAGE_THREAD {
        ObjectId id
        ObjectId parentId
        ObjectId batchId
        string subject
        string status
        array messages
    }
    SITE_SETTING {
        string key
        boolean maintenanceEnabled
        string maintenanceTitle
        string maintenanceMessage
        string maintenanceContactEmail
        ObjectId updatedBy
    }

    USER ||--o{ PROGRAM : creates
    USER ||--o{ SITE_SETTING : updates
    PARENT ||--o{ STUDENT : owns
    PARENT ||--o{ REGISTRATION : places
    PROGRAM ||--o{ BATCH : has
    COACH ||--o{ BATCH : teaches
    COACH ||--o{ PROGRAM : teaches_embedded_schedule
    PROGRAM ||--o{ REGISTRATION : selected_in
    BATCH }o--o{ REGISTRATION : selected_in
    STUDENT }o--o{ REGISTRATION : enrolled_in
    COUPON ||--o{ REGISTRATION : applied_to
    STUDENT ||--o{ ATTENDANCE : has
    REGISTRATION ||--o{ ATTENDANCE : supports
    PARENT ||--o{ MESSAGE_THREAD : opens
    BATCH ||--o{ MESSAGE_THREAD : scopes
```

## 8. Public program and batch presentation

```mermaid
flowchart TB
    AdminForm[Admin ProgramForm]
    ProgramDoc[(Program document)]
    Schedule[scheduleDays: day, time, groundAddress]
    Weekly[weeklyBatches]
    Month[monthOptions]

    AdminForm --> ProgramDoc
    ProgramDoc --> Schedule
    ProgramDoc --> Weekly
    ProgramDoc --> Month

    PublicAPI[GET public programs or program detail]
    Synthetic[Build synthetic batch when no Batch documents exist]
    Listing[Programs listing]
    Quick[Quick registration modal]
    Detail[Program detail registration]

    ProgramDoc --> PublicAPI
    PublicAPI --> Synthetic
    PublicAPI --> Listing
    PublicAPI --> Quick
    PublicAPI --> Detail
    Schedule --> Listing
    Schedule --> Quick
    Schedule --> Detail
```

## 9. Registration UI state and cart flow

```mermaid
flowchart LR
    Browse[Program listing or details]
    Select[Select month, frequency, and day slots]
    Students[Enter/select students]
    CartContext[CartContext in localStorage]
    RegContext[RegistrationContext in memory and sessionStorage]
    Cart[/cart]
    Review[/review-order]
    Payment[/payment]
    Success[/success]

    Browse --> Select --> Students
    Students -->|Add to cart| CartContext
    Students -->|Single flow| RegContext
    CartContext --> Cart
    Cart --> Review
    RegContext --> Review
    Review -->|Edit| Select
    Review -->|Remove| CartContext
    Review --> Payment
    Payment --> Success

    CartContext -. stores child PII and medical notes .-> RiskPII[Known privacy risk]
    style RiskPII fill:#7f1d1d,color:#fff,stroke:#ef4444
```

## 10. Authoritative pricing logic — current implementation

```mermaid
flowchart TB
    Request[Pricing request]
    Mode{Single registration or cart?}
    Single[computeRegistrationTotal]
    Cart[computeCartTotal]

    Request --> Mode
    Mode -->|Single| Single
    Mode -->|Cart| Cart

    Single --> LoadProgram[Load active Program]
    LoadProgram --> LoadBatch[Load selected Batch]
    LoadBatch --> WeeklyCheck[Validate weekly batch IDs]
    WeeklyCheck --> MonthMatch[Match enabled month option]
    MonthMatch --> DayCount[Count selected days using plus, pipe, or newline]
    DayCount --> UnitPriority{Select unit-price source}

    UnitPriority --> WeeklyPrice[Program price times selected weeks]
    UnitPriority --> MonthPrice[Month price times selected frequency]
    UnitPriority --> SessionPrice[Batch per-session price times frequency]
    UnitPriority --> BatchPrice[Batch flat price]
    UnitPriority --> ProgramPrice[Discounted or base program price]

    WeeklyPrice --> SingleSubtotal[Unit price times student count]
    MonthPrice --> SingleSubtotal
    SessionPrice --> SingleSubtotal
    BatchPrice --> SingleSubtotal
    ProgramPrice --> SingleSubtotal
    SingleSubtotal --> Coupon[Validate and calculate coupon]
    Coupon --> SingleTotal[Authoritative single total]

    Cart --> ForEach[For each browser cart item]
    ForEach --> Single
    Single --> ServerLine[Server-priced line]
    ServerLine --> ClientOverwrite[Current code overwrites line unit price and subtotal with client item.fee]
    ClientOverwrite --> CartCoupon[Apply coupon to resulting cart subtotal]
    CartCoupon --> CartTotal[Cart total used for registration and payment]

    style ClientOverwrite fill:#7f1d1d,color:#fff,stroke:#ef4444
```

## 11. Registration creation — current transaction boundary

```mermaid
flowchart TB
    Register[POST /api/public/register]
    ValidateShape[Validate program, cart, waiver, students, address]
    ParentToken[Resolve optional parent access token]
    Program[Reload program and weekly schedule data]
    Price[Compute price and coupon]
    ParentResolve[Find/create/update Parent]
    Students[Find/create/update Student records]
    Verify[Verify supplied Stripe intent or PayPal capture]
    CouponUse[Increment coupon usage when applicable]
    Snapshot[Build orderItems snapshots]
    Save[Save Registration]
    Email[Send or schedule email]
    Response[Return registration result]

    Register --> ValidateShape --> ParentToken --> Program --> Price
    Price --> ParentResolve --> Students --> Verify --> CouponUse --> Snapshot --> Save --> Email --> Response

    ParentResolve -. unauthenticated email may reuse active parent .-> ParentRisk[Known identity/data-integrity risk]
    CouponUse -. occurs before registration save .-> TxRisk[No MongoDB transaction]
    Students -. partial records survive later failure .-> TxRisk

    style ParentRisk fill:#7f1d1d,color:#fff,stroke:#ef4444
    style TxRisk fill:#7f1d1d,color:#fff,stroke:#ef4444
```

## 12. Registration and payment state model

```mermaid
stateDiagram-v2
    [*] --> AWAITING_PAYMENT: Pending registration saved
    AWAITING_PAYMENT --> PENDING: Gateway attempt started
    PENDING --> PAYMENT_FAILED: Provider, webhook, or browser reports failure
    PAYMENT_FAILED --> PENDING: Parent retries Stripe or PayPal
    PENDING --> CONFIRMED: Payment verified SUCCESS
    AWAITING_PAYMENT --> CONFIRMED: Check approved by admin
    AWAITING_PAYMENT --> CANCELLED: Check rejected
    CONFIRMED --> REFUNDED: Super-admin gateway refund
    CONFIRMED --> CANCELLED: Generic admin status endpoint currently permits status-only change
    PAYMENT_FAILED --> CANCELLED: Admin action

    note right of CONFIRMED
      Expected paymentStatus = SUCCESS
      Current generic status endpoint can
      create status/payment divergence.
    end note
```

### Payment status axis

```mermaid
stateDiagram-v2
    [*] --> PENDING
    PENDING --> FAILED: Failed attempt
    FAILED --> PENDING: Retry starts
    PENDING --> SUCCESS: Gateway/check verification
    SUCCESS --> REFUNDED: Refund completes
```

## 13. Stripe initial payment flow

```mermaid
sequenceDiagram
    participant U as Parent or guest
    participant SPA as StripePaymentBox
    participant API as Express API
    participant DB as MongoDB
    participant S as Stripe
    participant E as Email service

    U->>SPA: Continue to card details
    SPA->>API: POST register with Stripe and no transaction ID
    API->>DB: Save AWAITING_PAYMENT registration
    API-->>SPA: registrationId
    SPA->>API: POST stripe/create-payment-intent
    API->>DB: Load pending registration and stored total
    API->>S: Create PaymentIntent with registration metadata
    S-->>API: client_secret and intent ID
    API->>DB: Store transactionId and audit event
    API-->>SPA: client_secret
    SPA->>S: confirmPayment via Stripe.js

    alt Immediate success
        S-->>SPA: succeeded PaymentIntent
        SPA->>API: POST stripe/finalize-registration
        API->>S: Retrieve PaymentIntent
        API->>API: Validate status, amount, currency, registration metadata
        API->>DB: Mark SUCCESS and CONFIRMED
        API->>E: Send confirmation once
        API-->>SPA: Success response
    else Redirect or browser interruption
        S-->>SPA: Redirect result
        SPA->>API: Finalize from sessionStorage recovery data
    else Failure
        SPA->>API: report-payment-failure with intent and client secret
        API->>S: Retrieve and verify intent
        API->>DB: Mark FAILED and PAYMENT_FAILED
        API->>E: Failure email
    end

    S-->>API: Signed webhook succeeded or failed
    API->>DB: Idempotent state update
```

## 14. PayPal initial payment flow

```mermaid
sequenceDiagram
    participant U as Parent or guest
    participant SPA as PayPal SDK integration
    participant API as Express API
    participant DB as MongoDB
    participant P as PayPal
    participant E as Email service

    U->>SPA: Choose PayPal
    SPA->>API: POST register with PayPal and no capture ID
    API->>DB: Save AWAITING_PAYMENT registration
    API-->>SPA: registrationId
    SPA->>API: POST paypal/create-order with registrationId
    API->>DB: Load pending registration and stored total
    API->>P: Create order with custom_id and invoice_id
    P-->>API: PayPal order ID
    API->>DB: Store paypalOrderId
    API-->>SPA: orderID
    SPA->>P: User approves
    SPA->>API: POST paypal/capture-order
    API->>P: Capture order, then retrieve capture
    API->>API: Validate status, amount, currency, and registration binding
    API->>DB: Mark SUCCESS and CONFIRMED
    API->>E: Send confirmation once
    API-->>SPA: Success response

    alt Cancel or browser error
        SPA->>API: report-payment-failure
        API->>DB: Mark FAILED and PAYMENT_FAILED
        API->>E: Failure email
    end

    P-->>API: PayPal webhook
    API->>P: Verify webhook signature via PayPal API
    Note over API,P: Current code references undefined metadata and webhook verification fails
    API->>DB: Intended async success/failure reconciliation
```

## 15. Check payment flow

```mermaid
flowchart TB
    Submit[Customer submits check registration]
    Save[Save paymentStatus PENDING, status AWAITING_PAYMENT, check state SUBMITTED]
    CurrentEmail[Current code sends Registration Confirmed invoice email]
    AdminReview[Admin reviews check]
    Decision{Approve or reject?}
    Approve[Set payment SUCCESS, registration CONFIRMED, check APPROVED]
    Reject[Set payment FAILED, registration CANCELLED, check REJECTED]
    MissingEmail[No successful confirmation email is currently sent on approval]

    Submit --> Save --> CurrentEmail --> AdminReview --> Decision
    Decision -->|Approve| Approve --> MissingEmail
    Decision -->|Reject| Reject

    style CurrentEmail fill:#7f1d1d,color:#fff,stroke:#ef4444
    style MissingEmail fill:#78350f,color:#fff,stroke:#f59e0b
```

## 16. Parent payment retry flow

```mermaid
sequenceDiagram
    participant U as Registered parent
    participant SPA as Purchase history or email link
    participant Auth as Parent auth guard
    participant API as Retry endpoints
    participant DB as MongoDB
    participant G as Stripe or PayPal

    U->>SPA: Open /dashboard/purchases/:id/pay
    SPA->>Auth: Check parent session
    alt Signed out
        Auth-->>U: Redirect to /login with original path
        U->>Auth: Sign in
        Auth-->>SPA: Return to exact retry page
    end
    SPA->>API: GET purchase detail
    API->>DB: Find by registration ID and authenticated parent ID
    DB-->>SPA: Locked registration details
    U->>SPA: Finish payment
    SPA->>API: POST retry-payment/start
    API->>DB: Verify owner, method, unpaid status, and stored amount
    API->>G: Create/reuse gateway attempt
    API->>DB: Set PENDING and audit retry start
    SPA->>G: Approve/confirm payment
    SPA->>API: Capture/finalize retry
    API->>G: Verify gateway result
    API->>DB: Mark SUCCESS and CONFIRMED

    Note over SPA,API: Program, batch, students, and amount are not editable in this flow.
```

### Guest failure-email retry

```mermaid
flowchart LR
    Failed[Guest payment failure]
    Email[Failure email]
    CartLink[Return to Cart link]
    BrowserStore{Original browser localStorage still present?}
    Restored[Cart appears with saved items]
    Empty[Empty cart]

    Failed --> Email --> CartLink --> BrowserStore
    BrowserStore -->|Yes| Restored
    BrowserStore -->|No or different device/browser| Empty
```

## 17. Payment success and failure notifications

```mermaid
flowchart TB
    GatewayEvent[Gateway result]
    Success{Success?}
    ConfirmService[Stripe or PayPal confirmation service]
    FailureService[markPaymentFailed]

    GatewayEvent --> Success
    Success -->|Yes| ConfirmService
    Success -->|No| FailureService

    ConfirmService --> Claim[Atomically claim confirmation-email send]
    Claim --> CustomerSuccess[Customer confirmation email]
    CustomerSuccess --> AdminSuccess[Admin copy]
    AdminSuccess --> MarkSent[Set confirmationEmailSentAt]
    MarkSent -. stale claim can retry after 10 minutes .-> Claim

    FailureService --> Dedup[Deduplicate by gateway attempt key]
    Dedup --> FailedState[Set FAILED and PAYMENT_FAILED]
    FailedState --> CustomerFailure[Customer failure email]
    CustomerFailure --> AdminFailure[Admin copy]
    AdminFailure --> FailureSent[Set paymentFailureNotifiedAt]
    CustomerFailure -. delivery failure stored but no retry worker .-> FailureGap[Notification retry gap]

    style FailureGap fill:#78350f,color:#fff,stroke:#f59e0b
```

## 18. Coupon lifecycle — current behavior

```mermaid
flowchart TB
    Code[Coupon code]
    Load[Load active coupon]
    Rules[Check expiration, global limit, minimum, per-parent limit]
    Discount[Calculate percentage or fixed discount]
    PaymentType{Payment successful now or check submitted?}
    Increment[Atomic usedCount increment]
    IncrementResult{Increment succeeded?}
    SaveReg[Save registration]
    LaterSuccess[Stripe or PayPal later succeeds]
    ConfirmIncrement[Confirmation service claims and increments coupon]

    Code --> Load --> Rules --> Discount --> PaymentType
    PaymentType -->|PayPal or Stripe already successful, or check| Increment --> IncrementResult
    PaymentType -->|Pending online gateway| SaveReg --> LaterSuccess --> ConfirmIncrement
    IncrementResult -->|Yes| SaveReg
    IncrementResult -->|No| OmitCode[Omit couponCode but current discounted total remains]
    OmitCode --> SaveReg

    Increment -. happens before registration save .-> TxGap[No shared DB transaction]
    style OmitCode fill:#7f1d1d,color:#fff,stroke:#ef4444
    style TxGap fill:#7f1d1d,color:#fff,stroke:#ef4444
```

## 19. Admin registration editing and customer update email

```mermaid
sequenceDiagram
    participant S as Super admin
    participant API as Registration controller
    participant DB as MongoDB
    participant E as Email service
    participant P as Parent

    S->>API: PATCH registration edit
    API->>DB: Validate program, month, schedule, batch, and student fields
    API->>DB: Update snapshots and append ORDER_EDITED audit entry
    API-->>S: Saved; notificationPending true

    S->>API: POST send-update-email
    API->>DB: Load unsent ORDER_EDITED entries
    API->>E: Send aggregated change email
    E-->>P: Registration update details
    E-->>S: Admin copies through configured recipients
    API->>DB: Mark audit entries notified and append UPDATE_EMAIL_SENT
```

## 20. Refund flow

```mermaid
flowchart TB
    Request[Super admin refund request]
    Load[Load registration]
    Eligible{SUCCESS, not already refunded, gateway supported, transaction ID exists?}
    Gateway{Stripe or PayPal?}
    StripeRefund[Create Stripe refund]
    PayPalRefund[Refund PayPal capture]
    Persist[Set REFUNDED state, reference, amount, actor, audit log]
    Reject[Reject request]
    Race[Current code has no atomic REFUND_PROCESSING claim]

    Request --> Load --> Eligible
    Eligible -->|No| Reject
    Eligible -->|Yes| Gateway
    Gateway -->|Stripe| StripeRefund --> Persist
    Gateway -->|PayPal| PayPalRefund --> Persist
    Load -. concurrent requests can both pass eligibility .-> Race

    style Race fill:#78350f,color:#fff,stroke:#f59e0b
```

## 21. Parent, coach, and admin messaging

```mermaid
flowchart LR
    Parent[Authenticated parent]
    ParentCheck[Verify registration contains selected batch]
    Thread[(MessageThread scoped by parent and batch)]
    Admin[Authenticated admin]
    Coach[Authenticated coach]
    CoachCheck[Verify coach is assigned to thread batch]

    Parent --> ParentCheck --> Thread
    Admin --> Thread
    Coach --> CoachCheck --> Thread
    Thread --> Parent
    Thread --> Admin
    Thread --> Coach
```

## 22. Coach roster and attendance

```mermaid
flowchart TB
    Coach[Authenticated coach]
    Assignment{Real Batch or virtual Program schedule?}
    Real[Batch.coach equals coach ID]
    Virtual[Program.coachId equals coach ID]
    Registrations[Load registrations matching batch or program]
    StatusFilter[Current active statuses include PENDING and AWAITING_PAYMENT]
    Students[Authorized student roster]
    Scan[QR/manual attendance]
    Verify[Verify student belongs to coach batch/program]
    Attendance[(Attendance record by student, batch/program, date)]

    Coach --> Assignment
    Assignment --> Real --> Registrations
    Assignment --> Virtual --> Registrations
    Registrations --> StatusFilter --> Students --> Scan --> Verify --> Attendance

    style StatusFilter fill:#78350f,color:#fff,stroke:#f59e0b
```

## 23. Maintenance mode

```mermaid
sequenceDiagram
    participant S as Super admin
    participant AdminUI as /admin/site-settings
    participant API as Site settings API
    participant DB as SiteSetting
    participant Visitor as Public browser
    participant App as App.tsx

    S->>AdminUI: Edit title, message, contact, enabled flag
    AdminUI->>API: PUT /api/site-settings with admin bearer token
    API->>API: Require SUPER_ADMIN and validate fields
    API->>DB: Upsert public-site singleton
    API-->>AdminUI: Saved setting

    Visitor->>App: Load or navigate
    App->>API: GET /api/public/site-status with no-store
    API->>DB: Read public maintenance fields
    API-->>App: Current setting
    alt Enabled and route is not /login or /admin
        App-->>Visitor: MaintenancePage only
    else Disabled or bypass
        App-->>Visitor: Normal application routes
    else Status API fails
        App-->>Visitor: Current code fails open to normal application
    end
```

## 24. Reporting and invoice logic

```mermaid
flowchart TB
    Registration[(Registration)]
    ParentHistory[Parent purchase history]
    PaidCheck{paymentStatus equals SUCCESS?}
    Invoice[Download invoice PDF]

    Registration --> ParentHistory --> PaidCheck
    PaidCheck -->|Yes| Invoice
    PaidCheck -->|No| Hidden[Invoice action hidden]

    Registration --> AdminReports[Admin dashboard and revenue reports]
    AdminReports --> StatusRule[Current revenue filter uses status CONFIRMED or PAID]
    StatusRule --> Revenue[Revenue totals and charts]
    StatusRule -. may include unpaid status-only confirmations .-> ReportRisk[Known reporting risk]

    style ReportRisk fill:#78350f,color:#fff,stroke:#f59e0b
```

## 25. Upload/media flow

```mermaid
flowchart LR
    Admin[Admin or coach upload form]
    Multer[Multer disk storage]
    Filter[Extension and size filters]
    Folder[Local uploads subfolder]
    URL[Absolute public /uploads URL stored in MongoDB]
    Static[Express static serving]
    Browser[Public browser]

    Admin --> Multer --> Filter --> Folder --> URL
    URL --> Static --> Browser
    Filter -. no magic-byte/content scan .-> UploadRisk[Content validation gap]
    Folder -. local disk may be ephemeral .-> StorageRisk[Durability gap]

    style UploadRisk fill:#78350f,color:#fff,stroke:#f59e0b
    style StorageRisk fill:#78350f,color:#fff,stroke:#f59e0b
```

## 26. Chatbot flow

```mermaid
flowchart TB
    User[Guest or optional authenticated parent]
    Limits[Chatbot rate limits]
    Validation[Shape and size validation]
    Injection[Prompt-injection guard]
    Context[Load active programs, FAQs, locations]
    Prompt[Build grounded system prompt]
    Groq[Groq completion]
    Sanitize[Redact secrets, strip markup, rewrite false confirmations]
    Reply[Return assistant reply]

    User --> Limits --> Validation --> Injection --> Context --> Prompt --> Groq --> Sanitize --> Reply

    User --> Recommend[Deterministic program recommendation]
    User --> BMI[BMI calculation]
    BMI --> OwnStudent{Authenticated and owns student?}
    OwnStudent -->|Yes| Fitness[(Student fitnessLogs)]
```

## 27. Deployment/runtime view

```mermaid
flowchart TB
    Build[Frontend TypeScript and Vite build]
    StaticHost[SPA static hosting with redirect fallback]
    NodeHost[Node/Express host]
    Env[Environment variables]
    Mongo[(MongoDB)]
    Providers[Stripe, PayPal, Resend, Groq]
    UploadDisk[(Host filesystem uploads)]

    Build --> StaticHost
    StaticHost -->|VITE_API_BASE_URL| NodeHost
    Env --> StaticHost
    Env --> NodeHost
    NodeHost --> Mongo
    NodeHost --> Providers
    NodeHost --> UploadDisk

    Env --> Secrets[JWT, Mongo, gateway, email, AI secrets]
    Env --> PublicKeys[Stripe publishable key and PayPal client ID]
```

## 28. Current observability and audit trail

```mermaid
flowchart LR
    API[Backend actions]
    Console[Console logs]
    PaymentLog[Structured payment/security log helpers]
    RegAudit[(Registration paymentAuditLog)]
    EditAudit[(Registration editAuditLog)]
    EmailState[Email sent/error timestamps]
    WebhookEvents[(PaymentWebhookEvent dedup collection)]

    API --> Console
    API --> PaymentLog
    API --> RegAudit
    API --> EditAudit
    API --> EmailState
    API --> WebhookEvents

    Console -. no centralized log/metric/alert system found .-> OpsGap[Operational visibility gap]
    EmailState -. failure emails have no retry worker .-> OpsGap

    style OpsGap fill:#78350f,color:#fff,stroke:#f59e0b
```

## 29. Recommended target architecture for the payment core

This final diagram is intentionally labeled **target**, unlike the preceding current-state diagrams.

```mermaid
flowchart TB
    Commands[Checkout, retry, refund commands]
    OrderService[Registration and Order State Machine]
    Pricing[Authoritative Pricing Service]
    Capacity[Capacity Reservation Service]
    DBTx[MongoDB transaction]
    PaymentAttempt[(PaymentAttempt collection)]
    Gateway[Idempotent Stripe or PayPal adapter]
    Webhooks[Verified webhook inbox]
    Reconciler[Payment reconciliation worker]
    Outbox[(Notification outbox)]
    Worker[Email worker with retry/backoff]
    Audit[(Immutable audit events)]

    Commands --> OrderService
    OrderService --> Pricing
    OrderService --> Capacity
    OrderService --> DBTx
    DBTx --> PaymentAttempt
    DBTx --> Outbox
    DBTx --> Audit
    PaymentAttempt --> Gateway
    Gateway --> Webhooks
    Webhooks --> Reconciler
    Reconciler --> OrderService
    Outbox --> Worker
```

## 30. Diagram-to-code index

| Area | Primary files |
|---|---|
| App gate and maintenance | `app/src/App.tsx`, `app/src/pages/MaintenancePage.tsx`, `app/src/admin/pages/SiteSettings.jsx` |
| Frontend routes | `app/src/routes/AppRoutes.tsx` |
| Parent/admin/coach auth | `app/src/context/AuthContext.tsx`, `app/src/admin/context/AuthContext.jsx`, `app/src/coach/context/AuthContext.jsx` |
| Cart and registration state | `app/src/context/CartContext.tsx`, `app/src/context/RegistrationContext.tsx` |
| Checkout | `app/src/pages/registration/*`, `app/src/pages/cart/CartPage.tsx` |
| Stripe UI | `app/src/components/payments/StripePaymentBox.tsx` |
| Parent payment retry | `app/src/pages/dashboard/RetryPayment.tsx`, `app/src/services/parentDashboardService.ts` |
| Server middleware | `backend/src/server.js` |
| Main API routes | `backend/src/routes/index.js`, `backend/src/routes/public_registration.js` |
| Pricing | `backend/src/utils/pricing.js` |
| Gateway integrations | `backend/src/services/stripeService.js`, `backend/src/services/paypalService.js` |
| Gateway confirmation | `backend/src/services/stripeRegistrationService.js`, `backend/src/services/paypalRegistrationService.js` |
| Payment failures | `backend/src/services/paymentFailureService.js`, webhook controllers |
| Email | `backend/src/services/emailService.js` |
| Registration administration | `backend/src/controllers/registrationController.js` |
| Models | `backend/src/models/*` |
| Coach portal | `backend/src/controllers/coachPortalController.js` |
| Chatbot | `backend/src/routes/chatbot.js`, `backend/src/middleware/chatbotSecurity.js` |
| Audit/migrations | `backend/src/config/*` |

