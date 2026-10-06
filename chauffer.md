# Ardena Chauffeurs: admin UI spec

The admin website needs five Chauffeurs pages: **Applications**, **Drivers**, **Hires**,
**Withdrawals** and **Refunds**. Without the Applications page nobody can be approved to
drive, so build it first.

- **Backend:** opabackend, branch `chauffers` (code in `app/admin/chauffeurs.py`).
- **Base URL:** `https://api.ardena.xyz/api/v1`. Every call uses the existing admin token
  (`Authorization: Bearer <admin token>`).
- **Errors:** `{ "detail": "…" }`, written as a sentence an admin can read. Show it as it is
  (toast or inline under the form).
- **Times:** ISO 8601 in Nairobi time (`2026-10-12T08:00:00+03:00`).
- **Money:** whole Kenyan shillings, as integers. Show as `KSh 7,500`.

For how the product works (hires, payments, refunds), see `drivers.md` and
`CHAUFFEURS_HANDOFF.md`.

---

## 1. Who sees what

| Page | What admins do there | Roles |
|---|---|---|
| Applications | Review applications to drive, approve, or send back with fixes | super_admin, general_admin, manager, customer_service |
| Drivers | List approved drivers, suspend or reinstate | super_admin, general_admin, manager, customer_service |
| Hires | List hires, find stuck trips, cancel a hire | all five roles |
| Withdrawals | Send drivers their money by M-Pesa, mark paid or failed | super_admin, general_admin, finance |
| Refunds | Pay renters back, mark done | super_admin, general_admin, finance |

A role outside the list gets `403` ("Your admin role can't do this."). **Hide the nav entry
for those roles** rather than showing the error. Add the five pages to the role gating in
`js/core/app.js` (`configureNavigationForRole`, `isPageAllowedForRole`).

---

## 2. Navigation and badges

One sidebar group, **Chauffeurs**, with the five pages. Show counts as badges from:

### `GET /admin/chauffeur-summary`

```json
{
  "applications_pending": 3,
  "payouts_processing": 2,
  "refunds_pending": 1,
  "stuck_trips": 0
}
```

| Badge on | Field | Meaning |
|---|---|---|
| Applications | `applications_pending` | Waiting for review |
| Withdrawals | `payouts_processing` | Drivers waiting for their money |
| Refunds | `refunds_pending` | Renters waiting for their money |
| Hires | `stuck_trips` | Trips nobody closed, 6+ hours past their end (red badge) |

Any of the roles above can call it. Load it when the dashboard opens and after every
action on these pages.

---

## 3. Applications

### List: `GET /admin/chauffeur-applications?status=&skip=&limit=`

- `status`: `pending` | `approved` | `rejected` | empty for all. **Default the page's
  filter to `pending`.**
- `skip` (default 0), `limit` (default 50, max 200). Newest submission first.

```json
[
  {
    "id": 12,
    "client_id": 345,
    "client_email": "sophie@example.com",
    "name": "Sophie Lang",
    "base_town": "Nairobi",
    "status": "pending",
    "submitted_at": "2026-10-07T09:12:00+03:00",
    "reviewed_at": null
  }
]
```

Table columns: Name, Email, Base town, Submitted, Status (badge), and a **Review** button.

### Detail: `GET /admin/chauffeur-applications/:id`

Open as a modal or a detail view. Response:

```json
{
  "id": 12,
  "client_id": 345,
  "client_email": "sophie@example.com",
  "client_name": "Sophie Lang",
  "first_name": "Sophie", "last_name": "Lang", "phone": "+254722000333",
  "years_experience": 5,
  "languages": ["English", "Swahili"],
  "bio": "Five years on the Nairobi–Nakuru road.",
  "licence_number": "DL1234567",
  "base_town": "Nairobi", "areas_served": ["Nairobi", "Thika"], "nationwide": false,
  "car_types": ["Saloon", "SUV"], "transmissions": ["Automatic"],
  "vehicle_types": ["Saloon", "SUV", "Automatic"],
  "service_type": "driver_only",
  "days": ["Mon", "Sat"], "start": "06:00", "end": "20:00",
  "price_per_day": 3000, "price_per_hour": 500,
  "references": [{ "name": "Jane W.", "phone": "+254700000222" }],
  "photo":              { "url": "https://…", "name": "me.jpg" },
  "licence_photo":      { "url": "https://…signed…", "name": "dl.jpg" },
  "id_photo":           { "url": "https://…signed…", "name": "id.jpg" },
  "good_conduct_photo": null,
  "status": "pending",
  "submitted_at": "2026-10-07T09:12:00+03:00",
  "reviewed_at": null,
  "reason": null,
  "fix_fields": [],
  "background_verified": false
}
```

