# California Cricket Academy — How to Run

This project was restructured from 3 separate apps (admin / coach / public site)
into **1 unified app** with one shared login, plus the backend. So now you only
run **2 things**, not 4:

```
CCA/
├── backend/     ← Node/Express API (MongoDB)
└── app/         ← The ENTIRE frontend — public site + parent dashboard +
                    admin portal + coach portal, all in one React app
```

You open **one homepage**, and parents, coaches, and admins all log in from the
same page — the form figures out which kind of account it is automatically.

---

## 1. One-time setup

### Backend

```bash
cd CCA/backend
npm install
cp .env.example .env
```

Open `backend/.env` and fill in your real values:

| Variable | Where to get it |
|---|---|
| `MONGODB_URI` | MongoDB Atlas → Connect → Drivers → copy connection string |
| `JWT_SECRET` | Any long random string — run `openssl rand -hex 32` |
| `SUPER_ADMIN_USERNAME` / `PASSWORD` / `EMAIL` | Pick your own — created automatically on first boot |
| `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET` | [developer.paypal.com](https://developer.paypal.com/dashboard/applications) — use **Sandbox** credentials while testing |
| `PAYPAL_MODE` | `sandbox` while testing, `live` only when you're ready to take real payments |
| `SMTP_USER` / `SMTP_PASSWORD` | Your email + an **App Password** (not your normal password) — [how to get a Gmail App Password](https://support.google.com/accounts/answer/185833) |

### Frontend (the app)

```bash
cd CCA/app
npm install
cp .env.example .env
```

Open `app/.env` and set:
- `VITE_API_BASE_URL` → `http://localhost:5001/api` (matches backend's `PORT`)
- `VITE_PAYPAL_CLIENT_ID` → the **same** PayPal Client ID you put in the backend (this one is safe to be public — it's the secret that must stay backend-only)

---

## 2. Running it (every time)

You need **two terminal windows** — one for the API, one for the app. (This is
normal for any web app — the database/API server and the website are always
two separate processes, even though you now only have one frontend app instead
of three.)

**Terminal 1 — backend:**
```bash
cd CCA/backend
npm run dev
```
Wait for `✅ MongoDB connected` and `🚀 Server running on port 5001`.

**Terminal 2 — the app:**
```bash
cd CCA/app
npm run dev
```
It'll print a local URL, usually `http://localhost:5173`. Open that in your browser.

That's it — **one URL** for everything. Parents register and log in right there.
Coaches and admins click "Coach or Admin? Sign in here" on the same login screen.

---

## 3. What changed from the original project

### This session

✅ **New design system + animated UI** (homepage, login, parent dashboard).
A custom "cricket pitch" palette (deep green, aged gold, warm cream) replaces
the old navy/orange theme, with real motion via Framer Motion. Caught and
fixed 4 accessibility contrast bugs along the way — white text on gold
buttons failed WCAG contrast checks; now uses dark text instead.

✅ **About, Media, and FAQ are now real separate pages** (`/about`, `/media`,
`/faq`), linked in the navbar — not buried in homepage scroll sections.
Content is paraphrased from publicly available facts about the academy in
our own words. Also fixed a pre-existing bug where the homepage media
gallery never actually displayed real uploaded photos — the field names it
was reading didn't match what the backend actually returns.

✅ **Redesigned invoice PDF.** Now itemizes one line per student instead of
a single combined total, with a proper letterhead, payment-status badge,
and full payment method details.

✅ **Shorter registration flow.** Billing details used to be its own full
page step; it's now an inline editable section on the Review page instead —
the flow is 5 steps instead of 6.

✅ **Super admin can edit a registration's batch + student details**
(Admin → Registrations → click a row → super admins see a "Reassign Batch"
section). Saving a change automatically emails the parent showing exactly
what changed (old value → new value), not just "something was updated."

✅ **Messaging.** Parents can message CCA about a specific batch they're
enrolled in (Dashboard → Messages). Admins see every thread
(Admin → Messages); coaches only see threads for batches they're actually
assigned to (Coach app → Messages tab). Both can reply, and admins can mark
a thread Resolved/Reopened.

🔒 **Fixed a hardcoded-password bug.** The database seed script
(`backend/src/config/seed.js`) used to have real admin passwords typed
directly into the source code — anyone with the codebase had the login. It
now reads credentials from your `.env` file, and generates a random
password (printed once, to your terminal) for anything you don't set
yourself. Re-run `node src/config/seed.js` from inside `backend/` if you
want to regenerate admin accounts with this safer behavior.

### Previous session

✅ **PayPal & payment security.** Previously the website trusted whatever
price the browser sent it, which meant anyone could tamper with the page and
pay $1 for any program (or claim they paid without paying at all). Now the
server always looks up the real price itself and verifies the actual PayPal
transaction before confirming a registration. **PayPal will work correctly
once you put your real Sandbox/Live credentials in both `.env` files
above** — it was not functional with placeholder credentials, that's
expected and not a bug.

✅ **One login, one app.** The 3 separate apps (admin frontend, coach app,
public site) are now 1 app with 1 login page that handles all 3 roles.

✅ **Admin delete buttons.** Every entity (programs, batches, categories,
locations, coaches, age groups, levels, coupons) now has a working delete
button, with safety checks so deleting something still in use gives a clear
error instead of silently breaking other records. Programs and batches also
have a true **permanent delete** option for items created by mistake and
never actually used.

✅ **QR ID cards + real-time attendance.** The ID card has no photo (the
academy doesn't collect/print photos) and instead has a real, scannable QR
code. Coaches scan it in the Coach Portal and attendance is marked
**instantly**, calculated correctly in **California time** regardless of
server timezone.

✅ **Removed the program image upload requirement** from the admin Programs
form.

---

## 4. Everything from the original wishlist is now built

Both rounds of requested features are complete: payment security, the
single-login app merge, admin delete buttons, QR ID cards + real-time
attendance, the new UI, About/Media/FAQ pages, the invoice redesign, the
shorter registration flow, super-admin registration editing with
auto-email, and parent/admin/coach messaging.

If you find something that doesn't work as expected, or want further
polish on any of the above (e.g. extending the new UI to more pages), just
ask for that specifically next.

---

## 5. Security note

🔒 **Never commit your real `.env` files to git.** Both folders have a
`.gitignore` that already excludes `.env` — only `.env.example` (with fake
placeholder values) should ever be committed or shared.

If you ever *did* commit real credentials to a git repo in the past (the
original project had live secrets in a README), treat all of them as
compromised and rotate them now: get a new MongoDB password, a new PayPal
secret, and a new Gmail App Password. A leaked secret needs to be replaced,
not just deleted.
