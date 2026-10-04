/** Three's current renderer requires WebGL 2, not only a canvas or WebGL 1. */
type WebGLProbeContext = {
  getExtension(name: "WEBGL_lose_context"): { loseContext(): void } | null;
};

type WebGLProbeCanvas = {
  getContext(contextId: "webgl2"): WebGLProbeContext | null;
};

export function canRenderWebGL2(
  createCanvas: () => WebGLProbeCanvas = () => document.createElement("canvas"),
): boolean {
  try {
    const context = createCanvas().getContext("webgl2");
    if (!context) return false;
    // The probe has no scene to render. Release its context immediately rather
    // than holding an extra GPU context alongside React Three Fiber's canvas.
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    // Browsers can reject context creation even when the WebGL API exists.
    return false;
  }
}
