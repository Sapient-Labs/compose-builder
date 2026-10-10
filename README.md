# Compose Visual Builder

Interactive smart contract project builder powered by [Compose](https://compose.diamonds).
Configure a Diamond, generate Solidity and a deployment script, compile in the browser, inspect selectors and storage, estimate deployment gas, and export to Remix or your terminal.

[Try the builder now](https://app.compose.diamonds)

## What it does

Turns a saved configuration into a complete, compilable Diamond project with no backend. Pick a base, add libraries and extensions, choose an ownership model, and the app generates the Diamond contract, facet sources, and a Foundry or Hardhat deployment script. The result is compiled locally in a browser worker with a pinned compiler, then validated and summarized.

## Interface

Builder mode to configure and inspect sources, Project mode to review selectors, storage, gas, and export.

## Features

- **Configure** — bases (ERC-20, ERC-721, ERC-1155, ERC-6909, Counter, access control, blank Diamond), facets, libraries, permissions, Foundry/Hardhat.
- **Generate + compile** — Diamond, facets, and deployment script update live; compiled in-browser with pinned `solc` 0.8.30.
- **Review** — selectors, storage, and local Diamond creation gas estimate.
- **Export** — open in Remix, or copy the `compose-cli init` command.
- **Persistent** — config and projects saved locally.

How it works under the hood: [ARCHITECTURE](./docs/ARCHITECTURE.md).

## Getting started

### Prerequisites

- Node.js 22.18+ or 24 (the test command uses Node's TypeScript support)
- npm or yarn

### Installation

```bash
npm install
```

### Environment setup

```bash
cp .env.example .env
```

````

### Development

```bash
npm run dev
````

Open http://localhost:5173.

### Build

```bash
npm run build
```

Browser compiler assets come from locked `solc@0.8.30` and `@perfect-abstractions/compose@0.0.6` dependencies. `npm run compiler:check` compiles generated Solidity locally without deploying.

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

## Tech stack

Vite + React 19 + TypeScript, Tailwind v4 + Radix, three/fiber/drei, wagmi/viem/RainbowKit, EthereumJS, Zustand. Full list and layout in [ARCHITECTURE](./docs/ARCHITECTURE.md).

## License

MIT
