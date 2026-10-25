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

**FE-00a complete** — design tokens, three role shells, routing for all P01–P21, and the money/date utilities. Every page is reachable behind real permission guards; page content is placeholder.

**FE-00b next** — the `ui-ux.md` §9 component contracts (`StatusBadge`, `HoldTimer`, `MoneyField`, `DataTable`, `DecisionDialog`, …), the API client, contract fixtures, and the component state gallery.

## Requirements

Node 22.13.0 or later (see `.nvmrc`).

## Commands

```sh
npm install        # install from package-lock.json
npm run dev        # dev server on http://localhost:5173
npm run typecheck  # TypeScript, no emit
npm run lint       # oxlint
npm run test       # vitest, jsdom
npm run build      # typecheck and production build
npm run preview    # serve the production build
npm run api:types  # regenerate src/api/schema.d.ts from the backend contract
```

`typecheck`, `lint`, `test` and `build` must all pass before a pull request merges (INF-01).

## Architecture

```
src/
  styles/     tokens.css (the only place colours live), base.css
  api/        schema.d.ts (generated — do not edit), types.ts (named aliases)
  auth/       context.ts (hook), AuthProvider.tsx — capabilities and locations
  location/   selected ACE/CSKA location and the cache scopeKey
  theme/      light / dark / system preference
  shells/     StaffShell, CustomerShell, CoachShell, navigation.ts
  routes/     AppRoutes.tsx (P01-P21 table), guards.tsx
  pages/      LoginPage, PlaceholderPage
  dev/        synthetic preview users — dev builds only
```

Context objects and hooks live in `context.ts`, providers in `*Provider.tsx`. Splitting them keeps fast refresh working: a file exporting both a component and a hook loses it.

### API types

`src/api/schema.d.ts` is generated from `../crm.backend/api/openapi.yaml` and is **committed, not ignored** — the contract lives in a sibling repository, so CI cannot regenerate it without cross-repo access. Treat it as a vendored contract: regenerate with `npm run api:types`, never hand-edit.

### Theme

Three states must all work: system default, explicit light, explicit dark. Every token is defined on bare `:root` first, then overridden in both the `prefers-color-scheme: dark` block and `[data-theme="dark"]`. A colour defined only inside a media query is missing in one of the three states.

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
