# UX backlog — admin dashboard

Written 2026-09-05, after adding hash routing, the OTP modal and circular
avatars. Everything below was checked against the current code, not guessed.
Ordered roughly by payoff per hour of work.

The dashboard is in better shape than a list like this makes it sound — native
`alert()`/`confirm()` are already routed through custom toasts and dialogs
(`js/core/ui.js`), searches are debounced, `.loading` blocks are auto-upgraded to
the animated loader, and skeletons exist for the heavier pages. These are the
gaps that remain.

---

## 1. Refresh keeps the page, but not the state within it — **high value**

Just fixed: the open page now lives in the URL hash (`#cars`), so a refresh or a
bookmark returns to it. What still resets on refresh:

- Search text and filter dropdowns (cars, bookings, admins, payment methods…)
- The current page number on every paginated list
- The active tab (referrals, notifications, moderation, B2B)
- Any open detail view — you land back on the list

Next step is to encode that in the hash too: `#bookings?status=pending&page=3`,
`#cars/1f2c-…` for a detail view. The routing seam for it is already in place —
`loadPage()` in `js/core/app.js` is the single entry point, so this is one
parse/serialise helper plus each page reading its own params.

The payoff is concrete: an admin working a verification queue currently loses
their place on every accidental refresh.

## 2. Profile photos are device-local — **high value, needs backend**

The My Profile uploader says so out loud: *"Saved on this device only."* The
image goes to `localStorage`, so it's invisible to other admins, gone on a
different browser, and capped by the storage quota.

Needs an avatar upload endpoint (`POST /admin/profile/avatar`, returning a URL
stored on the admin record) and `avatar_url` on `/admin/me`. Client-side
resizing already exists in `processAdminAvatarFile()` — it just needs to POST
instead of writing to storage.

## 3. Session expiry — **warning shipped, backend still open**

The abrupt redirect is gone: a modal now appears two minutes before expiry with
a countdown and a "Stay signed in" button (`js/core/session.js`).

What's left is the part only the backend can settle. "Stay signed in" currently
extends a `localStorage` timestamp, which is a UX fix rather than a security
one — the access token's real lifetime is unchanged. Options (refresh tokens,
server-side sliding expiry, or leaving it client-side) are written up with a
recommendation in `SESSION_BACKEND.md`. Also still wanted: `expires_in` from
login so the frontend stops hardcoding 30 minutes.

## 4. No password recovery on the login page — **medium**

`index.html` has no "Forgot password?" link, and there's no reset endpoint. Today
a locked-out admin needs another admin (or a DB edit). Worth pairing with the
OTP work in `OTP_BACKEND.md` since it reuses the same code-delivery plumbing.

## 5. Admin payload is logged to the console — **quick win**

`loadAdminInfo()` in `js/core/app.js` does `console.log("Admin data received:",
admin)` and friends — 10 `console.log` calls across the app, printing admin
records into the browser console on a production dashboard. Strip them, or gate
them behind a `DEBUG` flag.

## 6. No CSV export anywhere — **medium**

Zero occurrences of export/CSV in the codebase. Finance and ops will want
Revenue, Withdrawals, Refunds, Referral Earnings and Bookings as spreadsheets.
Client-side export of the current filtered list is a small job and covers most of
the need; server-side export matters only once lists outgrow a page.

## 7. No date-range filtering — **medium**

The API takes no `date_from` / `date_to` on any endpoint. Every money page
(Revenue, Withdrawals, Refunds, Bookings) is effectively "all time", so
month-on-month questions can't be answered in the dashboard at all. Needs
backend support first.

## 8. No global search — **medium**

Each list has its own search box, but there's no way to type a phone number,
plate or booking reference in one place and be taken to the record. It's the
single most-used affordance in a support-heavy admin tool. Needs a
`GET /admin/search?q=` that returns typed hits across hosts, clients, cars and
bookings.

## 9. Sidebar badges only cover two sections — **small**

`startNavBadgePolling()` surfaces unread support and cars awaiting verification.
Withdrawals awaiting approval, refunds pending and moderation reports are the
same shape of "work waiting on you" and would benefit from the same treatment.

## 10. Skeletons on some pages, a spinner on others — **small**

Eight pages use skeleton placeholders; 23 spots still render a plain
`Loading...` block. It works (the loader upgrade makes it look intentional), but
a skeleton that matches the incoming layout reads as faster and stops the page
jumping when content lands. Worth doing for the list pages, not for small inline
loads.

## 11. Accessibility — **small, ongoing**

- Sidebar items are `<a href="#">` with no `aria-current` on the active page.
- Modals set focus but don't trap it — Tab walks out into the page behind.
- No skip-to-content link.
- Colour is the only signal in a few status treatments; badges carry text, so
  this is mostly about the dot indicators.

## 12. Dark mode — **done**

Shipped. Every colour in `dashboard.css` and `login.css` now goes through a
semantic token, with the light palette on `:root` and a dark one on
`[data-theme="dark"]`. The theme is stamped on `<html>` by a blocking script in
the page head (no flash on load), defaults to the operating system's setting,
and is toggled from the profile menu.

Two follow-ups if anyone wants to push it further: chart grid and axis colours
are theme-aware but the series colours are fixed brand hues (fine, but they were
picked against white), and box-shadows are still light-theme values — on dark
surfaces the separation comes from borders instead.

---

## Also worth knowing

- **Feedback is hidden from the sidebar** as of this change (`hidden: true` on
  the `feedback` entry in `NAV_ITEMS`, `js/core/shell.js`). The page still works
  at `#feedback` — remove the flag to bring the link back.
- **Two-step sign-in is stubbed.** `OTP_STUBBED = true` in `login.js` accepts any
  6 digits so the modal design can be reviewed. See `OTP_BACKEND.md`.
- **The mobile number on My Profile is mirrored to `localStorage`** until the API
  persists `phone_number`. Same doc.
- **The AI assistant is stubbed.** `ASSISTANT_STUBBED = true` in
  `js/core/assistant.js` returns a canned reply so the panel can be reviewed.
  See `ASSISTANT_BACKEND.md`.
- **Production URLs drop the `.html`** (`cleanUrls` in `vercel.json`), so
  in-app redirects now point at `/` and `/dashboard`.
- **Every native `<select>` is upgraded at runtime** into the `.ui-select`
  widget (`js/core/ui.js`), the same way `alert()` and `.loading` are. The
  original `<select>` stays as the value holder, so `el.value` and `change`
  handlers are untouched. A page that replaces a select's options (the
  notification host picker) triggers a rebuild of the widget.
- **New Verifications page** (`#verifications`) — KPIs, KYC trend lines, the
  listing-decision split and the live awaiting-review queue.
