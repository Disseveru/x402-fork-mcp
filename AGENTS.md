# AGENTS.md

## Cursor Cloud specific instructions

x402 is a multi-language payment-protocol monorepo (TypeScript, Python, Go, Java). There is no single deployable app; development is organized by SDK.

### Toolchain

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | >= 22 | Required for TypeScript SDK, site, e2e |
| pnpm | 11.1.1 | Pinned via `packageManager` in root `package.json` |
| Go | 1.22+ (CI uses 1.24) | `go` auto-downloads 1.24.1 toolchains on first `make deps` |
| Python | >= 3.10 | `uv` manages the Python SDK venv at `python/x402/.venv` |
| uv | latest | Installed to `~/.local/bin`; ensure `source ~/.local/bin/env` in shell |
| Java/Maven | optional | Only needed for `java/` SDK work |

### Primary workspaces

| Workspace | Path | Install | Build | Test | Lint |
|-----------|------|---------|-------|------|------|
| TypeScript SDK | `typescript/` | `pnpm install --frozen-lockfile` | `pnpm build` | `pnpm test` | `pnpm lint:check` |
| Demo site | `typescript/site/` | (via `typescript/` install) | `pnpm build` | — | `pnpm lint:check` |
| Python SDK | `python/x402/` | `uv sync --all-extras --dev` | — | `uv run pytest` | `uvx ruff check` |
| Go SDK | `go/` | `make deps` | `make build` | `go test -race ./...` | `make deps-dev && make lint` |
| Examples | `examples/typescript/` | `pnpm install --frozen-lockfile` | `pnpm build` | — | `pnpm lint:check` |
| E2E harness | `e2e/` | `pnpm install --frozen-lockfile` | `pnpm run setup` | `pnpm test` | — |

See language-specific guides: `typescript/CONTRIBUTING.md`, `python/CONTRIBUTING.md`, `go/CONTRIBUTING.md`.

### Running services locally

**Express example (minimal payment demo, no wallet keys needed for 402 response):**

```bash
cd examples/typescript/servers/express
export EVM_ADDRESS=0x0000000000000000000000000000000000000001
export SVM_ADDRESS=11111111111111111111111111111111
export FACILITATOR_URL=https://x402.org/facilitator
pnpm dev
# curl http://localhost:4021/weather  → HTTP 402 with PAYMENT-REQUIRED header
```

**Next.js demo site** (`typescript/site/`): needs `FACILITATOR_URL`, `RESOURCE_EVM_ADDRESS`, `RESOURCE_SVM_ADDRESS` at minimum; facilitator private keys are only required for `/facilitator` settlement routes. `pnpm dev` → http://localhost:3000.

**Full E2E payment flow** (`e2e/`): requires populated `e2e/.env` (copy from `e2e/.env-local`) with testnet wallet keys. Run `pnpm install:all` then `pnpm test --min`.

### Gotchas

- `uv` is not on PATH by default; run `source ~/.local/bin/env` before Python commands.
- TypeScript packages must be built (`cd typescript && pnpm build`) before examples/e2e servers that import `workspace:*` packages.
- E2E tests hit public testnet RPCs and need funded test wallets; unit tests do not.
- The demo site and express example can use the public facilitator at `https://x402.org/facilitator` for unpaid-request (402) demos without local facilitator keys.
- Go `make deps-dev` installs `golangci-lint` to `$(go env GOPATH)/bin`; ensure that is on PATH for `make lint`.
- No Docker/docker-compose in this repo.
