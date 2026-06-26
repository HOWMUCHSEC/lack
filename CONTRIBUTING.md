# Contributing

Thanks for helping improve Lack.

## Development Setup

Required tools:

- Go matching `go.mod`
- Node.js 22+
- pnpm 11.3.0
- Wails v2 for desktop packaging

Install frontend dependencies:

```sh
cd frontend
pnpm install --frozen-lockfile
```

## Verification

Run the full local verification gate before opening a pull request:

```sh
make verify
```

This runs frontend linting, tests, build, Go module verification, and Go tests.

## Security Work

Do not commit real credentials, private tokens, production database connection strings, customer data, or scan results from systems you are not authorized to test.

Use `.env.*.example` files for placeholders only. Keep real local environment files untracked.

## Pull Requests

- Keep changes focused and easy to review.
- Add or update tests for behavior changes.
- Document new configuration, security-sensitive behavior, and user-facing workflow changes.
