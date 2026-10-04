import { readFileSync, readdirSync } from "node:fs"
import { Children, isValidElement } from "react"
import type { PointerEvent as ReactPointerEvent, ReactElement, ReactNode } from "react"
import type { CanvasProps, ThreeEvent } from "@react-three/fiber"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { act, cleanup, render, screen } from "@testing-library/react"
import { DiamondGraph } from "./DiamondGraph"
import { useLaunchpadStore } from "@/lib/state/store"
import type { BasesCatalog } from "@/types/catalog"

// Keep actual graph event handlers and gesture state while avoiding a WebGL
// dependency in jsdom. Children remain a scene tree we can inspect and click.
const scene = vi.hoisted(() => ({ current: undefined as CanvasProps | undefined }))
vi.mock("@react-three/fiber", () => ({
  Canvas: (props: CanvasProps) => {
    scene.current = props
    return <div data-testid="graph-canvas" />
  },
  useFrame: vi.fn(),
  useThree: vi.fn(),
}))
vi.mock("@react-three/drei", () => ({ Line: () => null, OrbitControls: () => null }))

const catalog: BasesCatalog = { globals: {}, features: {} }
for (const file of readdirSync("public/bases")) {
  for (const [key, value] of Object.entries(JSON.parse(readFileSync(`public/bases/${file}`, "utf8")))) {
    if (["diamond", "libraries", "examples"].includes(key)) Object.assign(catalog.globals, { [key]: value })
    else Object.assign(catalog.features, { [key]: value })
  }
}

type SceneGroupProps = {
  name?: string
  children?: ReactNode
  onClick?: (event: ThreeEvent<MouseEvent>) => void
}

function findGroup(children: ReactNode, name: string): ReactElement<SceneGroupProps> | undefined {
  for (const child of Children.toArray(children)) {
    if (!isValidElement<SceneGroupProps>(child)) continue
    if (child.props.name === name) return child
    const nested = findGroup(child.props.children, name)
    if (nested) return nested
  }
}

function pointer(x = 20, y = 30, button = 0) {
  return { clientX: x, clientY: y, pointerId: 1, isPrimary: true, button } as ReactPointerEvent<HTMLDivElement>
}

function startGesture() {
  scene.current!.onPointerDownCapture!(pointer())
}

function finishGesture() {
  scene.current!.onPointerUpCapture!(pointer())
}

function clickGroup(name: string) {
  const group = findGroup(scene.current!.children, name)
  expect(group).toBeDefined()
  const event = {
    nativeEvent: new MouseEvent("click", { clientX: 20, clientY: 30, button: 0 }),
    stopPropagation: vi.fn(),
  } as unknown as ThreeEvent<MouseEvent>
  act(() => group!.props.onClick?.(event))
}

function clickBlank() {
  act(() => scene.current!.onPointerMissed!(new MouseEvent("click", { clientX: 20, clientY: 30, button: 0 })))
}

beforeEach(() => {
  useLaunchpadStore.getState().reset()
  useLaunchpadStore.getState().setCatalog(catalog)
  useLaunchpadStore.getState().setConfig({ baseKey: "counter", selectedAccess: ["owner"] })
})
afterEach(() => { cleanup(); scene.current = undefined })

it("selects the 3D Diamond and facet sources, with blank click clearing only graph selection", () => {
  const onSourceSelect = vi.fn()
  render(<DiamondGraph onSourceSelect={onSourceSelect} />)
  startGesture()
  finishGesture()
  clickGroup("facet:facet:CounterDataFacet")
  expect(onSourceSelect).toHaveBeenLastCalledWith("src/facets/CounterDataFacet.sol")
  expect(screen.getByText("CounterDataFacet", { exact: true })).toBeTruthy()

  startGesture()
  finishGesture()
  clickGroup("diamond-source")
  expect(onSourceSelect).toHaveBeenLastCalledWith("src/Diamond.sol")
  expect(screen.getByText("Diamond", { exact: true })).toBeTruthy()
  expect(screen.queryByText("CounterDataFacet", { exact: true })).toBeNull()

  startGesture()
  finishGesture()
  clickBlank()
  expect(screen.queryByText("Diamond", { exact: true })).toBeNull()
  expect(onSourceSelect).toHaveBeenCalledTimes(2)
})

it("does not open sources or clear selection when an orbit drag returns to its starting point", () => {
  const onSourceSelect = vi.fn()
  render(<DiamondGraph onSourceSelect={onSourceSelect} />)
  startGesture()
  finishGesture()
  clickGroup("facet:facet:CounterDataFacet")
  onSourceSelect.mockClear()

  for (const name of ["diamond-source", "facet:facet:OwnerDataFacet"]) {
    startGesture()
    scene.current!.onPointerMoveCapture!(pointer(80, 70))
    scene.current!.onPointerMoveCapture!(pointer())
    finishGesture()
    clickGroup(name)
    clickBlank()
  }
  expect(onSourceSelect).not.toHaveBeenCalled()
  expect(screen.getByText("CounterDataFacet", { exact: true })).toBeTruthy()
})

it("ignores interrupted gestures and allows the next completed click", () => {
  const onSourceSelect = vi.fn()
  render(<DiamondGraph onSourceSelect={onSourceSelect} />)
  startGesture()
  clickGroup("diamond-source")
  scene.current!.onPointerCancelCapture!(pointer())
  finishGesture()
  clickGroup("diamond-source")
  expect(onSourceSelect).not.toHaveBeenCalled()

  startGesture()
  finishGesture()
  clickGroup("diamond-source")
  expect(onSourceSelect).toHaveBeenCalledExactlyOnceWith("src/Diamond.sol")
})

it("keeps aggregate access selection local in the 3D scene", () => {
  const onSourceSelect = vi.fn()
  render(<DiamondGraph onSourceSelect={onSourceSelect} />)
  startGesture()
  finishGesture()
  clickGroup("facet:access:owner")
  expect(screen.getByText("Owner", { exact: true })).toBeTruthy()
  expect(onSourceSelect).not.toHaveBeenCalled()
})

it("does not add center source interactions to classic graph consumers", () => {
  render(<DiamondGraph />)
  expect(findGroup(scene.current!.children, "diamond-source")!.props.onClick).toBeUndefined()
  startGesture()
  finishGesture()
  clickGroup("facet:facet:CounterDataFacet")
  expect(screen.getByText("CounterDataFacet", { exact: true })).toBeTruthy()
  startGesture()
  finishGesture()
  clickBlank()
  expect(screen.queryByText("CounterDataFacet", { exact: true })).toBeNull()
})
