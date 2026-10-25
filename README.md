# crm.frontend

Staff, customer and coach web interface for the ACE / CSKA tennis-centre CRM.

React · Vite · TypeScript. Russian interface, tenge amounts, `Asia/Almaty` business timezone, light and dark themes, desktop/tablet/phone support.

## Specification

This repository implements the documents in the specification repository. Read them before writing code:

| Document | Use |
|---|---|
| `development/README.md` | Business rules, page inventory P01–P21, sprints, API conventions, acceptance tests AC-01–15 |
| `development/frontend.md` | Ticket backlog FE-00–FE-23 |
| `development/ui-ux.md` | Design tokens, nine layout templates, per-page layout contract, UX-01–10 |
| `development/decisions.md` | Open decisions — a feature whose decision is unresolved is not implementation-ready |

## Status

Scaffold only. `src/App.tsx` is a placeholder; FE-00 delivers the route layout, role shells, token styles, form and table primitives, localization utilities and API client.

## Requirements

Node 22.13.0 or later (see `.nvmrc`).

## Commands

```sh
npm install        # install from package-lock.json
npm run dev        # dev server on http://localhost:5173
npm run typecheck  # TypeScript, no emit
npm run lint       # oxlint
npm run build      # typecheck and production build
npm run preview    # serve the production build
```

`npm run typecheck`, `npm run lint` and `npm run build` must pass before a pull request merges (INF-01).

## Configuration

Vite reads `VITE_`-prefixed variables from `.env.local`, which is git-ignored. Never commit a real environment file, and never place a secret in a `VITE_` variable — the build inlines them into client-side JavaScript where any visitor can read them.

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_PROXY_TARGET` | Dev-server proxy target for `/api` | `http://localhost:8000` |

The default port is provisional pending D-01.

## Constraints

Carried from `development/frontend.md`; they exist to prevent specific defects, not as style preferences.

- The backend owns authorization and all calculations. Permission checks here control which actions are visible; every API denial must still be handled.
- Record IDs and business-state changes come only from committed server responses. No optimistic confirmation of reservations, payments, refunds or attendance deductions.
- Never retry a payment with a new idempotency key because a response was lost. Recover the outcome of the original command instead.
- Do not store session credentials in browser-readable persistent storage.
- Partition query state by authenticated user and location; clear protected caches on logout and on scope or permission change.
- No desktop-only completion path. Core flows are tested at roughly 360 px, tablet and desktop widths, in both themes.
- Status must be conveyed by text, not colour alone.