Lay it out in blocks:

1. **Person:** photo, name, phone, email, years of experience, languages, bio.
2. **Licence and ID:** licence number, licence photo, ID photo, certificate of good
   conduct (or "Not provided").
3. **Work:** base town, areas served (or "Nationwide"), car types, transmissions,
   service type (`driver_only` = "Driver only", `car_and_driver` = "Brings own car"),
   working days and hours, daily and hourly rates.
4. **References:** name and phone, each phone a `tel:` link so the reviewer can call.

**Document links expire after 15 minutes.** The licence, ID and good conduct images
live in a private bucket. Show them as thumbnails that open full size in a new tab. If a
link has expired (the image fails to load), fetch the detail again for fresh links. Never
store these URLs or cache them in `localStorage`.

Actions at the bottom: **Approve** and **Send back**, shown only while
`status` is `pending`. A `rejected` application can still be approved (an admin changed
their mind); show Approve there too.

### Approve: `POST /admin/chauffeur-applications/:id/approve`

```json
{ "background_verified": true }
```

- Ask in the dialog: **"Certificate of good conduct checked?"** as a checkbox. Show it only
  when `good_conduct_photo` is present; otherwise send `false`. The server ignores `true`
  when no certificate was uploaded.
- The response is the detail object (now `status: "approved"`) plus
  `"chauffeur_id": "ch_7"`.
- Approval creates the driver's public profile (offline, unrated, no trips) and sends the
  applicant a push: "You're approved — switch to Chauffeur Mode".
- `409` = already approved.

### Send back: `POST /admin/chauffeur-applications/:id/reject`

```json
{
  "reason": "Your driving licence photo is blurry and the number can't be read.",
  "fix_fields": ["licence_photo"]
}
```

- `reason`: required, 5 to 1,000 characters. **The applicant reads it word for word**,
  so the textarea's hint should say so.
- `fix_fields`: checkboxes for what the applicant must change. The app opens the step
  that holds them. Allowed values, with labels to show:

| Value | Label |
|---|---|
| `photo` | Profile photo |
| `licence_photo` | Driving licence photo |
| `licence_number` | Licence number |
| `id_photo` | ID photo |
| `good_conduct_photo` | Certificate of good conduct |
| `first_name`, `last_name`, `phone` | Name / phone |
| `years_experience`, `languages`, `bio` | Experience, languages, bio |
| `base_town`, `areas_served`, `nationwide` | Where they drive |
| `car_types`, `transmissions`, `service_type` | Cars they drive |
| `days`, `start`, `end` | Working days and hours |
| `price_per_day`, `price_per_hour` | Rates |
| `references` | References |

Anything else is a `422`. Only a `pending` application can be sent back (`409`
otherwise). The applicant gets a push and can fix and resubmit, which puts it back to
`pending`.

---

## 4. Drivers

### List: `GET /admin/chauffeurs?status=&skip=&limit=`

- `status`: `active` | `suspended` | `deleted` | empty for all. Newest first.

Each row is the public driver profile plus admin fields:

```json
{
  "id": "ch_7",
  "first_name": "Brian", "last_name": "Kiprono", "display_name": "Brian K.",
  "photo_url": "https://…",
  "rating": 4.9, "reviews_count": 127, "trips_count": 312,
  "base_town": "Nakuru", "areas_served": ["Nairobi"], "nationwide": false,
  "price_per_day": 2500, "price_per_hour": 450,
  "availability": { "days": ["Mon", "Tue"], "start": "06:00", "end": "22:00" },
  "verified": { "identity": true, "licence": true, "background": false },
  "status": "active",
  "online": true,
  "phone": "+254700000111",
  "client_id": 346
}
```

Table columns: Photo, Name, Base town, Rating (`rating` is `null` until the first review;
show "New"), Trips, Online (green dot), Status (badge), Phone, and an action button.

A `deleted` driver (they deleted their account) shows as "Former driver" with no
contact details. Show no actions for them.

### Suspend or reinstate: `PATCH /admin/chauffeurs/:id`

```json
{ "status": "suspended", "note": "Two no-shows this week" }
```

- `status`: `suspended` or `active`. `note` is optional (up to 1,000 characters) and goes
  to the server log.
