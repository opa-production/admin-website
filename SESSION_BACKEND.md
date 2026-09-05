# Session handling — what the frontend does now, and what it needs

Sessions used to end without warning: 30 minutes after sign-in a timer fired, a
message appeared and the page redirected, taking any half-typed form with it.

**What's now in place (frontend only):** a warning modal two minutes before
expiry, with a live countdown and two choices — *Stay signed in* or *Sign out
now*. It's in `js/core/session.js`.

**What still needs deciding on the backend.** The rest of this doc is the open
question, not a spec — the modal was built first so we have something concrete to
design against.

---

## The honest state of "Stay signed in"

Today the button:

1. calls `GET /admin/me` to check the token still works, then
2. pushes the **local** `admin_session_expiry` stamp 30 minutes into the future.

That is a UX fix, not a security one. The expiry stamp lives in `localStorage`
(`api.js`), so today it is entirely client-side — the access token's real
lifetime is whatever the backend put in it, and the frontend has no way to
extend it. The moment the API starts rejecting expired tokens, "Stay signed in"
will appear to work and the next request will 401.

So this needs a real answer before it's trustworthy.

## Options

**A. Refresh tokens (recommended).** Login returns a short-lived access token
(15–30 min) plus a longer-lived refresh token. `POST /admin/auth/refresh`
exchanges the refresh token for a new access token. "Stay signed in" calls it;
`renewSession()` in `js/core/session.js` is the single place to change.

- Pro: the standard answer, and the only one where the 30 minutes is genuinely
  enforced.
- Con: refresh tokens need storage and revocation thinking of their own — ideally
  an httpOnly cookie rather than `localStorage`.

**B. Sliding expiry server-side.** Every authenticated request extends the
session; the token carries an absolute maximum (say 12 hours). "Stay signed in"
becomes any request at all, and the warning modal fires off an idle timer.

- Pro: simplest to implement, no new token type.
- Con: needs server-side session state, so it's a real change if auth is
  currently stateless JWTs.

**C. Leave it client-side.** What we have now.

- Pro: nothing to build.
- Con: the 30-minute policy isn't actually enforced — it's a suggestion the
  browser is free to ignore. Only acceptable if the tokens themselves are
  short-lived and the policy is really about unattended screens.

**A** is the recommendation. If sign-out on other devices, or revoking a
compromised session, ever matters, we need refresh tokens anyway.

## Whichever way it goes

- The frontend needs to know how long a session has left. Returning
  `expires_in` (seconds) from login and from any refresh endpoint would replace
  the hardcoded `SESSION_TIMEOUT_MS = 30 * 60 * 1000` in `api.js` — right now
  the frontend is guessing.
- Invalidate sessions on password change and on OTP challenge failure (see
  `OTP_BACKEND.md`).
- A 401 from any endpoint already clears storage and redirects to `/`. That stays
  correct under every option above.

## Frontend touch points

| File                 | What                                                   |
| -------------------- | ------------------------------------------------------ |
| `dashboard.html`     | Warning modal markup (`#sessionWarningOverlay`)         |
| `dashboard.css`      | Modal styling                                          |
| `js/core/session.js` | Timers, countdown, `renewSession()` — the seam to change |
| `api.js`             | `SESSION_TIMEOUT_MS`, expiry helpers, 401 handling      |
