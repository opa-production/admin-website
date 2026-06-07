# Invite Admin (auto-generated password + emailed credentials) — UI Spec

Backend implementation guide for the **"Invite admin"** flow: a super_admin
enters a new admin's name, email and role; the server **auto-generates a
password**, stores only its hash, and **emails the credentials** to that address
from **`info@ardena.co.ke`**. The admin never types a password during creation.

The backend is **live**. Build the UI against this contract.

---

## Flow

```
Super admin → "Invite admin" form
   full name + email + role  (no password field)
        │  clicks "Send invite" / "Done"
        ▼
POST /api/v1/admin/admins/invite
        │  server: generate password → hash & store → email credentials
        ▼
201 → { ...admin, email_sent, message }
        │
        ▼  show toast from `message`; if email_sent === false, surface "Resend"
```

The new admin receives an email (from `info@ardena.co.ke`) with their email +
temporary password and a link to the dashboard, and is asked to change the
password after first sign-in.

---

## Auth

Both endpoints require a **super_admin** Bearer token (same scheme as the rest of
`/api/v1/admin/*`). Other roles get `403`. Only super_admin can create/invite
admins (Managers are view-only — see `admin-roles-frontend.md`).

---

## Endpoint 1 — Invite admin

```
POST /api/v1/admin/admins/invite
```

**Request body**

```json
{
  "full_name": "Jane Doe",
  "email": "jane@opa.com",
  "role": "manager",
  "is_active": true
}
```

| Field       | Type   | Required | Notes |
|-------------|--------|----------|-------|
| `full_name` | string | yes      | 1–255 chars. |
| `email`     | string | yes      | Valid email; the credentials are sent here. |
| `role`      | string | no       | `finance` \| `customer_service` \| `manager`. Default `customer_service`. **No password field — do not send one.** |
| `is_active` | bool   | no       | Default `true`. |

> There is **no** `password` / `password_confirmation` in this request — that's
> the whole point. The form should not show a password field.

**`201 Created`**

```json
{
  "id": 12,
  "full_name": "Jane Doe",
  "email": "jane@opa.com",
  "role": "manager",
  "is_active": true,
  "created_at": "2026-06-07T10:30:00Z",
  "updated_at": null,
  "email_sent": true,
  "message": "Admin created and credentials emailed."
}
```

- The **temporary password is never returned** — it only goes to the admin's
  inbox. Don't try to display it.
- `email_sent` — `true` if the credentials email was delivered. If `false`, the
  account still exists but the admin has no usable password yet; show the
  `message` and offer a **Resend credentials** action (endpoint 2).

**Errors**

| Status | When | Body |
|--------|------|------|
| `400 Bad Request` | email already belongs to an admin | `{ "detail": "Email already registered" }` |
| `403 Forbidden` | caller isn't super_admin | `{ "detail": "This operation requires super_admin privileges" }` |
| `422 Unprocessable Entity` | invalid email or role | FastAPI validation error |

---

## Endpoint 2 — Resend credentials

```
POST /api/v1/admin/admins/{admin_id}/resend-credentials
```

Regenerates a **new** temporary password (replacing the old one) and re-emails
it. Use when the invite email failed (`email_sent: false`) or the admin lost
their password. Same `AdminInviteResponse` shape as endpoint 1.

| Status | When | Body |
|--------|------|------|
| `200 OK` | password reset + emailed | `{ ...admin, "email_sent": true, "message": "New credentials emailed." }` |
| `404 Not Found` | admin doesn't exist | `{ "detail": "Admin not found" }` |
| `403 Forbidden` | target is a super_admin, or caller isn't super_admin | `{ "detail": "Cannot reset super_admin credentials via this endpoint" }` (or the super_admin-required message) |

> This **changes** the admin's password. Any password they already had stops
> working. Place it behind a confirm dialog ("Send a new password to
> jane@opa.com? Their current password will stop working.").

---

## What the new admin receives

An email **from `info@ardena.co.ke`**, subject *"Your Ardena admin account"*,
containing:
- their email and the temporary password,
- a button linking to the dashboard (`ADMIN_DASHBOARD_URL`, default
  `https://adminnn.ardena.xyz`),
- a prompt to change the password after first sign-in.

The admin then signs in normally (`POST /api/v1/admin/auth/login`) and should be
nudged to **Profile → Change password** (`PUT /api/v1/admin/change-password`).

---

## UI checklist

- [ ] "Invite admin" form: **full name + email + role only** (no password
      field). Role dropdown: Finance / Customer Care / Manager.
- [ ] Submit button → `POST /admin/admins/invite`. On success, toast the
      returned `message` and refresh the admins list.
- [ ] If `email_sent === false`, show a warning state with a **Resend
      credentials** button on that admin's row.
- [ ] Add a **Resend credentials** row action (behind a confirm dialog) →
      `POST /admin/admins/{id}/resend-credentials`.
- [ ] Only render invite / resend controls for **super_admin**.
- [ ] Never display or expect a password in any response.

---

## Backend notes (for reference)

| Concern | Detail |
|---------|--------|
| Endpoint | `POST /api/v1/admin/admins/invite`, `POST /api/v1/admin/admins/{id}/resend-credentials` (`app/admin/admins.py`) |
| Password generation | 14 chars, guaranteed mixed case + digit + symbol, ambiguous chars excluded (`generate_temp_password`) |
| Storage | Only the bcrypt/argon hash is stored; plaintext is emailed and discarded |
| Sender | `info@ardena.co.ke` (`ADMIN_FROM_EMAIL` in `app/services/email_welcome.py`) |
| Delivery | SMTP primary, Resend fallback (existing email stack) |
| Dashboard link | `settings.ADMIN_DASHBOARD_URL` (default `https://adminnn.ardena.xyz`) |
