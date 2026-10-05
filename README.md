# Compose Visual Builder

Interactive smart contract project builder powered by [Compose](https://compose.diamonds).
Configure a Diamond, generate Solidity and a deployment script, compile it in the
browser, inspect selectors and storage, estimate deployment gas, and export the
project to Remix or your terminal.

## What it does

Compose Builder turns a saved configuration into a complete, compilable Diamond
project without a backend. Pick a base, add libraries and extensions, choose an
ownership model, and the app generates the Diamond contract, facet sources, and a
Foundry or Hardhat deployment script. The generated project is compiled locally in
a browser worker with a pinned compiler, validated, and summarized.

## Interface

The app is a single workspace with two modes, switched from the activity bar.
Mode, pane layout, selected file, and scroll position are persisted per project in
`sessionStorage`, so browser Back and direct refresh are safe.

- **Builder** — a sidebar with **Configure** and **Files** tabs, a read-only source
  viewport, and the composition graph. Configure offers the base, ownership, roles,
  required facets, and optional checklists; changes update the project live. The
  graph renders the Diamond and its facets in 3D on WebGL-capable browsers, with a
  selectable fallback when WebGL is unavailable. Clicking a Diamond or facet node
  opens the matching source file; aggregate access nodes only highlight.
- **Project** — **Selectors** and **Storage** tables in the middle, and two compact
  boxes on the right: Diamond creation gas and the corresponding Compose CLI
  command with copy. **Review project** switches here.

The gas number comes from executing the current compiled Diamond in a disposable
browser-local Paris EVM. Selected facets are deployed into fresh temporary state
first; only the Diamond transaction is counted (intrinsic gas, constructor
execution, runtime code deposit, and applied refunds). Facet deployment costs are
excluded. Current sample initialization and deterministic addresses are used; this
is not a chain quote, transaction fee, or recommended gas limit. Failed or
unsupported simulations show unavailable.

On smaller screens the right pane moves below the middle pane, and the Builder
sidebar becomes a collapsible overlay. Source is selectable and copyable, with no
editing caret. The app does not add deployment or source editing.

## Features

- **Catalog-driven configuration** — starting point (ERC-20, ERC-721, ERC-1155,
  ERC-6909, Counter, access control, blank Diamond), optional facets, libraries
  (ERC-165, etc.), permissions (Ownership, Roles), and framework selection
  (Foundry, Hardhat with ethers or viem).
- **Live code generation** — Diamond contract, facet sources, and a deployment
  script update as you configure.
- **In-browser compilation** — generated Solidity is compiled in a disposable
  browser worker with pinned `solc` 0.8.30 and the published
  `@perfect-abstractions/compose` 0.0.6 source package. Validation covers selector
  collisions, named storage positions, bytecode size limits, and required
  inspection selectors.
- **Local deployment simulation** — Diamond creation gas is measured in a
  browser-local Paris EVM using EthereumJS 10.1.3, bundled into a separate module
  worker. There is no RPC, wallet connection, backend, broadcast, or persisted EVM
  state. A fingerprint binds all source content, settings, compiler/source
  provenance, selected artifact order, and bytecode; config changes and navigation
  abort obsolete work. Each job is capped at 30 seconds and each temporary
  transaction at 30M gas; missing artifacts, unsupported constructors, unlinked
  bytecode, reverts, and invalid results fail closed.
- **Open in Remix** — export the generated project to
  [Remix](https://app.remix.live/) as a URL-encoded source bundle. Only projects
  whose facets come from the published Compose package can be exported; local
  template facets are rejected with a clear message.
- **Export to your terminal** — copy the exact
  `npx @perfect-abstractions/compose-cli init` command for the current
  configuration, with an editable project name.
- **Persistent workspace** — configuration and projects are saved to
  `localStorage` with versioned migration.

## Getting started

### Prerequisites

- Node.js 22.18+ or 24 (the test command uses Node's TypeScript support)
- npm or yarn

### Installation

```bash
npm install
```

### Environment setup

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

The WalletConnect Project ID is optional and only used if you surface wallet UI:

```
VITE_WALLETCONNECT_PROJECT_ID=your_actual_project_id
```

### Development

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

### Build

```bash
npm run build
```

The browser compiler assets are prepared from the locked `solc@0.8.30` and
`@perfect-abstractions/compose@0.0.6` dependencies. `npm run compiler:check`
compiles generated Solidity locally without deploying anything.

### Preview production build

```bash
npm run preview
```

## Scripts

| Command                  | Description                                                          |
| ------------------------ | -------------------------------------------------------------------- |
| `npm run dev`            | Start the Vite dev server (prepares compiler assets first)           |
| `npm run build`          | Type-check and build for production (prepares compiler assets first) |
| `npm run preview`        | Serve the production build locally                                   |
| `npm test`               | Run Vitest unit tests and the dependency-free graph probe            |
| `npm run typecheck`      | Type-check with `tsc -b`                                             |
| `npm run lint`           | Lint with `oxlint`                                                   |
| `npm run compiler:check` | Prepare and verify the pinned browser compiler assets                |

`prebuild`, `pretest`, and `predev` run `compiler:prepare` automatically, so the
pinned solc and Compose source assets are always current.

## Deployment

`wrangler.jsonc` targets the `compose-builder` Worker and serves Vite's `dist`
directory. Its custom build runs `npm run build` before upload, including the
pinned browser compiler assets. The empty `previews` block enables branch
previews without adding backend bindings or credentials. The app uses hash
routes, so both `#/` and `#/workspace` load from the same static entry page.

For the connected Git integration, use `npx wrangler deploy` for the production
branch and `npx wrangler preview` for non-production branches. `npm run preview`
is only Vite's local server. Keep the existing custom-domain configuration in
Cloudflare; no domain routes or account identifiers are checked into this repo.

To validate configuration and build assets without publishing:

```bash
npx wrangler@4.147.0 deploy --dry-run
```

See Cloudflare's [Preview configuration](https://developers.cloudflare.com/workers/previews/configuration/)
and [custom builds](https://developers.cloudflare.com/workers/wrangler/custom-builds/) documentation.

## Tech stack

- **Vite + React 19 + TypeScript**
- **Tailwind CSS v4** + **Radix UI** components
- **three** + **@react-three/fiber** + **@react-three/drei** for the composition graph
- **wagmi + viem + RainbowKit** for wallet integration (Sepolia; provider configured)
- **EthereumJS** 10.1.3 for the local deployment simulation
- **Zustand** for state management
- **lucide-react** for icons, **sonner** for toasts
- **Vitest** + **oxlint** + **Prettier** + **Husky** for quality

## Project structure

```
src/
├── components/
│   ├── editor/           # Workspace layout, setup panel, project review, source viewport
│   ├── graph/            # 3D composition graph, layout, interaction, WebGL support
│   └── ui/               # Shared UI primitives
├── lib/
│   ├── compose-core/     # Catalog, selection, codegen, compiler, deployment simulation
│   ├── state/            # Zustand store and workspace persistence
│   └── wagmi/            # Wallet config
├── types/                # TypeScript types
├── App.tsx
└── main.tsx
public/
├── bases/                # Base, library, and access catalog JSON
├── templates/            # Local facet templates
└── compiler/             # Pinned solc asset, worker, and Compose source manifest
scripts/
├── prepare-browser-compiler.mjs
├── check-browser-compiler.mjs
└── browser-compiler-worker.js
```

## License

MIT
