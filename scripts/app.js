import { generatePattern } from "./geometry.js";
import { loadConfig } from "./configLoader.js";
import { createDefaultState, initStateConfig, loadState, saveState } from "./state.js";
import { initUI } from "./ui.js";

window.addEventListener("load", () => {
  const boot = async () => {
    const config = await loadConfig();
    if (!config) {
      console.error("[app] Configuration is unavailable. Application startup aborted.");
      return;
    }
    initStateConfig(config);

    const canvas = document.getElementById("mainCanvas");
    const ctx = canvas?.getContext("2d");
    const exportCanvas = document.getElementById("exportCanvas");
    const exportCtx = exportCanvas?.getContext("2d");
    if (!ctx) return;

    const state = loadState() ?? createDefaultState();
    let needsUpdate = true;
    const getEffectiveBackgroundColor = () =>
      state.globalSettings.withoutBackground
        ? config.controls.canvas.backgroundColor.default
        : state.globalSettings.backgroundColor || config.controls.canvas.backgroundColor.default;

    const requestRender = () => {
      needsUpdate = true;
    };

    const renderExport = (backgroundColorOverride) => {
      if (!exportCtx || !exportCanvas) return;
      const backgroundColor =
        backgroundColorOverride === undefined
          ? getEffectiveBackgroundColor()
          : backgroundColorOverride;
      generatePattern(
        exportCtx,
        exportCanvas,
        state.layers,
        backgroundColor,
        config
      );
    };

    initUI({
      config,
      state,
      canvas,
      exportCanvas,
      requestRender,
      saveState,
      renderExport
    });

    const renderLoop = () => {
      if (needsUpdate) {
        generatePattern(
          ctx,
          canvas,
          state.layers,
          getEffectiveBackgroundColor(),
          config
        );
        needsUpdate = false;
      }
      requestAnimationFrame(renderLoop);
    };

    renderLoop();
  };

  boot();
});
