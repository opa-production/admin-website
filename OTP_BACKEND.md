# Admin OTP (two-step sign-in) — backend requirements

The admin dashboard now has a second sign-in step: after the password check
passes, a modal asks for a 6-digit one-time code. The UI is built and wired up;
the endpoints below do not exist yet.

**Right now the frontend is in design-preview mode.** `login.js` has a flag:

```js
const OTP_STUBBED = true;
```

While it's `true`, any 6 digits are accepted, no OTP request is made, and the
access token returned by the existing `/admin/auth/login` is used as-is. Flip it
to `false` once the endpoints below are live — the real request code is already
written and sits next to the stub.

---

## 1. `POST /admin/auth/login` — change to the existing endpoint

Today this returns the session immediately:

```json
{ "access_token": "...", "admin": { ... } }
```

It should instead **stop short of issuing a session** and start an OTP challenge:

```json
{
  "otp_required": true,
  "otp_token": "opaque, single-use, short-lived (5 min)",
  "otp_destinations": ["+254712345678", "ceo@ardena.co.ke"],
  "expires_in": 300
}
```

- `otp_token` identifies the pending challenge. It is **not** an access token
  and must grant no API access.
- `otp_destinations` is a list of everywhere the code was sent. The UI masks
  each entry client-side and renders them as "•••••••345 and ce•••@ardena.co.ke".
  Returning already-masked values is fine too — the UI masks either way.
- Failed password attempts keep their current behaviour (`4xx` + `detail`).

**Send the code on this call, to both channels at once.** The same code goes out
by SMS to the admin's `phone_number` *and* by email — the admin does not choose,
and there is no channel preference anywhere in the UI. When no `phone_number` is
on file, email alone is used.

## 2. `POST /admin/auth/verify-otp` — new

Request:

```json
{ "otp_token": "...", "code": "123456" }
```

Success `200` — this is where the session is finally issued, same shape the
login endpoint returns today:

```json
{ "access_token": "...", "admin": { ... } }
```

Failure `400`/`401` with `{"detail": "..."}`. The `detail` string is shown
verbatim under the digit boxes, so write it for an admin to read
("That code has expired — request a new one.").

Required behaviour:

- Codes are 6 digits, numeric.
- Expire after 5 minutes.
- Single use — burn the code and the `otp_token` on success.
- Rate-limit: max 5 attempts per `otp_token`, then invalidate it and make the
  admin sign in again. Lock/backoff per account on repeated failures.
- Store a hash of the code, not the code.
- Compare in constant time.

## 3. `POST /admin/auth/resend-otp` — new

Request: `{ "otp_token": "..." }`

Success `200`: `{ "otp_token": "...", "expires_in": 300 }` — returning a fresh
`otp_token` is optional; the UI swaps it in when present, otherwise it keeps the
old one.

The UI enforces a 30-second cooldown on the button. Enforce it server-side too
(and cap resends per challenge, e.g. 3).

## 4. Admin profile — one new field

The **My Profile** page now has a **Mobile Number** field. There is no channel
picker — codes always go to both SMS and email.

`GET /admin/me` should return:

| field          | type           | notes                       |
| -------------- | -------------- | --------------------------- |
| `phone_number` | string \| null | E.164, e.g. `+254712345678` |

`PUT /admin/profile` now receives that key alongside `full_name` and `email`:

```json
{
  "full_name": "...",
  "email": "...",
  "phone_number": "+254712345678"
}
```

Notes:

- The frontend normalises the number (strips spaces and dashes) and validates
  `^\+?\d{7,15}$` before sending. Validate server-side as well.
- `phone_number` may be `null` — the admin is then only emailed codes.
- **Until this ships**, the number is mirrored to `localStorage` so the form
  keeps its value between page loads. That mirror is a stopgap; once
  `/admin/me` returns the real value it takes precedence and the local copy can
  be dropped (`admin_phone:*` keys in `js/pages/profile.js`).
- Heads-up: the frontend already sends `phone_number` in the profile PUT today.
  If the current Pydantic model rejects unknown fields, the profile update will
  422 — please allow/ignore it.

### Changing a mobile number

Treat a new number as unverified: send a confirmation code to the new number and
require it before the number starts receiving sign-in codes. Otherwise an
attacker with a live session can add their own phone as a second factor.

---

## Delivery

SMS goes out over whatever gateway is already in use for customer messaging
(Africa's Talking / Twilio). Suggested copy, kept short for one segment:

> Your Ardena admin code is 123456. It expires in 5 minutes. Do not share it.

Email uses the existing transactional sender.

## Security checklist

- The OTP challenge must not extend the session — the access token is only
  minted in `verify-otp`.
- Never return the code itself in any response or log it.
- Log every OTP issue/verify/fail with admin id, IP and user agent for audit.
- Invalidate outstanding challenges when the password changes.

## Frontend touch points

| File                  | What changed                                                  |
| --------------------- | ------------------------------------------------------------- |
| `index.html`          | OTP modal markup (`#otpOverlay`)                               |
| `login.css`           | Modal, digit-box and resend styles                             |
| `login.js`            | Two-step flow, `OTP_STUBBED` flag, verify/resend requests      |
| `js/pages/profile.js` | Mobile number field, validation, local mirror                  |
| `dashboard.css`       | Two-column profile layout, form field styles, circular avatars |
