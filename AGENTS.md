# Job Automation

## Agent Behaviour

Before making significant code changes:

- Explain why the change is recommended.
- Describe which files will be modified.
- Before implementation, explain the proposed scope and affected files and obtain confirmation. Once that scope is approved, complete the necessary changes without requesting confirmation for each file. Ask again if the scope or architecture changes.
- Prefer incremental, reviewable changes over large refactors.
- If multiple approaches exist, explain the trade-offs before implementing one.

When introducing new concepts:

- Explain the reasoning, not just the syntax.
- Prefer teaching over simply generating code.
- Avoid unnecessary abstractions.

## Secrets & Environment Files

- Never read, view, edit, or output the contents of `.env` or `.env.*` files (such as `.env.local`, `.env.production`, or `.env.staging`).
- Never print environment variable values or secrets into logs, diffs, or responses.
- Use `.env.example` to check required variable names instead.
- If a task requires a secret or environment variable, ask me to run the command or set it rather than reading `.env`.

## Scope

Only modify files that are necessary for the requested task.

Avoid unrelated formatting, renaming or refactoring.

If a broader refactor is recommended, explain it first and wait for approval.

## When Unsure

If requirements are ambiguous:

- Ask a question instead of guessing.

Do not invent architecture decisions.

Do not replace existing patterns without explanation.

## Breaking Changes

Never make architectural or breaking changes without explicit confirmation.

Examples include:

- Changing routing.
- Replacing libraries.
- Restructuring folders.
- Changing state management.
- Changing build tooling.


## General

- Use Next.js App Router.
- Use TypeScript throughout.
- Prefer server components unless client interactivity is required.
- Use client components only when state, effects or browser APIs are needed.

## Formatting

- Use tabs for indentation in source code, including TypeScript, TSX and CSS.
- Display tabs at a width of 4.
- Follow required syntax in formats that do not support tabs, such as YAML.
- Do not reformat unrelated code.
- Do not manually reformat generated files or dependency lockfiles.

## Styling

- Use plain CSS.
- Follow the existing layout conventions.
- Prefer CSS variables for colours and spacing.

## Components

- Keep components focused and reusable.
- Avoid unnecessary abstraction.
- Use PascalCase for component names.

## Form Handling and Data

- Validate all submissions on the server. Client validation is for usability.
- Only collect and store information required for the agreed purpose.
- Keep database access and credentials on the server.
- Never log personal information, credentials or secrets.
- Use versioned database migrations for schema changes.
- Include accessible labels, validation messages and submission feedback.
- Include protection against automated spam and repeated submissions.

## Admin

- Require server-side authentication and authorisation for all admin
  pages and data operations.
- Do not expose submission data through public pages or endpoints.

## Email

- Save submissions successfully before sending notification emails.
- An email failure must not discard a saved submission.
- Keep email delivery on the server.
- Make scheduled email jobs safe to retry without duplicate delivery.
- Document the timezone used for weekly emails.

## Docker and Configuration

- Support local development and production deployment using Docker.
- Keep environment-specific settings in environment variables.
- Never commit secrets or real submission data.
- Maintain an .env.example with placeholder values.
- Persist database data outside the container's writable layer.
- Document setup, migrations, backups and restoration.

## Verification

- Run relevant formatting, lint, type and build checks after changes.
- Test critical behaviour, including submission validation, admin access
  and email failure handling.
- Report checks that could not be completed.
