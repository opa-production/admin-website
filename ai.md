# Admin assistant — frontend requirements

The endpoints in `adminai.md` are live, plus a streaming one that wasn't asked
for and is the one worth using. This is the other direction of that document:
what the dashboard (`admin-website`) needs to change now that the backend
exists.

**One thing is required and everything else is an improvement.** The required
change is at the top.

---

## 1. Required: drop the stub

`js/core/assistant.js` still has:

```js
const ASSISTANT_STUBBED = true;
```

While it's `true` no request goes out and every message gets the canned preview
reply, so the panel looks live and answers nothing.

Delete the flag and the `if (ASSISTANT_STUBBED)` branch inside
`sendAssistantMessage()` rather than flipping it to `false`. A dead
short-circuit that still compiles is exactly the shape of trap that cost a
debugging session on the OTP work — `OTP_STUBBED` sat at `true` past the
backend shipping and produced an error that looked like a backend fault.

While you're there, `setupAssistant()` reads the flag for the footnote text.
Keep the live string:

> The assistant can be wrong. Check anything important against the data.

With just that, the panel works: `api.assistantChat()` already sends the right
body and `POST /admin/assistant/chat` answers it in the shape the panel expects.

---

## 2. Recommended: switch to streaming

`POST /admin/assistant/chat` is buffered. A question that needs three lookups —
which is most of them — spends five to ten seconds silent, and the thinking
words carry that alone.

`POST /admin/assistant/stream` sends the same turn as Server-Sent Events, so the
reply appears as it is written and the panel can say *which* lookup is running.
Both endpoints run the same code path (the buffered one consumes the stream
internally), so they cannot disagree.

### Frames

| event    | data                                            | what to do                              |
| -------- | ----------------------------------------------- | --------------------------------------- |
| `meta`   | `{ conversation_id }`                           | store it; sent first, before any token  |
| `tool`   | `{ name }`                                      | show "Checking bookings…" (see §2.3)    |
| `token`  | `{ text }`                                      | append to the reply bubble              |
| `error`  | `{ detail, status }`                            | show `detail` verbatim as a failed message |
| `done`   | `{ conversation_id, out_of_scope: [] }`          | finish; see §2.4                        |

Comment frames (`: ping`) arrive every ~10s while the model is thinking. They
keep proxies from resetting an idle connection. Ignore them — the parser below
does.

### 2.1 Why not `EventSource`

`EventSource` cannot set an `Authorization` header, and these endpoints are
bearer-authenticated. Use `fetch` with a stream reader.

`apiRequest()` in `api.js` is also not usable as-is: it calls
`await response.json()`, which waits for the whole body. Add a separate helper
rather than complicating that one.

### 2.2 The helper

Add to `api.js`:

