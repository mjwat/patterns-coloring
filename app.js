import { generatePattern } from "./geometry.js";
import { createDefaultState, loadState, saveState } from "./state.js";
import { initUI } from "./ui.js";

window.addEventListener("load", () => {
  const canvas = document.getElementById("mainCanvas");
  const ctx = canvas?.getContext("2d");
  const exportCanvas = document.getElementById("exportCanvas");
  const exportCtx = exportCanvas?.getContext("2d");
  if (!ctx) return;

  const state = loadState() ?? createDefaultState();
  let needsUpdate = true;

  const requestRender = () => {
    needsUpdate = true;
  };

  const renderExport = () => {
    if (!exportCtx || !exportCanvas) return;
    generatePattern(exportCtx, exportCanvas, state.layers);
  };

  initUI({
    state,
    canvas,
    exportCanvas,
    requestRender,
    saveState,
    renderExport,
  });

  const renderLoop = () => {
    if (needsUpdate) {
      generatePattern(ctx, canvas, state.layers);
      needsUpdate = false;
    }
    requestAnimationFrame(renderLoop);
  };

  renderLoop();
});