- Suspending takes the driver out of search at once and switches them offline. They
  can't accept or start trips, but can still see their earnings and withdraw. **Trips
  they already accepted stay**: tell the admin in the confirm dialog to check the Hires
  page for that driver.
- Response: `{ "id": "ch_7", "status": "suspended" }`. `409` = the driver deleted their
  account.

Button label: **Suspend** on active drivers (red, with a confirm dialog asking for the
note), **Reinstate** on suspended ones.

---

## 5. Hires

### List: `GET /admin/chauffeur-bookings?status=&stuck=&skip=&limit=`

- `status`: `pending` | `accepted` | `in_progress` | `completed` | `declined` |
  `cancelled` | empty for all.
- `stuck=true`: only accepted or in-progress trips 6+ hours past their end time (a
  no-show, or a driver who never pressed End). **Give this its own tab: "Needs attention".**
- Newest first, `limit` up to 200.

Each row is the hire as the renter sees it (`CHAUFFEURS_HANDOFF.md`) plus
`client_id`, `chauffeur_client_id` and `cancelled_by` (`renter` | `expired` |
`car_cancelled` | `replaced` | `admin`, or `null`). The fields a table needs:

| Column | From |
|---|---|
| Hire | `id` (e.g. `chb_3f9a1c0b7d2e`) |
| Renter | `client_name`, `client_phone` |
| Driver | `chauffeur.display_name` |
| When | `start` → `end`, plus `mode` (`days` / `hours`) and `days` or `hours` |
| Pickup | `pickup_location` |
| Fare | `total` |
| Payment | `payment_method` (`pay_now` / `cash`) + `payment_status` badge |
| Status | `status` badge |
| Refund | `refund_amount` when above 0 |

Status badge colours: `pending` grey, `accepted` blue, `in_progress` amber, `completed`
green, `declined` and `cancelled` red. Payment status labels: `unpaid` "Unpaid", `paid`
"Paid", `refunded` "Refunded", `cash_due` "Cash due", `cash_collected` "Cash collected".

### Cancel a hire: `POST /admin/chauffeur-bookings/:id/cancel`

```json
{ "reason": "Driver no-show, renter called support", "refund": true }
```

- For a no-show, a dispute, or a trip nobody closed. Show the button only on `pending`,
  `accepted` and `in_progress` hires.
- `reason`: required, 3 to 200 characters. It's stored on the hire.
- `refund`: `true` (default) refunds everything the renter paid in the app and creates a
  Refunds row for finance. `false` cancels without refunding (e.g. the trip happened
  and the driver forgot to end it). Make this a clearly labelled toggle, on by default,
  and show the amount: "Refund KSh 7,500 to the renter".
- Both sides get a push. Response: the updated hire. `409` = the hire is already closed.

---

## 6. Withdrawals

Drivers request withdrawals in the app; **finance sends the M-Pesa by hand** and records
the result here. Until then the money is held off the driver's balance.

### Queue: `GET /admin/chauffeur-payouts?status=`

- `status`: defaults to `processing` (the queue). `paid`, `failed`, or empty (send
  `status=`) for history. Oldest first, so the longest wait is on top. Max 500 rows.

```json
[
  {
    "id": "po_8c2e1a9f0b3d",
    "chauffeur_id": "ch_7",
    "chauffeur": "Brian Kiprono",
    "amount": 5000,
    "phone": "+254700000111",
    "status": "processing",
    "created_at": "2026-10-07T10:02:00+03:00",
    "processed_at": null,
    "mpesa_receipt_number": null,
    "note": null
  }
]
```

Columns: Requested, Driver, Amount, M-Pesa number (with a copy button), Status, and the
actions **Mark paid** and **Mark failed**.

### Record the result: `PATCH /admin/chauffeur-payouts/:id`

```json
{ "status": "paid", "mpesa_receipt_number": "QX12AB34CD", "note": null }
```

- **Mark paid** needs the M-Pesa receipt number (required, `400` without it).
- **Mark failed** asks for a note (e.g. "Number not registered"). The money goes straight
  back to the driver's balance.
- The driver gets a push either way. Response: `{ "id": "po_…", "status": "paid" }`.
  `409` = already processed (someone else got there first; reload the list).

---

## 7. Refunds

Refunds owed to renters, created automatically when:

