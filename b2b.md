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

## Permissions

- All admin roles can view requests and businesses.
- Approving/rejecting requests, creating businesses and any credential
  operation require **super_admin** or **manager** (enforced server-side).

Temporary passwords are never stored in plaintext and can never be retrieved
after the modal is closed — use "Reset password" to issue a new one.
