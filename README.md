# Admin Web Panel

Admin web interface for the Ardena car-rental platform. It's a plain
HTML/CSS/JavaScript app (no build step, no framework) that talks to the
FastAPI backend (`opabackend`) over its REST API.

## Running locally

There is nothing to build. Serve the folder with any static web server and open
it in a browser — don't open the files with `file://`, the API calls need an
`http://` origin.

```bash
# from the project root, pick one:
python -m http.server 5500
# or the VS Code "Live Server" extension (defaults to port 5500)
```

Then visit `http://localhost:5500/index.html`.

## Configuration

The backend base URL is defined as the `API_BASE_URL` constant in **two** files
(keep them in sync):

- `api.js`  — used by the dashboard
- `login.js` — used by the login page

It currently points at production:

```js
const API_BASE_URL = 'https://api.ardena.xyz/api/v1';
```

To run against a local backend, change both constants, e.g.
`http://localhost:8000/api/v1`, and make sure the backend allows your dev origin
(see **CORS** below).

## Authentication

Login (`index.html`) posts to `/admin/auth/login` and stores the returned JWT in
`localStorage` as `admin_token` (admin profile in `admin_info`). Every dashboard
request sends `Authorization: Bearer <admin_token>`; a `401` clears the token and
redirects back to the login page. Use the admin credentials issued for your
environment.

## Features

The dashboard (`dashboard.html`) is a single page with a sidebar; each section is
rendered by its own script under `js/pages/` (see **Files** below):

- **Dashboard** — stats, revenue, KYC and booking trend charts
- **Hosts** — list with search, KYC status filter, and a with/without-cars
  filter; view details, activate/deactivate, delete
- **Clients** — list with search and KYC status filter; view details,
  activate/deactivate, delete
- **Cars** — list/search, approve/reject/hide, media
- **Feedback**, **Notifications** (broadcasts + targeted sends),
  **Payment Methods**, **Bookings** (with pagination), **Withdrawals**,
  **Refunds**, **Subscribers** (newsletter), **Revenue**, **Support**,
  **Moderation** (Ratings · Secondary Contacts · Listing Reports tabs), and
  **Admins** (super-admin only)

The sidebar can be collapsed to an icon-only rail (toggle in the sidebar header);
the state is remembered in `localStorage`.

### KYC status

Host and client rows show a KYC badge — **Verified / Pending / Failed /
Not Started** — mapped from the backend `kyc_status`
(`approved / pending / declined / not_started`). See `kyccheckmd` for the backend
contract. The Hosts and Clients lists load the full dataset and apply
search/filter/pagination client-side.

## Files

| File | Purpose |
|------|---------|
| `index.html` / `login.js` / `styles.css` | Login page |
| `dashboard.html` | Admin dashboard markup (SPA shell + page containers) |
| `dashboard.css` | Dashboard styling |
| `api.js` | API client (`API_BASE_URL`, auth, all endpoint methods) |
| `js/core/helpers.js` | Shared helpers: formatting, escaping, badges, pagination, label constants |
| `js/core/shell.js` | Sidebar `NAV_ITEMS` (single source of truth), icons, collapse, mobile nav, profile menu |
| `js/core/app.js` | Bootstrap, auth/profile load, router (`loadPage`), role-based access |
| `js/pages/*.js` | One classic script per page (hosts, clients, cars, bookings, moderation, …) |
| `subscribers.html` | Standalone subscribers/newsletter view |
| `reports.md` | Listing-reports (moderation) API notes — see the Moderation → Listing Reports tab |
| `kyccheckmd` | KYC backend integration notes |
| `bookings.md` | Bookings API notes |

> All `js/**` files are **classic scripts** (not ES modules): every top-level
> function/variable is global, which is what lets inline `onclick=` handlers and
> cross-file calls work. Load order is set in `dashboard.html` (core before pages).
> To add a page: create `js/pages/<name>.js`, add a `<script>` tag, a `NAV_ITEMS`
> entry in `js/core/shell.js`, a `case` in `loadPage` (`js/core/app.js`), and a
> `.page-content` container in `dashboard.html`.

## CORS

Browser requests are blocked unless the **backend** returns the
`Access-Control-Allow-Origin` header for your origin, e.g.

```
Access to fetch at 'https://api.ardena.xyz/api/v1/admin/...' from origin
'http://localhost:5500' has been blocked by CORS policy: No
'Access-Control-Allow-Origin' header is present on the requested resource.
```

This is a **backend (`opabackend`) configuration issue**, not something the
frontend can fix. The API's CORS middleware must allow the origin you're serving
from (e.g. `http://localhost:5500`, `http://127.0.0.1:5500`, and the deployed
admin URL). In FastAPI that means adding the origin to `CORSMiddleware`
`allow_origins`. Until the backend allows your origin, requests from that origin
will fail in the browser.
