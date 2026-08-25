# B2B Fleet — API notes

Backing the **B2B Fleet** page. Backend module: `app/admin/b2b_fleet.py` in
`opabackend`.

## What this page is looking at

An Ardena-for-Business account builds a fleet in their own dashboard, then picks
which of those vehicles to sell on the Ardena consumer app. Each pick becomes a
`b2b_marketplace_listings` row and, once they publish, a mirrored `cars` row.

Those cars are already visible in **Cars** — mixed in with every B2C host's car
and with nothing saying which business owns them. This page is the same cars
seen from the fleet-partner side, plus the one thing **Cars** can't show: why a
listing isn't live.

## The two gates

A fleet vehicle is rentable in the app only when **both** are open:

| Gate | Field | Who moves it |
|------|-------|--------------|
| The business wants it up | `b2b_marketplace_listings.status == "visible"` | the business, in their dashboard |
| Ardena approved it | `cars.verification_status == "verified"` | us, from this page |

`cars.is_hidden` is what the consumer queries actually filter on, and it is
derived from the two gates. That is why this page has no plain "hide" button:
setting `is_hidden` directly (as `PUT /admin/cars/{id}/hide` does) is undone the
moment the business next edits their listing, because the sync recomputes
`is_hidden` from the gates. Moving our gate to `denied` is the only takedown
that holds.

## Endpoints

All under `/api/v1`, all requiring an admin bearer token.

### `GET /admin/b2b/fleet/cars`

| Param | Notes |
|-------|-------|
| `state` | `live` · `pending_review` · `rejected` · `hidden_by_business` · `not_submitted`. Omit for all. |
| `business_id` | Scope to one workspace |
| `search` | Matches plate, vehicle name, or business name |
| `skip` / `limit` | `limit` max 100, default 20 |

Returns `{ cars, total, skip, limit }`. Each row:

```json
{
  "listing_id": 12,
  "vehicle_id": 40,
  "car_id": 305,
  "business_id": 3,
  "business_name": "Nyali Fleet Ltd",
  "business_verified": true,
  "business_active": true,
  "plate": "KDA 123A",
  "name": "Toyota Prado",
  "category": "SUV",
  "year": 2019,
  "daily_rate": 12000,
  "cover_image": "https://...",
  "location_name": "Nyali, Mombasa",
  "insurance_expiry": "2027-01-04",
  "inspection_expiry": null,
  "listing_status": "visible",
  "review": "approved",
  "rejection_reason": null,
  "is_live": true,
  "blocked_by": null,
  "created_at": "2026-08-01T09:12:00Z",
  "updated_at": null
}
```

`car_id` is `null` until the business publishes — there is no car on the app
yet, so there is nothing to approve. The page shows those rows (they tell you a
partner is stuck mid-setup) but offers no action buttons.

`blocked_by` is `null` when the car is live. Otherwise:

| Value | Means |
|-------|-------|
| `not_submitted` | the business hasn't published the listing |
| `review` | waiting on, or refused by, our review |
| `business` | we approved it; the business has it hidden |
| `admin_hidden` | both gates open, yet the car is hidden — someone used `PUT /admin/cars/{id}/hide`. Undo it there, not here. |

### `GET /admin/b2b/fleet/cars/stats`

Optional `business_id`. Feeds the four stat cards and the tab counts:

```json
{
  "total_listings": 24, "live": 15, "pending_review": 3, "rejected": 1,
  "hidden_by_business": 5, "not_submitted": 2,
  "businesses_listing": 4, "unlisted_vehicles": 37
}
```

`unlisted_vehicles` counts fleet vehicles with **no** marketplace listing at
all — vehicles a business runs but has never offered to the app.

Every count uses the same predicate as the matching `state` filter, so a tab
reading 4 shows 4 rows.

### `GET /admin/b2b/fleet/cars/{listing_id}`

One row, same shape as a list entry.

### `POST /admin/b2b/fleet/cars/{listing_id}/approve`

The "Make visible" button. Sets `verification_status = verified` and re-derives
visibility.

Returns `{ car, message }`. **Read the message.** Approving a car the business
has hidden moves our gate and nothing else — the car is approved and still not
on the app. The message is what distinguishes that from a successful publish,
and the page toasts it as `info` rather than `success` when `car.is_live` is
false.

`400` when the business hasn't published the listing yet (`car_id` is null); the
`detail` explains what they still owe (description, cover image, model year,
commission terms).

### `POST /admin/b2b/fleet/cars/{listing_id}/reject`

Body: `{ "reason": "..." }` (required, 3–2000 chars). Sets
`verification_status = denied` and stores the reason — which the business sees
in their own dashboard, so it should read as feedback, not an internal note.

`400` on an unpublished listing, same as approve.

## Notes

- Both actions go through the same `apply_review_outcome` helper as
  `PUT /admin/cars/{id}/approve`, so a fleet car reviewed here behaves exactly
  as one reviewed from **Cars**. The difference is the listing key and the
  honest `is_live` answer.
- Approve fires the referral first-published triggers, matching the B2C path. A
  no-op unless the underlying host was referred.
- `business_verified` / `business_active` are surfaced per row because an
  unverified (KYB pending) or suspended workspace is a reason to look twice
  before putting a car in front of renters.
