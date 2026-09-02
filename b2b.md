# B2B Businesses (Ardena for Business)

Admin section for onboarding car-hire companies onto the B2B dashboard.
Backed by `/api/v1/admin/b2b/...`.

## How access works

There is no self-serve signup for the B2B dashboard. The flow is:

1. A company submits the public "Request access" form on the marketing site
   (`POST /api/v1/b2b/auth/access-requests`) and gets a reference like
   `REQ-2026-118`.
2. The request appears in **B2B Businesses → Access Requests** (pending).
3. An admin verifies the business (KYB) and either:
   - **Approve** — the backend creates the business workspace plus an
     **Owner** login for the contact email. A strong temporary password is
     generated, emailed from `info@ardena.co.ke`, and shown to the admin
     **once** in a modal (for manual handover if the email fails).
   - **Reject** — with an optional internal reason.
4. The owner signs in at the B2B dashboard and should change the password.

## Businesses tab

- Lists all workspaces with owner email, user count and status.
- **Create Business** — sales-led onboarding without an access request; same
  credential generation + email + one-time display.
- **Users** — per-business logins: reset password (new temp password emailed
  and shown once), activate/deactivate a user.
- **Deactivate** a business suspends every login in that workspace immediately.
  Reversible via **Activate**.
- **Delete** permanently removes the workspace — see the backend section below;
  the endpoint is not implemented yet.

## Permissions

- All admin roles can view requests and businesses.
- Approving/rejecting requests, creating businesses and any credential
  operation require **super_admin** or **manager** (enforced server-side).

Temporary passwords are never stored in plaintext and can never be retrieved
after the modal is closed — use "Reset password" to issue a new one.

---

# Backend work requested from the admin UI

Endpoints the admin dashboard already calls but the API does not implement yet.
The UI is wired and shipped; each of these currently fails at the network call.

## 1. Delete a business (NOT IMPLEMENTED)

```
DELETE /api/v1/admin/b2b/businesses/{business_id}
```

Permanently removes a workspace. This is distinct from **Deactivate**, which
already exists and is reversible — delete is for workspaces created in error,
duplicates, and companies that have asked to be removed.

**Auth:** `super_admin` only. Deactivate is available to `manager` too, but a
permanent delete should not be.

**Behaviour**

- Cascade-delete, in one transaction:
  - the business record
  - every `B2BUser` login in the workspace (so nobody retains a session)
  - the workspace's vehicles and their marketplace listings
  - any access request rows linked to the business
- Any active sessions/tokens for those users must stop working immediately.
- Idempotent-ish: a second call for the same id returns `404`, not `500`.

**Responses**

| Code | When | Body |
|---|---|---|
| `200` | Deleted | `{ "message": "Prime Fleet Ltd was deleted.", "deleted": { "users": 3, "vehicles": 12 } }` |
| `403` | Caller is not `super_admin` | `{ "detail": "..." }` |
| `404` | No such business | `{ "detail": "Business not found" }` |
| `409` | Refused — see below | `{ "detail": "..." }` |

**Open question for the backend — bookings.** If a workspace's vehicles have
active or upcoming bookings, deleting them orphans real renter reservations.
Preferred handling: return `409` with a message naming the count
(`"3 vehicles have upcoming bookings — cancel or complete them first"`) rather
than cascading through booking history. Confirm before implementing; the admin
UI surfaces whatever `detail` comes back, so no UI change is needed either way.

**Admin UI side (already built)**

- `api.deleteB2BBusiness(businessId)` in `api.js`.
- A red **Delete** button per row in B2B Businesses.
- Confirmation requires typing the exact business name — an OK/Cancel dialog is
  too easy to click through for something irreversible.

## 2. Delete a fleet vehicle (NOT IMPLEMENTED)

```
DELETE /api/v1/admin/b2b/fleet/cars/{vehicle_id}
```

Permanently removes one vehicle from a business's fleet. Distinct from
**Remove from the app** (`/reject`, already implemented), which only un-approves
the listing and leaves the vehicle in the workspace.

**Auth:** `super_admin` or `manager` — same level as the existing approve/reject
on this resource.

**Behaviour**

- Cascade-delete, in one transaction: the `B2BVehicle`, its marketplace listing
  if any, and the `Car` row backing it on the consumer app.
- Works for vehicles with no listing and no car row (`car_id: null`) — those are
  fleet entries the business never offered, and deleting them is the main reason
  this endpoint exists.
- Idempotent-ish: a second call for the same id returns `404`, not `500`.

**Responses**

| Code | When | Body |
|---|---|---|
| `200` | Deleted | `{ "message": "KDA 123A was deleted." }` |
| `403` | Insufficient role | `{ "detail": "..." }` |
| `404` | No such vehicle | `{ "detail": "Vehicle not found" }` |
| `409` | Refused — see below | `{ "detail": "..." }` |

**Open question — bookings.** Same as §1: if the vehicle has active or upcoming
bookings, prefer `409` with a message naming them
(`"This vehicle has 2 upcoming bookings — cancel or complete them first"`) over
cascading through booking history. The admin UI shows whatever `detail` comes
back, so either choice works without a UI change.

**Admin UI side (already built)**

- `api.deleteB2BFleetVehicle(vehicleId)` in `api.js`.
- A red trash icon in the B2B Fleet row actions, on every row including ones
  with no car on the app.
- Confirmation is a danger-styled modal naming the plate and the business.
