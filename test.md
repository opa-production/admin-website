# Email Service — "Send test email" UI addition

The **Email Service** page already lets an admin pick an audience (**Clients**,
**Hosts**, or **Both**) and send a campaign. This adds a **"Send test email"**
option so the admin can enter **one** address and preview exactly how the email
lands — before sending to everyone.

Both backend endpoints are **live**.

---

## Auth

Admin Bearer token, restricted to **super_admin** and **manager** (others get
`403`). Same scheme as the rest of `/api/v1/admin/*`.

---

## The test endpoint

```
POST /api/v1/admin/emails/test
```

Sends a single email to one address using the **exact same branded template** a
real recipient gets. The subject is prefixed with `[TEST]`. No audience, no
opt-out checks — it just delivers one message.

### Request body

```json
{
  "test_email": "me@example.com",
  "from_alias": "ceo",
  "subject": "New cars added this week",
  "body_html": "<h3>Hi there!</h3><p>We just added new cars in <strong>Nairobi</strong>…</p>"
}
```

| Field        | Type   | Required | Notes |
|--------------|--------|----------|-------|
| `test_email` | string | yes      | The single address to send the preview to. |
| `from_alias` | string | yes      | `noreply` \| `info` \| `hello` \| `kelvin` \| `mokaya` \| `ceo`. |
| `subject`    | string | yes      | 1–200 chars. Same value you'd use for the real send. |
| `body_html`  | string | yes      | The inner body HTML (already rendered from the admin's Markdown) — **the same payload you send to `/admin/emails/send`**. |

> Reuse the page's current From-alias / subject / Markdown fields. The test
> request is identical to the real send request **minus `audiences`, plus
> `test_email`**.

### Response — `200 OK`

```json
{
  "email_sent": true,
  "to": "me@example.com",
  "message": "Test email sent to me@example.com."
}
```

Show `message` in a toast. If `email_sent` is `false`, show it as an error
("Test email failed to send. Check email configuration.").

### Errors

| Status | When | Body |
|--------|------|------|
| `403 Forbidden` | role not allowed | `{ "detail": "This operation requires super_admin or manager privileges" }` |
| `422 Unprocessable Entity` | invalid `test_email` or `from_alias`, blank subject/body | FastAPI validation error |

---

## UI: how to add it

On the Email Service page, alongside the audience selector and **Send** button:

```
Audience:  ( ) Clients   ( ) Hosts   ( ) Both

[ Send test email ▾ ]     [ Send campaign ]
```

1. Add a **"Send test email"** control — a small input for one email + a "Send
   test" button (a popover/inline row works well).
2. On click, POST the **current** `from_alias`, `subject` and `body_html` plus
   the entered `test_email` to `/api/v1/admin/emails/test`.
3. Toast the returned `message`. Keep the composer state intact so they can
   tweak and re-test or proceed to the real send.
4. Disable the button while a test is in flight; require a non-empty, valid
   email and a non-empty subject/body first.

```js
async function sendTest(testEmail, draft) {
  const res = await api.post("/admin/emails/test", {
    test_email: testEmail,
    from_alias: draft.fromAlias,   // same as the campaign composer
    subject:    draft.subject,
    body_html:  draft.bodyHtml,    // same rendered HTML you'd send for real
  });
  toast(res.message, res.email_sent ? "success" : "error");
}
```

> The preview the page already renders should match what arrives — the backend
> wraps `body_html` in the branded header/footer template. The test email's
> subject is `"[TEST] <your subject>"` and it includes a working Unsubscribe
> button (harmless to click).

---

## For reference — the real send endpoint (already specced in `email.md`)

```
POST /api/v1/admin/emails/send
```

Body: `{ audiences: ["clients","hosts"], from_alias, subject, body_html }`.
Returns `202` with `{ message, recipients, skipped_unsubscribed, audiences }`.
Restricted to super_admin + manager. Send the **same** `from_alias` / `subject`
/ `body_html` as the test; only swap `test_email` for `audiences`.

---

## Checklist

- [ ] Add a single-email input + "Send test email" button to the Email Service page.
- [ ] POST current `from_alias` + `subject` + `body_html` + `test_email` to `/admin/emails/test`.
- [ ] Toast the `message`; treat `email_sent === false` as an error.
- [ ] Validate email + non-empty subject/body before enabling the button.
- [ ] Only show test/send controls to super_admin and manager.
