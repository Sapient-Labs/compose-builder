# Compose Project Builder

Interactive smart contract project builder powered by Compose.

## Workspace page

The original Builder / Project presentation remains the default at `#/`.
Open **Workspace** in the toolbar, or visit `#/workspace`, for a separate
three-pane presentation: collapsible configuration / files, source / compiler
inspection, and a live composition preview. Both pages use the same saved
configuration, catalog, generation and compiler pipeline.

Workspace's Configure pane follows a compact diamond setup form: name, base,
ownership, roles, required facets and optional checklists. Changes update the
current project live. Switching bases clears base-specific options, keeps
compatible libraries/access choices, and removes unavailable access extensions.
Required facets remain read-only; Generate project opens the existing file review.

The workspace preserves the existing 3D graph on WebGL-capable browsers and
offers a selectable composition fallback when WebGL is unavailable. On smaller
screens the preview moves below the source; the file/config sidebar becomes a
collapsible overlay. This page does not add deployment or source editing.

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and
`npm run compiler:check` to verify changes. Tests prepare the pinned compiler
source assets automatically. The dependency-free graph probe tests use Node's
TypeScript support (Node 22.18+ or 24 recommended for the test command).

## Features

- **Project Builder**: Configure your smart contract project through an intuitive interface
  - Starting point selection (ERC-20, ERC-721, Counter, etc.)
  - Optional facet selection
  - Libraries and dependencies (ERC-165, etc.)
  - Permissions (Ownership, Roles)
  - Framework selection (Foundry/Hardhat)
  - Live preview with code generation

- **Live Preview**: See generated Solidity code as you configure
- **CLI Command Generator**: Copy the exact `npx @perfect-abstractions/compose init` command for your configuration
- **Wallet Integration**: Connect wallet via RainbowKit (Sepolia testnet)
- **Persistent State**: Configuration saved to localStorage
- **Local Validation**: Generated Solidity is compiled in a disposable browser
  worker with pinned solc 0.8.30 and the published Compose source package

## Getting Started

### Prerequisites

- Node.js >= 18
- npm or yarn

### Installation

```bash
npm install
```

### Environment Setup

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Get a WalletConnect Project ID from https://cloud.walletconnect.com and add it to `.env`:

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
`@perfect-abstractions/compose@0.0.6` dependencies. Run `npm run compiler:check`
to compile generated Solidity locally without deploying anything.

### Preview Production Build

```bash
npm run preview
```

### Cloudflare Workers

`wrangler.jsonc` targets the existing `compose-launchpad` Worker and serves
Vite's `dist` directory. Its custom build runs `npm run build` before an upload,
including the pinned browser compiler assets, so a separate dashboard build
command is optional. The empty `previews` block enables branch previews without
adding backend bindings or credentials. The app uses hash routes, so both `#/`
and `#/workspace` load from the same static entry page.

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

## Tech Stack

- **Vite + React 19 + TypeScript**
- **shadcn/ui** + **Tailwind CSS v4**
- **wagmi + viem + RainbowKit** for wallet integration
- **Zustand** for state management
- **lucide-react** for icons

## Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── wizard/          # Wizard step components
│   └── preview/         # Preview panel
├── lib/
│   ├── compose-core/    # Extracted from CLI (catalog, selection, renderers)
│   ├── state/           # Zustand store
│   └── wagmi/           # Wallet config
├── types/               # TypeScript types
└── App.tsx
```

## Phase 2 (Planned)

- [x] In-browser Solidity compilation (solc-wasm)
- [ ] Interactive project composition preview with Three.js
- [ ] Direct deployment to Sepolia
- [ ] Facet deployment flow

## License

MIT
