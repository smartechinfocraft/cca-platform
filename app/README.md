# CCA Platform App

## Developer Handoff - July 16, 2026

This section summarizes today's checkout, session, and asset-handling changes for junior developers joining the work.

### 1. Dashboard Refresh Auth Fix

- Fixed the `/dashboard` refresh/F5 issue where users appeared to be logged out.
- `ProtectedRoute` now waits for auth loading to finish before redirecting.
- The redirect preserves the current path and query string so users can return to the same page after login.
- Main file: `src/routes/AppRoutes.tsx`.

### 2. Sponsor Logo Persistence Fix

- Sponsor logos now prefer persisted uploaded paths when available.
- Backend upload serving now supports a configurable upload directory for Render or other deployed environments.
- New/updated files:
  - `src/components/Sponsors.tsx`
  - `backend/src/middleware/upload.js`
  - `backend/src/server.js`
  - `backend/.env.example`

### 3. Guest Registration / Checkout Flow

Users can now browse programs, enter student details, review the order, and pay without being forced to log in first.

Important flow:

1. Program browsing and quick registration collect program, batch, and student details.
2. `/review-order` collects parent/guardian details, coupon, and optional account creation.
3. `/cart` is now payment-focused: quick order summary, guest/account notice, waiver consent, and PayPal/Stripe/Check payment.
4. Backend `/api/public/register` creates or reuses a parent record and stores the registration.

Main frontend files:

- `src/components/ProgramCard.tsx`
- `src/pages/ProgramDetails.tsx`
- `src/pages/registration/ReviewOrder.tsx`
- `src/pages/cart/CartPage.tsx`
- `src/context/RegistrationContext.tsx`
- `src/context/AuthContext.tsx`
- `src/routes/AppRoutes.tsx`

Main backend files:

- `backend/src/routes/public_registration.js`
- `backend/src/models/Parent.js`
- `backend/src/models/index.js`
- `backend/src/utils/parentAccount.js`

### 4. Account Creation During Checkout

Guests are encouraged to create a parent portal account without leaving checkout.

- On `/review-order`, guests can choose to create an account by entering password fields.
- On `/cart`, guests see another lightweight prompt before waiver/payment.
- If the guest enters a valid password, payment completion also activates the parent account.
- Passwords are kept in React memory only and are not written to sessionStorage.
- Existing logged-in parents are treated as registered checkouts.

### 5. Cart Page UX Update

The `/cart` page no longer repeats parent details or coupon entry.

Current `/cart` priority:

1. Guest/registered checkout notice.
2. Optional account creation prompt for guest users.
3. Waiver consent.
4. Payment options.
5. Right sidebar `Order Summary`.

The sidebar `Order Summary` now includes:

- Program title.
- Batch, month, and schedule.
- Parent/guardian name, email, and phone.
- Student list.
- Item total and grand total.

### 6. Guest vs Registered Reporting

Registrations now track checkout type for reporting.

- `registrationMode` is saved on each registration as `GUEST` or `REGISTERED`.
- `orderItems[].registrationMode` is also stored so reports can filter by individual program/order line.
- Backend derives the mode from authenticated parent session or account password creation.
- Helper and tests live in `backend/src/utils/parentAccount.js` and `backend/test/parentAccount.test.js`.

### 7. Validation Performed

Commands run successfully:

```bash
cd app
npm run build

cd ../backend
npm test
node --check src/routes/public_registration.js
node --check src/models/index.js
node --check src/utils/parentAccount.js
```

Known existing warnings:

- CSS `@import` order warning during Vite build.
- jsPDF dynamic import warning.
- Large Vite chunk size warning.
- App lint still has broad existing strict-rule debt unrelated to this work.

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
