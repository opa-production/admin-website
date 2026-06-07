# Email Service — Backend Spec

The admin dashboard has an **Email Service** page (the old "Subscribers" page,
repurposed). A super_admin/manager composes a Markdown email and sends it to
**all clients**, **all hosts**, or **both**. The dashboard sends the rendered
body + metadata; the **backend wraps it in the Ardena-branded template, injects a
per-recipient unsubscribe link, sets the From alias, and delivers**.

There are two endpoints — **send** (campaign) and **test** (one address). The
test flow is also documented in `test.md`.

---

## Auth

Admin Bearer token, restricted to **super_admin** and **manager** (others get
`403`). Same scheme as the rest of `/api/v1/admin/*`. The dashboard only shows
the Email Service page to those two roles.

---

## Endpoint 1 — Send campaign

```
POST /api/v1/admin/emails/send
```

### Request body

```json
{
  "audiences": ["clients", "hosts"],
  "from_alias": "ceo",
  "subject": "New cars added this week",
  "body_html": "<h3>Hi there!</h3><p>We just added new cars in <strong>Nairobi</strong>…</p>"
}
```

| Field        | Type     | Required | Notes |
|--------------|----------|----------|-------|
| `audiences`  | string[] | yes      | Non-empty. Items ∈ `clients`, `hosts`. `["clients","hosts"]` = both. |
| `from_alias` | string   | yes      | One of the allowed aliases (below). Server builds `<alias>@ardena.co.ke`. |
| `subject`    | string   | yes      | 1–200 chars. |
| `body_html`  | string   | yes      | The **inner** body only (already rendered from Markdown by the dashboard). Do **not** expect a full HTML document — wrap it (see template). Sanitize before embedding. |

> The dashboard renders the admin's Markdown to HTML and sends it as `body_html`.
> It does **not** send the header/footer wrapper — the backend owns that so the
> unsubscribe link can be personalised per recipient.

### From aliases

All map to the `ardena.co.ke` domain. Reject any value not in this set (`422`):

```
noreply  → noreply@ardena.co.ke
info     → info@ardena.co.ke
hello    → hello@ardena.co.ke
kelvin   → kelvin@ardena.co.ke
mokaya   → mokaya@ardena.co.ke
ceo      → ceo@ardena.co.ke
```

Use the existing email stack (SMTP primary, Resend fallback). Set a sensible
`Reply-To` (e.g. `info@ardena.co.ke`) for the `noreply` sender.

### Recipients & opt-out

- `clients` → every **active** client with an email.
- `hosts` → every **active** host with an email.
- If both audiences are selected and a person is somehow both, **de-duplicate by
  email** so they get one copy.
- **Skip anyone who has unsubscribed** from admin/marketing emails (see the
  unsubscribe flow). Transactional emails are unaffected — this opt-out applies
  only to these campaigns.

### Response — `202 Accepted` (queued) or `200 OK`

```json
{
  "message": "Email queued for 1,284 recipients.",
  "recipients": 1284,
  "skipped_unsubscribed": 37,
  "audiences": ["clients", "hosts"]
}
```

The dashboard shows `message` (falls back to a count from `recipients`). Sending
in the background and returning `202` immediately is recommended for large lists.

### Errors

| Status | When | Body |
|--------|------|------|
| `400 Bad Request` | empty `audiences`, empty subject/body | `{ "detail": "…" }` |
| `403 Forbidden` | caller's role isn't allowed | `{ "detail": "This operation requires super_admin or manager privileges" }` |
| `422 Unprocessable Entity` | invalid `from_alias` or audience value | FastAPI validation error |

---

## Endpoint 2 — Send test email

```
POST /api/v1/admin/emails/test
```

Sends **one** email to a single address using the **exact same branded template**
a real recipient gets, so the admin can preview the real thing before blasting
everyone. Subject is prefixed with `[TEST]`. No audiences, no opt-out checks.

### Request body

```json
{
  "test_email": "me@example.com",
  "from_alias": "ceo",
  "subject": "New cars added this week",
  "body_html": "<h3>Hi there!</h3><p>…</p>"
}
```

Identical to the campaign send **minus `audiences`, plus `test_email`** (the
single recipient). The dashboard reuses the current From-alias / subject / body.

### Response — `200 OK`

```json
{ "email_sent": true, "to": "me@example.com", "message": "Test email sent to me@example.com." }
```