- a driver declines a paid hire, or doesn't answer in 30 minutes;
- a renter cancels (in full, or 50% under 24 hours before the trip);
- a linked car booking is cancelled;
- money arrives after a hire closed, or twice;
- an admin cancels a hire with a refund.

Finance pays the renter back the same way they paid and records it here.

### Queue: `GET /admin/chauffeur-refunds?status=`

- `status`: defaults to `pending`. `completed`, `failed`, `cancelled`, or empty for all.
  Oldest first.

```json
[
  {
    "id": 41,
    "booking_id": "chb_3f9a1c0b7d2e",
    "client_email": "deon@example.com",
    "client_phone": "0712345678",
    "amount": 7500,
    "paid_with": "mpesa",
    "reason": "The driver can't take this trip.",
    "status": "pending",
    "created_at": "2026-10-07T11:30:00+03:00",
    "processed_at": null,
    "external_reference": null,
    "note": null
  }
]
```

`paid_with` tells finance which rail to refund through: `mpesa`, `card` (Paystack) or
`ardena_pay` (Stellar; contact the renter for an address). `client_email` and
`client_phone` are `null` if the renter has since deleted their account.

Columns: Created, Hire, Renter (email, phone), Amount, Paid with, Reason, and the actions
**Mark refunded**, **Failed**, **Cancel**.

### Record it: `PATCH /admin/chauffeur-refunds/:id`

```json
{ "status": "completed", "external_reference": "RFD-2210", "note": null }
```

- `status`: `completed` (money sent), `failed` (tried, didn't go through) or `cancelled`
  (closed without paying, e.g. settled another way). Ask for a note on the last two.
- `external_reference`: the M-Pesa, Paystack or Stellar reference, up to 255 characters.
- Response: `{ "id": 41, "status": "completed" }`. `409` = already processed.

---

## 8. All endpoints

| Method | Path | Roles |
|---|---|---|
| GET | `/admin/chauffeur-summary` | all five |
| GET | `/admin/chauffeur-applications?status=&skip=&limit=` | review |
| GET | `/admin/chauffeur-applications/:id` | review |
| POST | `/admin/chauffeur-applications/:id/approve` | review |
| POST | `/admin/chauffeur-applications/:id/reject` | review |
| GET | `/admin/chauffeurs?status=&skip=&limit=` | review |
| PATCH | `/admin/chauffeurs/:id` | review |
| GET | `/admin/chauffeur-bookings?status=&stuck=&skip=&limit=` | all five |
| POST | `/admin/chauffeur-bookings/:id/cancel` | all five |
| GET | `/admin/chauffeur-payouts?status=` | money |
| PATCH | `/admin/chauffeur-payouts/:id` | money |
| GET | `/admin/chauffeur-refunds?status=` | money |
| PATCH | `/admin/chauffeur-refunds/:id` | money |

- **review:** super_admin, general_admin, manager, customer_service.
- **money:** super_admin, general_admin, finance.
- **all five:** both groups.

Status codes to handle: `400` and `422` (bad input; a 422 also carries `message`, the
first problem in words), `403` (role), `404` (not found), `409` (already done, or
someone else changed it first: show `detail` and reload).

---

## 9. Build checklist (admin-website repo)

Follow the repo's usual recipe for a new section:

1. **API methods** in `api.js`, one per endpoint above.
2. **Nav:** a Chauffeurs group in `js/core/shell.js` (`NAV_ICONS`, `NAV_ITEMS`) with the
   five pages and their badges.
3. **Routing and roles** in `js/core/app.js`: `loadPage()` cases, plus the role lists in
   `configureNavigationForRole` and `isPageAllowedForRole`.
4. **Markup:** one `<div id="…Page" class="page-content">` per page in `dashboard.html`.
   Use `uiForm()` (`js/core/ui.js`) for the approve, reject, suspend, cancel, payout and
   refund dialogs instead of new modals.
5. **Page modules** in `js/pages/` with their `<script>` tags. Escape every value with
   `escapeHtml`: applicant bios, reasons and notes are typed by users.

Before shipping:

- [ ] Document thumbnails load, and re-fetch when a link expires.
- [ ] A customer_service admin sees Applications, Drivers and Hires, but not Withdrawals
      or Refunds.
- [ ] A finance admin sees Hires, Withdrawals and Refunds, but not Applications or Drivers.
- [ ] Every action reloads its list and the summary badges.
- [ ] Two admins acting on the same row: the second sees the `409` message, not a crash.
- [ ] Deploy the backend first (the endpoints don't exist on master yet).