```js
// Streaming chat. Not routed through apiRequest(): that awaits response.json(),
// which defeats the point. Auth and the 401 handling are duplicated here on
// purpose — this is the only streaming endpoint in the dashboard.
async function assistantStream(body, handlers) {
  const token = getAuthToken();
  if (!token) throw new Error("Not authenticated");

  const response = await fetch(`${API_BASE_URL}/admin/assistant/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 401) {
    clearSessionStorage();
    setLogoutReason("Signed out: the server rejected this session.");
    window.location.href = "/";
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    // A failure before the stream starts is still plain JSON.
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "The assistant is unavailable right now.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Frames are separated by a blank line.
    const frames = buffer.split("\n\n");
    buffer = frames.pop();

    for (const frame of frames) {
      if (!frame.startsWith("event:")) continue; // a ": ping" comment
      const [head, ...rest] = frame.split("\n");
      const event = head.slice(6).trim();
      const dataLine = rest.find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      let payload;
      try {
        payload = JSON.parse(dataLine.slice(5).trim());
      } catch (e) {
        continue;
      }
      if (handlers[event]) handlers[event](payload);
    }
  }
}
```

Expose it on the `api` object alongside `assistantChat`.

### 2.3 Wiring it into the panel

`sendAssistantMessage()` becomes a subscriber rather than a single await. The
shape that fits the existing render loop:

- On `meta`: set `assistantConversationId`.
- On the first `token`: call `setAssistantBusy(false)` and push an empty `"ai"`
  message, then append each token to `assistantMessages[last].text` and
  re-render. The thinking words stop the moment real text arrives, which is the
  whole win.
- On `tool`: while still busy, replace the thinking word with a phrase for that
  lookup. A small map beats showing the raw tool name:

  ```js
  const ASSISTANT_TOOL_LABELS = {
    get_platform_overview: "Checking the numbers",
    get_today: "Checking today",
    find_bookings: "Searching bookings",
    get_booking: "Opening the booking",
    find_cars: "Searching listings",
    find_user: "Looking up the account",
    get_verification_queue: "Checking the queue",
    get_deposit_claims: "Checking deposit claims",
    get_revenue: "Reading the ledger",
    get_withdrawals: "Checking withdrawals",
    get_refunds: "Checking refunds",
    get_payment_health: "Checking payments",
    get_support_conversations: "Reading support",
    read_support_conversation: "Reading the thread",
    get_agent_conversations: "Checking AI conversations",
    read_agent_conversation: "Reading the thread",
    get_feedback: "Reading feedback",
    get_listing_reports: "Checking reports",
    get_b2b_overview: "Checking Ardena for Business",
    find_b2b_business: "Looking up the workspace",
    get_b2b_support: "Checking B2B support",
    get_admins: "Checking admin accounts",
    get_subscribers: "Checking subscribers",
  };
  ```

  Fall back to "Working" for an unknown name — the tool list will grow.

- On `error`: `setAssistantBusy(false)` and push `detail` as a failed message.
  These strings are written for an admin to read; show them verbatim.
- On `done`: `setAssistantBusy(false)`, and handle `out_of_scope` (below).

Keep the buffered path as a fallback if you want belt and braces, but it isn't
required — a stream that fails before the first frame throws from `fetch` and
lands in the existing `catch`.

### 2.4 `out_of_scope`

`done` carries the lookups the admin's **role** refused, e.g.
`{"out_of_scope": ["get_revenue"]}`. The assistant already explains this in its
reply, so this is belt-and-braces for the panel — the useful thing to do is
nothing loud. A small muted line under the bubble is plenty:

> Some of that is outside your role's access.

Do **not** treat it as an error, and do not hide the reply — the assistant still
answered the parts it could.

---

## 3. Role scoping: nothing to do

The assistant is scoped server-side to the signed-in admin's role, using the
same map as `isPageAllowedForRole()` in `js/core/app.js`. A customer-service
admin is not handed the revenue tools at all, and the underlying lookups refuse
the role a second time.

**Don't re-implement any of that in the panel.** No hiding the launcher per
role, no filtering suggestions per role, no client-side checks. A second copy of
the role map is a second thing to keep in sync, and the one that drifts is
always the one in the browser.

The empty-state suggestions in `ASSISTANT_SUGGESTIONS` are all operational
questions every role can ask, so they stay as they are.

---

## 4. Optional: conversation history

The thread now lives server-side, so a refresh no longer has to start over.
Three endpoints exist if you want the thread list in the panel header:

```
GET  /admin/assistant/conversations?limit=20
GET  /admin/assistant/conversation/{id}
POST /admin/assistant/conversation/{id}/close
```

`GET /conversations` returns:

```json
{
  "conversations": [
    {
      "id": 12,
      "status": "active",
      "opened_on_page": "bookings",
      "created_at": "...",
      "last_message_at": "...",
      "message_count": 6
    }
  ]
}
```

`GET /conversation/{id}` returns the same plus `messages`, each
`{ id, role, content, created_at }` with `role` being `user` or `assistant`.
Tool rows are kept server-side for audit and never returned — don't build the
UI expecting them.

Two behaviours to design around if you build this:

- Threads are **private to the admin who opened them**. Another admin's id
  returns 404, not 403. There is no shared team view, deliberately: what a
  thread contains depends on the asker's role, so a shared transcript would leak
  across the role boundary.
- A thread refuses to continue if the admin's **role changed** since it started
  — `409` with "Your role changed since this chat started. Start a new one."
  Handle it by clearing `assistantConversationId` and retrying once as a new
  thread, or just show the message.

Sending to a closed thread is also `409`.

---

## 5. Errors and limits

- Every failure has `{"detail": "..."}` and every `detail` is written to be
  shown to an admin as-is. Don't rewrite them.
- **Rate limit is 20 requests/minute per IP**, across both endpoints. Exceeding
  it returns `429`. The composer already disables while busy, which is most of
  the protection; nothing else is needed.
- Model offline (no key configured) returns `503` with "The assistant is offline
  right now — no model is configured. Everything in the dashboard still works."
  This is a degraded feature, not a broken dashboard, and the copy says so.
- A turn is cut off at 120s with `504`. In practice a lookup-heavy answer is
  under ten.

---

## 6. `page` is already right

`sendAssistantMessage()` already sends
`page: currentDashboardPage`. The backend uses it only to resolve an ambiguous
question ("these bookings", "this host") and ignores it when the question stands
on its own. Nothing to change — just don't drop it when rewriting the function
for streaming.

---

## Files to touch

| File                    | What                                                              |
| ----------------------- | ----------------------------------------------------------------- |
| `js/core/assistant.js`  | **Required:** delete `ASSISTANT_STUBBED` and its branch. Then: stream consumption, tool labels, `out_of_scope` line |
| `api.js`                | Add `assistantStream()` next to `assistantChat()`                  |
| `dashboard.css`         | Optional: a muted `.assistant-note` under a bubble for `out_of_scope`; a caret on the streaming bubble |
| `dashboard.html`        | Optional: thread list in the panel header, if §4 is built          |