The dashboard toasts `message`; if `email_sent === false` it's shown as an error.

| Status | When | Body |
|--------|------|------|
| `403 Forbidden` | role not allowed | `{ "detail": "This operation requires super_admin or manager privileges" }` |
| `422 Unprocessable Entity` | invalid `test_email`/`from_alias`, blank subject/body | FastAPI validation error |

---

## The branded template (backend must produce this)

Wrap `body_html` in this template. It's the **exact** markup the dashboard shows
in its live preview, so keep them in sync. Replace `{{unsubscribe_url}}` with a
**unique per-recipient** link, and host the logo at a public URL.

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{{subject}}</title></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e7ebf2;">
        <!-- Rectangular coloured header with the WHITE Ardena logo (~52px tall) -->
        <tr><td style="background:#0066cc;padding:24px 28px;text-align:center;">
          <img src="{{logo_url}}" alt="Ardena" height="52" style="height:52px;display:inline-block;border:0;">
        </td></tr>
        <!-- Body (the admin-authored content) -->
        <tr><td style="padding:30px 32px;font-size:15px;line-height:1.65;color:#1f2937;">
          {{body_html}}
        </td></tr>
        <!-- Unsubscribe footer -->
        <tr><td style="padding:0 32px 30px;">
          <div style="text-align:center;padding-top:22px;border-top:1px solid #eef2f7;">
            <a href="{{unsubscribe_url}}" style="display:inline-block;padding:10px 20px;border-radius:8px;background:#f1f5f9;color:#475569;text-decoration:none;font-size:13px;font-weight:600;">Unsubscribe</a>
            <p style="margin:14px 0 0;font-size:12px;color:#9ca3af;line-height:1.5;">You received this because you have an Ardena account.<br>&copy; Ardena · Nairobi, Kenya</p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>
```

- **Header**: solid `#0066cc` rectangle, centered Ardena logo. **Use a WHITE
  version of the logo** for `{{logo_url}}` (the colored logo is invisible on the
  blue header). The dashboard's live preview fakes this with a CSS
  `filter:brightness(0) invert(1)` on the colored `logo.png`, but **email clients
  strip CSS filters**, so the backend must point `{{logo_url}}` at a genuinely
  white/transparent PNG hosted at a stable public URL.
- **`{{body_html}}`**: the sanitized `body_html` from the request.
- **`{{unsubscribe_url}}`**: per-recipient (see below). For the **test** email any
  working unsubscribe link is fine.
- Keep all CSS inline + table-based for email-client compatibility.

---

## Unsubscribe flow

Each campaign email needs a **unique, tokenised** unsubscribe URL so one click
opts that person out without auth. Suggested:

```
GET /api/v1/email/unsubscribe?token=<signed-token>
```

- The token encodes the user type (`client` / `host`) + id (e.g. a signed JWT or
  HMAC), so no login is needed.
- Visiting it sets that user's `email_opt_out = true` (or equivalent) and shows a
  simple "You've been unsubscribed" confirmation page. Optionally offer re-subscribe.
- The bulk-send must **honour `email_opt_out`** and skip those recipients
  (reported as `skipped_unsubscribed`).

A persisted opt-out flag on the client/host record is the simplest store. (The
older `/admin/subscribers` newsletter list is separate and can be retired — the
dashboard no longer uses it.)

---

## In-app notifications are separate

The dashboard's **Notifications** page now sends **in-app only** (no email):
`broadcast-hosts`, `broadcast-clients`, and `notifications/send`. Don't route
those through email. This Email Service page is the **only** place that sends
bulk email.

---

## Summary checklist (backend)

- [ ] `POST /admin/emails/send` → `{ audiences, from_alias, subject, body_html }`; restrict to super_admin + manager.
- [ ] `POST /admin/emails/test` → `{ test_email, from_alias, subject, body_html }`; `[TEST]` subject prefix.
- [ ] Validate `from_alias` against the 6 aliases; build `<alias>@ardena.co.ke`.
- [ ] Resolve recipients (active clients and/or hosts), de-dupe by email, skip opt-outs.
- [ ] Wrap `body_html` in the branded template above using a **white** logo; personalise `{{unsubscribe_url}}`.
- [ ] Send via the existing email stack; return `{ message, recipients, skipped_unsubscribed }`.
- [ ] Implement the tokenised `GET /email/unsubscribe` endpoint + opt-out flag.
