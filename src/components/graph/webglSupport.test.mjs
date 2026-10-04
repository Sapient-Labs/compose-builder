import assert from "node:assert/strict";
import test from "node:test";
import { canRenderWebGL2 } from "./webglSupport.ts";

test("requires WebGL 2 and releases a successful probe", () => {
  const calls = [];
  const available = canRenderWebGL2(() => ({
    getContext(kind) {
      calls.push(kind);
      return {
        getExtension(name) {
          calls.push(name);
          return { loseContext() { calls.push("released"); } };
        },
      };
    },
  }));
  assert.equal(available, true);
  assert.deepEqual(calls, ["webgl2", "WEBGL_lose_context", "released"]);
});

test("accepts WebGL 2 without the optional context-release extension", () => {
  assert.equal(canRenderWebGL2(() => ({
    getContext: () => ({ getExtension: () => null }),
  })), true);
});

test("uses the fallback when WebGL 2 is unavailable", () => {
  assert.equal(canRenderWebGL2(() => ({ getContext: () => null })), false);
});

test("uses the fallback when the browser refuses context creation", () => {
  assert.equal(canRenderWebGL2(() => ({
    getContext() { throw new Error("Context blocked"); },
  })), false);
});

test("is safe when a canvas cannot be created", () => {
  assert.equal(canRenderWebGL2(() => {
    throw new Error("No document");
  }), false);
});
