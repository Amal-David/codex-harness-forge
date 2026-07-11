import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function writeComprehensiveWorkflowFixtures(fixturesRoot) {
  const emptyDesignSystem = path.join(fixturesRoot, "empty-design-system");
  await mkdir(emptyDesignSystem, { recursive: true });
  const files = {
    financePrd: path.join(fixturesRoot, "finance-dashboard-prd.md"),
    checkoutPrd: path.join(fixturesRoot, "checkout-prd.md"),
    offlinePrd: path.join(fixturesRoot, "offline-field-notes-prd.md"),
    runbook: path.join(fixturesRoot, "runbook.md"),
    conflictA: path.join(fixturesRoot, "conflict-a.md"),
    conflictB: path.join(fixturesRoot, "conflict-b.md"),
    securityPrd: path.join(fixturesRoot, "security-auth-billing-prd.md"),
    openapi: path.join(fixturesRoot, "openapi.yaml"),
    emptyDesignSystem,
  };
  await writeFile(
    files.financePrd,
    `# Finance Dashboard PRD

Build a browser app for personal finance analysis. Users import CSV bank statements, categorize transactions, see monthly charts, and export reports.

Required:
- UI: dashboard, import wizard, category editor, transaction table, chart detail, error states.
- API: upload CSV, preview parse, commit import, CRUD categories, report export.
- Persistence: users, accounts, transactions, categories, import jobs, audit trail.
- Tests: parser unit tests, API integration tests, chart rendering smoke tests, end-to-end import flow.
- Accessibility: keyboard import flow, chart alternatives, table navigation.
- Deployment: hosted web app plus database migrations.
`,
    "utf8",
  );
  await writeFile(
    files.checkoutPrd,
    `# Checkout PRD

Build a checkout experience for a small shop. It must support cart state, discount codes, shipping estimates, payment authorization, order confirmation, and abandoned cart recovery.

Required:
- UI: cart, address, shipping, payment, confirmation, failure/retry.
- API: cart mutation, promo validation, shipping quote, payment intent, order creation.
- Persistence: carts, line items, users, addresses, payments, orders, idempotency keys.
- Tests: payment failure paths, idempotency, order state transitions, E2E happy path.
- Accessibility: form labels, error announcements, keyboard-only checkout.
- Deployment: secrets and payment sandbox/prod split.
`,
    "utf8",
  );
  await writeFile(
    files.offlinePrd,
    `# Offline Field Notes PRD

Build a mobile-first app for field workers who collect notes in low-connectivity environments. The app must work offline and sync later.

Required:
- UI: note list, note editor, photo attachment, sync queue, conflict resolution.
- API: sync batch, attachment upload, conflict merge, user workspace membership.
- Persistence: local drafts, remote notes, attachments, sync state, conflict records.
- Tests: offline edit, reconnect sync, conflict handling, data loss prevention.
- Accessibility: large touch targets, screen reader labels, high-contrast sync state.
- Deployment: web/PWA target with service worker and backend API.
`,
    "utf8",
  );
  await writeFile(
    files.runbook,
    `# Incident Runbook

Create a runbook for database connection pool exhaustion. Include symptoms, dashboards, immediate mitigations, rollback procedure, communication plan, and follow-up checks.
`,
    "utf8",
  );
  await writeFile(
    files.conflictA,
    `# Product PRD A

Authentication must be passwordless email magic links only. Data must be stored in PostgreSQL. The first release must be web-only.
`,
    "utf8",
  );
  await writeFile(
    files.conflictB,
    `# Product PRD B

Authentication must require username/password plus TOTP. Data must be stored in Firestore. The first release must be native mobile only.
`,
    "utf8",
  );
  await writeFile(
    files.securityPrd,
    `# SaaS Admin PRD

Build an admin console for account owners. It includes role-based access control, SSO, billing seats, invoice history, audit logs, API keys, and user impersonation.

Security requirements:
- RBAC must prevent privilege escalation.
- Every billing and role mutation must be audit logged.
- API keys must be revocable and secret material must not be displayed after creation.
- Admin actions need tests for authorization denial paths.
- Deployment must define secret management and logging retention.
`,
    "utf8",
  );
  await writeFile(
    files.openapi,
    `openapi: 3.1.0
info:
  title: Ledger API
  version: 1.0.0
paths:
  /accounts:
    get:
      responses:
        '200':
          description: List accounts
  /transactions:
    post:
      responses:
        '201':
          description: Create transaction
components:
  schemas:
    Transaction:
      type: object
      required: [accountId, amount, occurredAt]
      properties:
        accountId: { type: string }
        amount: { type: number }
        occurredAt: { type: string, format: date-time }
`,
    "utf8",
  );
  return files;
}
