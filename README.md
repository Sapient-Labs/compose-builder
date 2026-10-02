# Compose Launchpad

Interactive diamond builder for EIP-2535 diamonds powered by Compose.

## Features

- **6-Step Wizard**: Configure your diamond through an intuitive interface
  - Base selection (ERC-20, ERC-721, Counter, etc.)
  - Optional facet selection
  - Library facets (ERC-165, etc.)
  - Access control (Ownership, Roles)
  - Framework selection (Foundry/Hardhat)
  - Live preview with code generation

- **Live Preview**: See generated `Diamond.sol` code as you configure
- **CLI Command Generator**: Copy the exact `compose init` command for your configuration
- **Wallet Integration**: Connect wallet via RainbowKit (Sepolia testnet)
- **Persistent State**: Configuration saved to localStorage
- **Local Validation**: The generated Diamond is compiled in a disposable browser
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
to compile the generated Diamond wrapper locally without deploying anything.

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
- [ ] 3D diamond preview with Three.js
- [ ] Direct deployment to Sepolia
- [ ] Facet deployment flow

## License

MIT
