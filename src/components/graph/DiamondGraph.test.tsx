import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DiamondGraph } from './DiamondGraph';
import { useLaunchpadStore } from '@/lib/state/store';
import { loadBasesCatalog } from '@/lib/compose-core';
import { DiamondSetupPanel } from '@/components/editor/DiamondSetupPanel';

HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock('./webglSupport', () => ({ canRenderWebGL2: () => false }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function prepareCatalog() {
  vi.stubGlobal('fetch', async (url: string) => ({
    ok: true,
    json: async () => JSON.parse(await readFile(path.resolve('public', url.slice(1)), 'utf8')),
  }));
  useLaunchpadStore.getState().reset();
  useLaunchpadStore.getState().setCatalog(await loadBasesCatalog());
}

it('keeps composition selectable when WebGL is unavailable and follows configuration', async () => {
  await prepareCatalog();
  useLaunchpadStore.getState().setConfig({ baseKey: 'counter' });
  render(
    <>
      <DiamondSetupPanel />
      <DiamondGraph enableWebGLFallback />
    </>,
  );
  expect(screen.getByRole('status').textContent).toContain('3D preview unavailable');
  const node = screen.getByRole('button', { name: 'CounterDataFacet facet' });
  fireEvent.click(node);
  expect(node.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
  expect(node.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(screen.getByRole('checkbox', { name: 'CounterResetFacet' }));
  expect(screen.getByRole('button', { name: 'CounterResetFacet facet' })).toBeTruthy();
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Base' }), { key: 'ArrowDown' });
  fireEvent.click(screen.getByRole('option', { name: 'None · Blank diamond' }));
  expect(screen.queryByRole('button', { name: 'CounterDataFacet facet' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'CounterResetFacet facet' })).toBeNull();
});

it('opens exact project sources for the center, facets, libraries and access extensions', async () => {
  await prepareCatalog();
  useLaunchpadStore.getState().setConfig({
    baseKey: 'counter',
    selectedExtensions: ['CounterResetFacet'],
    selectedLibraries: ['ERC165Facet'],
    selectedAccess: ['owner'],
    selectedAccessExtensions: ['OwnerRenounceFacet'],
  });
  const onSourceSelect = vi.fn();
  render(<DiamondGraph enableWebGLFallback onSourceSelect={onSourceSelect} />);

  for (const [label, source] of [
    ['CounterDataFacet facet', 'src/facets/CounterDataFacet.sol'],
    ['CounterResetFacet facet', 'src/facets/CounterResetFacet.sol'],
    ['ERC165Facet library', 'src/facets/ERC165Facet.sol'],
    ['OwnerDataFacet facet', 'src/facets/OwnerDataFacet.sol'],
    ['OwnerRenounceFacet access', 'src/facets/OwnerRenounceFacet.sol'],
    ['Diamond source', 'src/Diamond.sol'],
  ]) {
    const node = screen.getByRole('button', { name: label });
    fireEvent.click(node);
    expect(node.getAttribute('aria-pressed')).toBe('true');
    expect(onSourceSelect).toHaveBeenLastCalledWith(source);
  }
  expect(onSourceSelect).toHaveBeenCalledTimes(6);
  expect(screen.queryByRole('button', { name: 'OwnerRenounceFacet facet' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
  expect(screen.getByRole('button', { name: 'Diamond source' }).getAttribute('aria-pressed')).toBe(
    'false',
  );
  expect(onSourceSelect).toHaveBeenCalledTimes(6);
});

it('renders base facet contracts instead of aggregate access nodes', async () => {
  await prepareCatalog();
  useLaunchpadStore.getState().setConfig({ selectedAccess: ['owner', 'access-control'] });
  const onSourceSelect = vi.fn();
  render(<DiamondGraph enableWebGLFallback onSourceSelect={onSourceSelect} />);
  expect(screen.queryByRole('button', { name: 'Owner access' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'AccessControl access' })).toBeNull();
  const node = screen.getByRole('button', { name: 'OwnerDataFacet facet' });
  fireEvent.click(node);
  expect(node.getAttribute('aria-pressed')).toBe('true');
  expect(onSourceSelect).toHaveBeenLastCalledWith('src/facets/OwnerDataFacet.sol');
  expect(screen.getByRole('button', { name: 'AccessControlDataFacet facet' })).toBeTruthy();
});

it('drops obsolete node selection when composition changes and keeps the center available', async () => {
  await prepareCatalog();
  useLaunchpadStore.getState().setConfig({ baseKey: 'counter' });
  const onSourceSelect = vi.fn();
  render(<DiamondGraph enableWebGLFallback onSourceSelect={onSourceSelect} />);
  fireEvent.click(screen.getByRole('button', { name: 'CounterDataFacet facet' }));
  act(() => useLaunchpadStore.getState().setConfig({ baseKey: 'none' }));
  expect(screen.queryByRole('button', { name: 'CounterDataFacet facet' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Clear selection' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Diamond source' }));
  expect(onSourceSelect).toHaveBeenLastCalledWith('src/Diamond.sol');
});

it('keeps source navigation opt-in for existing graph consumers', async () => {
  await prepareCatalog();
  render(<DiamondGraph enableWebGLFallback />);
  expect(screen.queryByRole('button', { name: 'Diamond source' })).toBeNull();
  const node = screen.getByRole('button', { name: 'DiamondInspectFacet facet' });
  fireEvent.click(node);
  expect(node.getAttribute('aria-pressed')).toBe('true');
});
