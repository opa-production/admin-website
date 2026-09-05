# AI assistant — backend requirements

The dashboard now has an assistant: a floating launcher in the bottom-right on
every page, opening a panel on the right where an admin can chat. The UI is
built; the endpoint is not.

**The frontend is in design-preview mode.** `js/core/assistant.js` has a flag:

```js
const ASSISTANT_STUBBED = true;
```

While it's `true` no request goes out and every message gets the same canned
reply, so the panel can be reviewed. Flip it to `false` once the endpoint below
is live — `api.assistantChat()` is already defined in `api.js` and the panel
already calls it.

---

## `POST /admin/assistant/chat`

Request:

```json
{
  "message": "How many bookings were confirmed this week?",
  "conversation_id": "abc123 or null on the first message",
  "page": "bookings"
}
```

- `conversation_id` is `null` on the first message of a thread. Whatever comes
  back is sent on every subsequent message, so the backend holds the history —
  the frontend does not replay it.
- `page` is the dashboard page the admin was on when they asked (`bookings`,
  `b2b-fleet`, `my-profile`, …), so the assistant can resolve "these bookings"
  or "this host" without being told. Ignore it if it isn't useful.

Response `200`:

```json
{
  "reply": "42 bookings were confirmed between Monday and today.",
  "conversation_id": "abc123"
}
```

Errors: `4xx`/`5xx` with `{"detail": "..."}`. The `detail` string is shown to the
admin in the panel as a failed message, so write it for a person to read.

### Notes

- **Scope it to the admin's own permissions.** The assistant runs as the signed-in
  admin: a finance admin asking about support conversations should get the same
  "no access" it would get from the UI. Reuse the role rules in
  `isPageAllowedForRole()` (`js/core/app.js`) rather than inventing a second set.
- **Read-only to start.** Answering questions about data is the whole ask here.
  Anything that mutates (refunding, approving a car, messaging a host) should be
  a separate, explicitly-designed capability with a confirmation step in the UI —
  not something the model can trigger from a chat turn.
- Streaming isn't required. If you want it later, server-sent events would slot
  into `sendAssistantMessage()` without touching the rest of the panel.
- Rate-limit per admin. A chat box invites accidental loops.
- The panel currently keeps the thread in memory only, so a refresh starts a new
  conversation. If you want history to persist, add
  `GET /admin/assistant/conversations` and we'll wire a thread list into the
  panel header.

### What the assistant should be able to answer

The suggestions in the empty state set expectations, so these should work on day
one:

- "How many bookings were confirmed this week?"
- "Which cars are still awaiting verification?"
- "Summarise the open support conversations"

They're all questions the dashboard can already answer by clicking around — the
assistant is a faster path to the same data, not a new source of truth.

## Frontend touch points

| File                    | What                                              |
| ----------------------- | ------------------------------------------------- |
| `dashboard.html`        | Launcher + panel markup (`#assistantFab`, `#assistantPanel`) |
| `dashboard.css`         | Panel, bubbles, typing indicator, composer         |
| `js/core/assistant.js`  | Open/close, message list, send, `ASSISTANT_STUBBED` |
| `api.js`                | `assistantChat()`                                  |
