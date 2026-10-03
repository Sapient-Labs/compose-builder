# Compose Project Builder

Interactive smart contract project builder powered by Compose.

## Workspace page

The original Builder / Project presentation remains the default at `#/`.
Open **Workspace** in the toolbar, or visit `#/workspace`, for a separate
three-pane presentation: collapsible configuration / files, source / compiler
inspection, and a live composition preview. Both pages use the same saved
configuration, catalog, generation and compiler pipeline.

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
