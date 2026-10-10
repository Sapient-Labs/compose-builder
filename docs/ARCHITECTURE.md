# Architecture

How Compose Visual Builder works under the hood. User-facing summary lives in [README](../README.md).

## Pipeline

Config -> codegen -> compile -> validate -> simulate -> review/export. No backend. All work happens in the browser.

## Workspace and state

Single workspace with two modes, switched from the activity bar: **Builder** (configure + sources + graph) and **Project** (selectors + storage + gas + CLI).

- `sessionStorage` persists per project: mode, pane layout, selected file, scroll position. Back navigation and refresh are safe.
- `localStorage` persists configuration and projects with versioned migration.
- State lives in a Zustand store (`src/lib/state`).

## Code generation

Catalog-driven (`src/lib/compose-core`, `public/bases`, `public/templates`):

- Starting point: ERC-20, ERC-721, ERC-1155, ERC-6909, Counter, access control, blank Diamond.
- Optional facets, libraries (ERC-165, etc.), permissions (Ownership, Roles).
- Framework: Foundry, or Hardhat with ethers or viem.
- Output: Diamond contract, facet sources, deployment script. Updates live as you configure.

## Compilation

Generated Solidity compiles in a disposable browser worker with pinned `solc` 0.8.30 and published `@perfect-abstractions/compose` 0.0.6 sources. Assets are prepared from locked dependencies (`scripts/prepare-browser-compiler.mjs`) and verified by `npm run compiler:check`, which compiles without deploying.

Validation covers selector collisions, named storage positions, bytecode size limits, and required inspection selectors.

## Deployment simulation

Diamond creation gas is measured in a disposable browser-local Paris EVM using EthereumJS 10.1.3 in a separate module worker.

- No RPC, wallet connection, backend, broadcast, or persisted EVM state.
- Selected facets deploy first into fresh temporary state; only the Diamond transaction counts (intrinsic gas, constructor execution, runtime code deposit, applied refunds). Facet costs are excluded.
- Uses current sample initialization and deterministic addresses. Not a chain quote, transaction fee, or recommended gas limit. Failed or unsupported simulations show unavailable.
- A fingerprint binds all source content, settings, compiler/source provenance, selected artifact order, and bytecode. Config changes and navigation abort obsolete work.
- Each job caps at 30 seconds, each temporary transaction at 30M gas. Missing artifacts, unsupported constructors, unlinked bytecode, reverts, and invalid results fail closed.

## Interface details

- Builder sidebar has **Configure** and **Files** tabs plus a read-only source viewport. Graph renders Diamond and facets in 3D on WebGL-capable browsers, with a selectable fallback otherwise. Clicking a Diamond or facet node opens its source; aggregate access nodes only highlight.
- Project shows **Selectors** and **Storage** tables, plus two compact boxes: Diamond creation gas and the matching Compose CLI command with copy. **Review project** switches here.
- Small screens: right pane moves below the middle pane; Builder sidebar becomes a collapsible overlay. Source is selectable and copyable with no editing caret. The app adds neither deployment nor source editing.

## Exports

- **Open in Remix**: URL-encoded source bundle for [Remix](https://app.remix.live/). Only projects whose facets come from the published Compose package qualify; local template facets are rejected with a clear message.
- **Terminal**: exact `npx @perfect-abstractions/compose-cli init` command for the current configuration, with an editable project name.

## Hosting

`wrangler.jsonc` targets the `compose-builder` Worker and serves Vite's `dist`. Custom build runs `npm run build` before upload, including pinned compiler assets. Empty `previews` block enables branch previews with no backend bindings or credentials. Hash routes mean `#/` and `#/workspace` load from the same static entry.

With connected Git integration: `npx wrangler deploy` for production, `npx wrangler preview` for other branches. `npm run preview` is only Vite's local server. Custom-domain config stays in Cloudflare; no domain routes or account identifiers are checked in. Validate without publishing via `npx wrangler@4.147.0 deploy --dry-run`.

## Tech stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4 + Radix UI
- three + @react-three/fiber + @react-three/drei (graph)
- wagmi + viem + RainbowKit (Sepolia; provider configured)
- EthereumJS 10.1.3 (simulation)
- Zustand (state)
- lucide-react, sonner
- Vitest + oxlint + Prettier + Husky

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
├── types/
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
