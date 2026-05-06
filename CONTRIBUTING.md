# Contributing

Thanks for helping improve Maybe. This project uses Bun for dependency
management, local development, testing, and the production server.

## Requirements

- Bun 1.3 or newer
- A browser supported by Playwright, if you run end-to-end tests

## Local setup

```bash
bun install
bun run dev
```

The development server starts the Hono API and the Vite client together. The
API owns `/api/*`; client routes should not be added under that prefix.

## Checks

Run the full project check before opening a pull request:

```bash
bun run check
```

Useful narrower checks:

```bash
bun test
bun run test:e2e
bun run lint
bun run build
```

Keep `bun.lock` as the only package-manager lockfile. Do not add npm, pnpm, or
Yarn lockfiles unless the project intentionally changes package managers.

## Local files

Do not commit local runtime state or secrets. The repo ignores `.env`, `data/`,
`dist/`, Playwright output, and `node_modules/`.

Use `.env.example` as the public list of supported environment variables.
