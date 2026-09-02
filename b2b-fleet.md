# B2B Fleet — API notes

Backing the **B2B Fleet** page. Backend module: `app/admin/b2b_fleet.py` in
`opabackend`.

## What this page is looking at

An Ardena-for-Business account builds a fleet in their own dashboard, then picks
which of those vehicles to sell on the Ardena consumer app. Each pick becomes a
`b2b_marketplace_listings` row and, once they publish, a mirrored `cars` row.

The rows here are **vehicles**, not listings. That matters: a workspace that has
added twelve cars and listed none has zero listings, and keying the page on
listings made those twelve invisible — which is the state a partner spends their
whole onboarding in, and the one an admin most needs to see. `vehicle_id` is the
row key everywhere; `listing_id` and `car_id` are both nullable and fill in as
the business progresses.

Cars that *have* been published are also visible in **Cars** — mixed in with
every B2C host's car, with nothing saying which business owns them, and no way
to tell why a listing isn't live.

## The two gates

A vehicle is rentable in the app only when **both** are open:

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
| `state` | `live` · `pending_review` · `rejected` · `hidden_by_business` · `not_submitted` · `not_listed`. Omit for all. |
| `business_id` | Scope to one workspace |
| `search` | Matches plate, vehicle name, or business name |
| `skip` / `limit` | `limit` max 100, default 20 |

Returns `{ cars, total, skip, limit }`. Each row:

```json
{
  "vehicle_id": 40,
  "listing_id": 12,
  "car_id": 305,
  "business_id": 3,
  "business_name": "Nyali Fleet Ltd",
  "business_verified": true,
  "business_active": true,
  "plate": "KDA 123A",
  "name": "Toyota Prado",
  "category": "SUV",
  "year": 2019,
  "vehicle_status": "Available",
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

Three progressively-filled-in keys, and the distinction between the first two is
the one people get wrong:

| | `listing_id` | `car_id` | Means |
|---|---|---|---|
| `not_listed` | `null` | `null` | added to the fleet, never offered to the app |
| `not_submitted` | set | `null` | listing started, never published |
| everything else | set | set | on the app, or waiting on / refused by review |

`vehicle_status` (`Available` / `On booking` / `In maintenance`) is the fleet's
own day-to-day availability and says nothing about the app — don't read it as a
visibility signal.

`daily_rate` is the listing's marketplace price, falling back to the fleet's own
daily rate when there is no listing yet.

`blocked_by` is `null` when the car is live. Otherwise:

| Value | Means |
|-------|-------|
| `not_listed` | the business hasn't offered this vehicle to the app |
| `not_submitted` | a listing exists but was never published |
| `review` | waiting on, or refused by, our review |
| `business` | we approved it; the business has it hidden |
| `admin_hidden` | both gates open, yet the car is hidden — someone used `PUT /admin/cars/{id}/hide`. Undo it there, not here. |

### `GET /admin/b2b/fleet/cars/stats`

Optional `business_id`. Feeds the four stat cards and the filter-option counts:

```json
{
  "total_vehicles": 61, "live": 15, "pending_review": 3, "rejected": 1,
  "hidden_by_business": 5, "not_submitted": 2, "not_listed": 35,
  "businesses": 4
}
```

`not_listed` is usually the largest bucket. Every count uses the same predicate
as the matching `state` filter, so an option reading 4 shows 4 rows.

### `GET /admin/b2b/fleet/cars/{vehicle_id}`

One row, same shape as a list entry.

### `POST /admin/b2b/fleet/cars/{vehicle_id}/approve`

The "Make visible" button. Sets `verification_status = verified` and re-derives
visibility.

Returns `{ car, message }`. **Read the message.** Approving a car the business
has hidden moves our gate and nothing else — the car is approved and still not
on the app. The message is what distinguishes that from a successful publish,
and the page toasts it as `info` rather than `success` when `car.is_live` is
false.

`400` when there is no car to review, with a `detail` that differs by cause:

- no listing at all — the business has to start one from their fleet dashboard
- listing never published — it still needs a description, cover image, model
  year and accepted commission terms

### `POST /admin/b2b/fleet/cars/{vehicle_id}/reject`

Body: `{ "reason": "..." }` (required, 3–2000 chars). Sets
`verification_status = denied` and stores the reason — which the business sees
in their own dashboard, so it should read as feedback, not an internal note.

`400` on an unpublished or unlisted vehicle, same as approve.

## Related: fleet counts on the businesses list

`GET /admin/b2b/businesses` carries two extra fields per row, rendered as the
**Cars** column on the B2B Businesses page:

- `vehicles_count` — fleet size
- `live_on_app_count` — how many renters can actually see, counted off
  `Car.is_hidden` rather than the listing status, so a published-but-unapproved
  car is correctly not counted

Both numbers, because either alone misleads: 12 cars looks like a working
partner until you see 0 of them are on the app, and "0 live" looks like a dead
account until you see they've added nothing yet. Both are batched for the whole
page in two queries, not two per row.

## Notes

- Both review actions go through the same `apply_review_outcome` helper as
  `PUT /admin/cars/{id}/approve`, so a fleet car reviewed here behaves exactly
  as one reviewed from **Cars**.
- Approve fires the referral first-published triggers, matching the B2C path. A
  no-op unless the underlying host was referred.
- `business_verified` / `business_active` are surfaced per row because an
  unverified (KYB pending) or suspended workspace is a reason to look twice
  before putting a car in front of renters.
