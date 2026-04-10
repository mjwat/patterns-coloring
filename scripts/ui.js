import {
  getPresetSize,
  getGroupStateKey,
  getFooterStateKey,
  getMaxLayers,
  createDefaultLayer,
  resetState,
} from "./state.js";

export const initUI = ({
  config,
  state,
  canvas,
  exportCanvas,
  requestRender,
  saveState,
  renderExport,
}) => {
  if (!canvas) return;
  const GROUP_STATE_KEY = getGroupStateKey();
  const FOOTER_STATE_KEY = getFooterStateKey();
  const MAX_LAYERS = getMaxLayers();
  const DEFAULT_ORIENTATION = config.controls.canvas.defaults.orientation;
  const GAP = config.controls.element.gap;

  const getActiveLayer = () => state.layers[state.activeLayerIndex];
  const markDirty = () => {
    scheduleRender();
    saveState(state);
  };

  const debounce = (fn, delay) => {
    let timer = null;
    return (...args) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn(...args);
      }, delay);
    };
  };

  const scheduleRender = () => {
    requestAnimationFrame(() => requestRender());
  };

  const applyControlAttributes = () => {
    const applyNode = (node, inheritedDefault) => {
      if (!node || typeof node !== "object") return;
      if (node.id) {
        const element = document.getElementById(node.id);
        if (!element) return;
        ["min", "max", "step"].forEach((key) => {
          if (node[key] !== undefined) {
            element.setAttribute(key, String(node[key]));
          }
        });
        const defaultValue =
          node.default !== undefined ? node.default : inheritedDefault;
        if (defaultValue !== undefined) {
          element.setAttribute("value", String(defaultValue));
        }
        return;
      }
      const nextDefault =
        node.default !== undefined ? node.default : inheritedDefault;
      Object.values(node).forEach((child) => applyNode(child, nextDefault));
    };
    applyNode(config.controls || {}, undefined);
  };

  const populateSelect = (id, options, selectedValue) => {
    const select = document.getElementById(id);
    if (!select || !Array.isArray(options)) return;
    select.innerHTML = "";
    options.forEach((option) => {
      const node = document.createElement("option");
      node.value = option.value;
      node.textContent = option.label;
      if (option.value === selectedValue) {
        node.selected = true;
      }
      select.appendChild(node);
    });
  };

  applyControlAttributes();
  const pagePresetOptions = Object.entries(config.controls.canvas.presets).map(
    ([value, preset]) => ({
      value,
      label: preset.label || value
    })
  );
  populateSelect(
    "pagePresetSelect",
    pagePresetOptions,
    config.controls.canvas.defaults.preset
  );
  populateSelect(
    "shapeTypeSelect",
    config.controls.element.shapeOptions,
    config.controls.element.defaults.shapeType
  );
  populateSelect(
    "exportFormat",
    config.export.formats,
    config.export.defaultFormat
  );

  const groups = document.querySelectorAll(".settings-group");
  const loadGroupStates = () => {
    try {
      const raw = localStorage.getItem(GROUP_STATE_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
  };

  const saveGroupStates = (states) => {
    localStorage.setItem(GROUP_STATE_KEY, JSON.stringify(states));
  };

  const applyGroupStates = (states) => {
    groups.forEach((group) => {
      const key = group.dataset.group;
      if (!key) return;
      if (states[key]) {
        group.classList.add("collapsed");
      } else {
        group.classList.remove("collapsed");
      }
    });
  };

  const groupStates = loadGroupStates();
  applyGroupStates(groupStates);

  groups.forEach((group) => {
    const header = group.querySelector(".group-header");
    if (!header) return;
    header.addEventListener("click", () => {
      group.classList.toggle("collapsed");
      const key = group.dataset.group;
      if (!key) return;
      groupStates[key] = group.classList.contains("collapsed");
      saveGroupStates(groupStates);
    });
  });

  const sidebarFooter = document.getElementById("sidebarFooter");
  const footerHeader = document.getElementById("footerHeader");
  const loadFooterState = () => {
    try {
      return localStorage.getItem(FOOTER_STATE_KEY) === "1";
    } catch {
      return false;
    }
  };
  const saveFooterState = (collapsed) => {
    localStorage.setItem(FOOTER_STATE_KEY, collapsed ? "1" : "0");
  };

  if (sidebarFooter) {
    const collapsed = loadFooterState();
    sidebarFooter.classList.toggle("collapsed", collapsed);
  }

  if (footerHeader && sidebarFooter) {
    footerHeader.addEventListener("click", () => {
      sidebarFooter.classList.toggle("collapsed");
      saveFooterState(sidebarFooter.classList.contains("collapsed"));
    });
  }

  const widthInput = document.getElementById("canvasWidth");
  const heightInput = document.getElementById("canvasHeight");
  const pagePresetSelect = document.getElementById("pagePresetSelect");
  const pageBackgroundColorInput = document.getElementById("pageBackgroundColor");
  const pageBackgroundEnabledInput = document.getElementById(
    "pageBackgroundEnabled"
  );
  const pageBackgroundColorControl = document.getElementById(
    "pageBackgroundColorControl"
  );
  const showGuidesInput = document.getElementById("showGuides");
  const topRuler = document.getElementById("topRuler");
  const leftRuler = document.getElementById("leftRuler");
  const widthLabel = document.getElementById("widthLabel");
  const heightLabel = document.getElementById("heightLabel");
  const getSelectedOrientation = () =>
    document.querySelector('input[name="orientation"]:checked')?.value ||
    DEFAULT_ORIENTATION;
  const getEffectiveBackgroundColor = () =>
    state.globalSettings.withoutBackground
      ? config.controls.canvas.backgroundColor.default
      : state.globalSettings.backgroundColor || config.controls.canvas.backgroundColor.default;
  const applyBackgroundModeUI = (withoutBackground) => {
    if (pageBackgroundColorControl) {
      pageBackgroundColorControl.style.display = withoutBackground
        ? "none"
        : "grid";
    }
    if (pageBackgroundEnabledInput) {
      pageBackgroundEnabledInput.checked = !withoutBackground;
    }
  };

  const RULER_SIZE = 22;
  const RULER_GAP = 10;
  const PREVIEW_TRANSITION_MS = 400;
  const MIN_PREVIEW_SIZE = 500;
  const MAX_PREVIEW_SCALE = 8;
  const MINOR_STEP = 10;
  const INTERMEDIATE_STEP = 100;
  const LABEL_STEP = 500;
  let previewScale = 1;
  let rulerSyncRafId = 0;
  let rulerSyncUntil = 0;

  const syncRulersDuringTransition = (durationMs = PREVIEW_TRANSITION_MS + 80) => {
    rulerSyncUntil = Math.max(rulerSyncUntil, performance.now() + durationMs);
    if (rulerSyncRafId) return;
    const step = () => {
      updateRulers();
      if (performance.now() < rulerSyncUntil) {
        rulerSyncRafId = requestAnimationFrame(step);
      } else {
        rulerSyncRafId = 0;
      }
    };
    rulerSyncRafId = requestAnimationFrame(step);
  };

  const updatePreviewScale = () => {
    const minCanvasSide = Math.min(canvas.width || 0, canvas.height || 0);
    let scale = 1;
    if (minCanvasSide > 0 && minCanvasSide < MIN_PREVIEW_SIZE) {
      scale = Math.min(MAX_PREVIEW_SCALE, MIN_PREVIEW_SIZE / minCanvasSide);
    }
    const previousScale = previewScale;
    previewScale = scale;
    canvas.style.transform = `scale(${scale})`;
    canvas.style.imageRendering = scale > 1 ? "pixelated" : "auto";
    if (Math.abs(previousScale - scale) > 0.001) {
      syncRulersDuringTransition();
    }
  };

  const drawHorizontalRuler = (previewWidth, canvasWidth, centerZero, rulerSize) => {
    if (!topRuler) return;
    const context = topRuler.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, previewWidth, rulerSize);
    context.fillStyle = "#f5f6f8";
    context.fillRect(0, 0, previewWidth, rulerSize);
    context.strokeStyle = "#b6bcc6";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, rulerSize - 0.5);
    context.lineTo(previewWidth, rulerSize - 0.5);
    context.stroke();

    const scaleX = canvasWidth > 0 ? previewWidth / canvasWidth : 1;
    const zeroCanvasX = centerZero ? canvasWidth / 2 : 0;
    const zeroX = zeroCanvasX * scaleX;
    const minorColor = "#98a0ad";
    const majorColor = "#4f5968";
    context.fillStyle = majorColor;
    context.font = "10px Segoe UI";
    context.textAlign = "center";
    context.textBaseline = "top";
    const minRelative = -zeroCanvasX;
    const maxRelative = canvasWidth - zeroCanvasX;
    const startRelative =
      Math.ceil(minRelative / MINOR_STEP) * MINOR_STEP;
    for (let relative = startRelative; relative <= maxRelative; relative += MINOR_STEP) {
      const canvasX = zeroCanvasX + relative;
      const x = canvasX * scaleX;
      const isIntermediate = relative % INTERMEDIATE_STEP === 0;
      const isLabel = relative % LABEL_STEP === 0;
      const tick = isIntermediate ? Math.max(8, Math.round(rulerSize * 0.64)) : Math.max(2, Math.round(rulerSize * 0.14));
      context.strokeStyle = isIntermediate ? majorColor : minorColor;
      context.lineWidth = isIntermediate ? 1.5 : 1;
      context.beginPath();
      context.moveTo(x + 0.5, rulerSize);
      context.lineTo(x + 0.5, rulerSize - tick);
      context.stroke();
      if (isLabel) {
        context.fillText(String(relative), x, 1);
      }
    }

    context.fillStyle = "#e53935";
    context.beginPath();
    context.moveTo(zeroX, rulerSize - 1);
    context.lineTo(zeroX - 4, rulerSize - 8);
    context.lineTo(zeroX + 4, rulerSize - 8);
    context.closePath();
    context.fill();
  };

  const drawVerticalRuler = (previewHeight, canvasHeight, centerZero, rulerSize) => {
    if (!leftRuler) return;
    const context = leftRuler.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, rulerSize, previewHeight);
    context.fillStyle = "#f5f6f8";
    context.fillRect(0, 0, rulerSize, previewHeight);
    context.strokeStyle = "#b6bcc6";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(rulerSize - 0.5, 0);
    context.lineTo(rulerSize - 0.5, previewHeight);
    context.stroke();

    const scaleY = canvasHeight > 0 ? previewHeight / canvasHeight : 1;
    const zeroCanvasY = centerZero ? canvasHeight / 2 : 0;
    const zeroY = zeroCanvasY * scaleY;
    const minorColor = "#98a0ad";
    const majorColor = "#4f5968";
    context.fillStyle = majorColor;
    context.font = "10px Segoe UI";
    context.textAlign = "left";
    context.textBaseline = "middle";
    const minRelative = -zeroCanvasY;
    const maxRelative = canvasHeight - zeroCanvasY;
    const startRelative =
      Math.ceil(minRelative / MINOR_STEP) * MINOR_STEP;
    for (let relative = startRelative; relative <= maxRelative; relative += MINOR_STEP) {
      const canvasY = zeroCanvasY + relative;
      const y = canvasY * scaleY;
      const isIntermediate = relative % INTERMEDIATE_STEP === 0;
      const isLabel = relative % LABEL_STEP === 0;
      const tick = isIntermediate ? Math.max(8, Math.round(rulerSize * 0.64)) : Math.max(2, Math.round(rulerSize * 0.14));
      context.strokeStyle = isIntermediate ? majorColor : minorColor;
      context.lineWidth = isIntermediate ? 1.5 : 1;
      context.beginPath();
      context.moveTo(rulerSize, y + 0.5);
      context.lineTo(rulerSize - tick, y + 0.5);
      context.stroke();
      if (isLabel) {
        context.fillText(String(relative), 2, y);
      }
    }

    context.fillStyle = "#e53935";
    context.beginPath();
    context.moveTo(rulerSize - 1, zeroY);
    context.lineTo(rulerSize - 8, zeroY - 4);
    context.lineTo(rulerSize - 8, zeroY + 4);
    context.closePath();
    context.fill();
  };

  const updateRulers = () => {
    if (!topRuler || !leftRuler || !canvas) return;
    const showGuides = state.globalSettings.showGuides !== false;
    topRuler.style.display = showGuides ? "block" : "none";
    leftRuler.style.display = showGuides ? "block" : "none";
    if (!showGuides) return;

    const canvasRect = canvas.getBoundingClientRect();
    const frameRect = canvas.parentElement?.getBoundingClientRect();
    if (!frameRect) return;
    const width = Math.max(1, Math.round(canvasRect.width));
    const height = Math.max(1, Math.round(canvasRect.height));
    const currentScale =
      canvas.width > 0 ? canvasRect.width / canvas.width : previewScale;
    const rulerSize = Math.max(20, Math.round(RULER_SIZE * currentScale));
    const rulerGap = Math.max(10, Math.round(RULER_GAP * currentScale));
    const centerZero = getActiveLayer()?.alignment === "center";

    topRuler.width = width;
    topRuler.height = rulerSize;
    topRuler.style.width = `${width}px`;
    topRuler.style.height = `${rulerSize}px`;
    topRuler.style.left = `${canvasRect.left - frameRect.left}px`;
    topRuler.style.top = `${canvasRect.top - frameRect.top - rulerSize - rulerGap}px`;

    leftRuler.width = rulerSize;
    leftRuler.height = height;
    leftRuler.style.width = `${rulerSize}px`;
    leftRuler.style.height = `${height}px`;
    leftRuler.style.left = `${canvasRect.left - frameRect.left - rulerSize - rulerGap}px`;
    leftRuler.style.top = `${canvasRect.top - frameRect.top}px`;

    drawHorizontalRuler(width, canvas.width, centerZero, rulerSize);
    drawVerticalRuler(height, canvas.height, centerZero, rulerSize);
  };

  const updateCanvasSize = () => {
    const width = Number(widthInput?.value) || canvas.width;
    const height = Number(heightInput?.value) || canvas.height;
    canvas.width = width;
    canvas.height = height;
    if (exportCanvas) {
      exportCanvas.width = width;
      exportCanvas.height = height;
    }
    if (widthLabel) widthLabel.textContent = `${width} px`;
    if (heightLabel) heightLabel.textContent = `${height} px`;
    state.globalSettings.canvasWidth = width;
    state.globalSettings.canvasHeight = height;
    updatePreviewScale();
    requestAnimationFrame(updateRulers);
    scheduleRender();
  };

  let isUpdatingOrientation = false;
  const setOrientationSelection = (value) => {
    const radio = document.querySelector(
      `input[name="orientation"][value="${value}"]`
    );
    if (!radio || radio.checked) return;
    isUpdatingOrientation = true;
    radio.checked = true;
    state.globalSettings.orientation = value;
    isUpdatingOrientation = false;
  };

  const updateOrientationRadios = () => {
    if (!widthInput || !heightInput) return;
    const width = Number(widthInput.value);
    const height = Number(heightInput.value);
    if (!width || !height) return;

    let target = null;
    if (width === height) {
      target = "square";
    } else if (width > height) {
      target = "horizontal";
    } else {
      target = "vertical";
    }

    const radio = document.querySelector(
      `input[name="orientation"][value="${target}"]`
    );
    if (radio && !radio.checked) {
      isUpdatingOrientation = true;
      radio.checked = true;
      state.globalSettings.orientation = target;
      isUpdatingOrientation = false;
    }
  };

  const setPresetSelection = (value) => {
    if (!pagePresetSelect) return;
    const hasOption = Array.from(pagePresetSelect.options).some(
      (option) => option.value === value
    );
    const nextValue = hasOption ? value : "custom";
    pagePresetSelect.value = nextValue;
    state.globalSettings.pagePreset = nextValue;
  };

  const debouncedGlobalNumber = debounce(() => {
    scheduleRender();
    saveState(state);
  }, config.debounce.inputMs);

  pageBackgroundColorInput?.addEventListener("input", () => {
    const color =
      pageBackgroundColorInput.value || config.controls.canvas.backgroundColor.default;
    state.globalSettings.backgroundColor = color;
    scheduleRender();
    saveState(state);
  });

  pageBackgroundEnabledInput?.addEventListener("change", () => {
    state.globalSettings.withoutBackground = !pageBackgroundEnabledInput.checked;
    applyBackgroundModeUI(state.globalSettings.withoutBackground);
    scheduleRender();
    saveState(state);
  });

  showGuidesInput?.addEventListener("change", () => {
    state.globalSettings.showGuides = showGuidesInput.checked;
    updateRulers();
    saveState(state);
  });

  widthInput?.addEventListener("input", () => {
    if (getSelectedOrientation() === "square" && heightInput && widthInput) {
      heightInput.value = widthInput.value;
    }
    setPresetSelection("custom");
    updateCanvasSize();
    updateOrientationRadios();
    debouncedGlobalNumber();
  });
  heightInput?.addEventListener("input", () => {
    if (getSelectedOrientation() === "square" && widthInput && heightInput) {
      widthInput.value = heightInput.value;
    }
    setPresetSelection("custom");
    updateCanvasSize();
    updateOrientationRadios();
    debouncedGlobalNumber();
  });

  const applyPreset = (presetKey) => {
    if (presetKey === "custom") {
      setPresetSelection("custom");
      return;
    }
    const presetOrientation =
      presetKey === "square"
        ? "square"
        : config.controls.canvas.defaults.presetOrientation;
    const preset = getPresetSize(
      presetKey,
      presetOrientation
    );
    if (!widthInput || !heightInput) return;
    widthInput.value = String(preset.width);
    heightInput.value = String(preset.height);
    setOrientationSelection(presetOrientation);
    setPresetSelection(presetKey);
    updateCanvasSize();
    updateOrientationRadios();
    markDirty();
  };

  const orientationRadios = document.querySelectorAll(
    'input[name="orientation"]'
  );
  orientationRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked || !widthInput || !heightInput) return;
      if (isUpdatingOrientation) return;
      state.globalSettings.orientation = radio.value;
      const presetKey = pagePresetSelect?.value || state.globalSettings.pagePreset;
      const forceCustomForSquare =
        radio.value === "square" &&
        presetKey &&
        presetKey !== "custom" &&
        presetKey !== "square";
      const forceCustomFromSquarePreset =
        presetKey === "square" && radio.value !== "square";
      const shouldForceCustom =
        forceCustomForSquare || forceCustomFromSquarePreset;

      if (presetKey && presetKey !== "custom" && !shouldForceCustom) {
        const preset = getPresetSize(presetKey, radio.value);
        widthInput.value = String(preset.width);
        heightInput.value = String(preset.height);
        setPresetSelection(presetKey);
      } else {
        const currentWidth = Number(widthInput.value);
        const currentHeight = Number(heightInput.value);
        if (radio.value === "square") {
          const side = Math.max(currentWidth, currentHeight);
          widthInput.value = String(side);
          heightInput.value = String(side);
        } else if (currentWidth === currentHeight) {
          if (radio.value === "horizontal") {
            widthInput.value = String(currentWidth + 1);
          } else if (radio.value === "vertical") {
            heightInput.value = String(currentHeight + 1);
          }
        } else if (
          radio.value === "horizontal" &&
          currentWidth < currentHeight
        ) {
          widthInput.value = String(currentHeight);
          heightInput.value = String(currentWidth);
        } else if (
          radio.value === "vertical" &&
          currentHeight < currentWidth
        ) {
          widthInput.value = String(currentHeight);
          heightInput.value = String(currentWidth);
        }
        setPresetSelection("custom");
      }
      updateCanvasSize();
      updateOrientationRadios();
      markDirty();
    });
  });

  pagePresetSelect?.addEventListener("change", () => {
    const value = pagePresetSelect.value || "custom";
    applyPreset(value);
  });

  const setRadioValue = (name, value) => {
    const radio = document.querySelector(
      `input[name="${name}"][value="${value}"]`
    );
    if (radio) radio.checked = true;
  };

  const setLinkedValue = (rangeId, numberId, value) => {
    const range = document.getElementById(rangeId);
    const number = document.getElementById(numberId);
    if (range) range.value = String(value);
    if (number) number.value = String(value);
  };

  const clampValue = (value, min, max) => Math.min(max, Math.max(min, value));

  const bindLinkedInputs = (rangeId, numberId, key) => {
    const range = document.getElementById(rangeId);
    const number = document.getElementById(numberId);
    if (!range || !number) return;

    const debouncedRange = debounce(() => {
      scheduleRender();
      saveState(state);
    }, config.debounce.rangeMs);

    const debouncedNumber = debounce(() => {
      scheduleRender();
      saveState(state);
    }, config.debounce.inputMs);

    const updateValue = (value, source) => {
      const numericValue = Number(value);
      if (Number.isNaN(numericValue)) return;
      const min = Number(source?.min);
      const max = Number(source?.max);
      const clamped =
        Number.isFinite(min) && Number.isFinite(max)
          ? clampValue(numericValue, min, max)
          : numericValue;
      range.value = String(clamped);
      number.value = String(clamped);
      const layer = getActiveLayer();
      if (!layer) return;
      layer[key] = clamped;
    };

    range.addEventListener("input", () => {
      updateValue(range.value, range);
      debouncedRange();
    });
    number.addEventListener("input", () => {
      updateValue(number.value, number);
      debouncedNumber();
    });
  };

  const bindRadioGroup = (name, key) => {
    const radios = document.querySelectorAll(`input[name="${name}"]`);
    if (!radios.length) return;
    radios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (radio.checked) {
          const layer = getActiveLayer();
          if (!layer) return;
          layer[key] = radio.value;
          scheduleRender();
          saveState(state);
        }
      });
    });
  };

  bindLinkedInputs("sizeRange", "sizeNumber", "size");
  bindLinkedInputs("widthRange", "widthNumber", "width");
  bindLinkedInputs("heightRange", "heightNumber", "height");
  bindLinkedInputs("gapXRange", "gapXNumber", "gapX");
  bindLinkedInputs("gapYRange", "gapYNumber", "gapY");
  bindLinkedInputs("innerRadiusRange", "innerRadiusNumber", "innerRadius");
  bindLinkedInputs("weightRange", "weightNumber", "weight");
  bindLinkedInputs("offsetXRange", "offsetXNumber", "offsetX");
  bindLinkedInputs("offsetYRange", "offsetYNumber", "offsetY");
  bindLinkedInputs("shapeRotationRange", "shapeRotationNumber", "shapeRotation");
  bindLinkedInputs(
    "patternRotationRange",
    "patternRotationNumber",
    "patternRotation"
  );

  const strokeColorInput = document.getElementById("strokeColor");
  const fillEnabledInput = document.getElementById("fillEnabled");
  const fillColorInput = document.getElementById("fillColor");
  const fillColorControl = document.getElementById("fillColorControl");
  const updateFillControls = (enabled) => {
    if (fillColorControl) {
      fillColorControl.style.display = enabled ? "grid" : "none";
    }
  };
  const applyStrokeColor = (hex) => {
    const layer = getActiveLayer();
    if (!layer) return;
    layer.strokeColor = hex;
    if (strokeColorInput) strokeColorInput.value = hex;
    scheduleRender();
    saveState(state);
  };

  if (strokeColorInput) {
    strokeColorInput.addEventListener("input", () => {
      applyStrokeColor(
        strokeColorInput.value || config.controls.element.strokeColor.default
      );
    });
  }

  if (fillEnabledInput) {
    fillEnabledInput.addEventListener("change", () => {
      const layer = getActiveLayer();
      if (!layer) return;
      layer.fill = fillEnabledInput.checked;
      updateFillControls(layer.fill);
      scheduleRender();
      saveState(state);
    });
  }

  if (fillColorInput) {
    fillColorInput.addEventListener("input", () => {
      const layer = getActiveLayer();
      if (!layer) return;
      layer.fillColor =
        fillColorInput.value || config.controls.element.fillColor.default;
      scheduleRender();
      saveState(state);
    });
  }

  bindRadioGroup("alignment", "alignment");
  bindRadioGroup("layoutStyle", "layoutStyle");
  bindRadioGroup("gridAnchor", "gridAnchor");

  const shapeTypeSelect = document.getElementById("shapeTypeSelect");
  const sizeControl = document.getElementById("sizeControl");
  const widthControl = document.getElementById("widthControl");
  const heightControl = document.getElementById("heightControl");
  const gapXControl = document.getElementById("gapXControl");
  const gapYControl = document.getElementById("gapYControl");
  const sizeLabel = document.querySelector('label[for="sizeRange"]');
  const gapXLabel = document.getElementById("gapXLabel");
  const gapYLabel = document.getElementById("gapYLabel");
  const gapYUnit = document.getElementById("gapYUnit");
  const innerRadiusControl = document.getElementById("innerRadiusControl");
  const shapeRotationControl = document.getElementById("shapeRotationControl");
  const alignToRadiusControl = document.getElementById("alignToRadiusControl");
  const alignToRadiusInput = document.getElementById("alignToRadius");
  const gridAnchorControl = document.getElementById("gridAnchorControl");
  const elementGroupBody = document.querySelector(
    '[data-group="element"] .group-body'
  );

  const applyGapLimits = (shapeType, baseGeometry) => {
    const isLine = shapeType === "line";
    const isRadial = baseGeometry === "radial";
    const updateLimits = (rangeId, numberId, rangeMin, rangeMax, numberMin, numberMax) => {
      const range = document.getElementById(rangeId);
      const number = document.getElementById(numberId);
      if (range) {
        range.min = String(rangeMin);
        range.max = String(rangeMax);
      }
      if (number) {
        number.min = String(numberMin);
        number.max = String(numberMax);
      }
      const layer = getActiveLayer();
      if (!layer) return;
      const key = rangeId === "gapXRange" ? "gapX" : "gapY";
      const clamped = clampValue(Number(layer[key]), numberMin, numberMax);
      layer[key] = clamped;
      setLinkedValue(rangeId, numberId, clamped);
    };
    const gapXLimits = isRadial
      ? GAP.x.radial
      : isLine
        ? GAP.x.line
        : GAP.x.grid;
    const gapYLimits = isRadial
      ? GAP.y.radial
      : isLine
        ? GAP.y.line
        : GAP.y.grid;

    updateLimits(
      "gapXRange",
      "gapXNumber",
      gapXLimits.rangeMin,
      gapXLimits.rangeMax,
      gapXLimits.numberMin,
      gapXLimits.numberMax
    );

    updateLimits(
      "gapYRange",
      "gapYNumber",
      gapYLimits.rangeMin,
      gapYLimits.rangeMax,
      gapYLimits.numberMin,
      gapYLimits.numberMax
    );
  };

  const updateGridAnchorControl = (layer) => {
    if (!gridAnchorControl || !layer) return;
    const showControl =
      layer.alignment === "center" &&
      layer.baseGeometry === "grid" &&
      layer.layoutStyle === "straight";
    gridAnchorControl.style.display = showControl ? "grid" : "none";
  };

  const updatePatternModeControls = (layer) => {
    if (!layer) return;
    const isRadial = layer.baseGeometry === "radial";
    if (gapXLabel) {
      gapXLabel.textContent = isRadial ? "Ring Spacing" : "Gap X";
    }
    if (gapYLabel) {
      gapYLabel.textContent = isRadial ? "Items per Ring" : "Gap Y";
    }
    if (gapYUnit) {
      gapYUnit.textContent = isRadial ? "items" : "px";
    }
    if (innerRadiusControl) {
      innerRadiusControl.style.display = isRadial ? "block" : "none";
    }
    if (alignToRadiusControl) {
      alignToRadiusControl.style.display = isRadial ? "block" : "none";
    }
    if (alignToRadiusInput) {
      alignToRadiusInput.checked = layer.alignToRadius === true;
    }
    updateGridAnchorControl(layer);

    if (
      elementGroupBody &&
      gapXControl &&
      gapYControl &&
      innerRadiusControl &&
      shapeRotationControl
    ) {
      if (isRadial) {
        // Radial order: Items per Ring, Inner Radius, Ring Spacing, Shape Rotation.
        elementGroupBody.insertBefore(gapYControl, shapeRotationControl);
        elementGroupBody.insertBefore(innerRadiusControl, shapeRotationControl);
        elementGroupBody.insertBefore(gapXControl, shapeRotationControl);
      } else {
        // Default order: Gap X, Gap Y, Inner Radius (hidden), Shape Rotation.
        elementGroupBody.insertBefore(gapXControl, gapYControl);
        elementGroupBody.insertBefore(gapYControl, innerRadiusControl);
        elementGroupBody.insertBefore(innerRadiusControl, shapeRotationControl);
      }
    }

    applyGapLimits(layer.shapeType, layer.baseGeometry);
  };

  const updateShapeControls = (shapeType) => {
    const isRect = shapeType === "rectangle" || shapeType === "oval";
    if (sizeControl) sizeControl.style.display = isRect ? "none" : "block";
    if (widthControl) widthControl.style.display = isRect ? "block" : "none";
    if (heightControl) heightControl.style.display = isRect ? "block" : "none";
    if (sizeLabel) {
      sizeLabel.textContent = shapeType === "line" ? "Length" : "Size";
    }
    const layer = getActiveLayer();
    applyGapLimits(shapeType, layer?.baseGeometry || "grid");
  };

  if (shapeTypeSelect) {
    shapeTypeSelect.addEventListener("change", () => {
      const layer = getActiveLayer();
      if (!layer) return;
      layer.shapeType = shapeTypeSelect.value;
      updateShapeControls(layer.shapeType);
      updatePatternModeControls(layer);
      scheduleRender();
      saveState(state);
    });
  }

  if (alignToRadiusInput) {
    alignToRadiusInput.addEventListener("change", () => {
      const layer = getActiveLayer();
      if (!layer) return;
      layer.alignToRadius = alignToRadiusInput.checked;
      scheduleRender();
      saveState(state);
    });
  }

  const refreshAnchorVisibilityFromRadios = () => {
    const layer = getActiveLayer();
    if (!layer) return;
    layer.alignment =
      document.querySelector('input[name="alignment"]:checked')?.value ||
      layer.alignment;
    layer.layoutStyle =
      document.querySelector('input[name="layoutStyle"]:checked')?.value ||
      layer.layoutStyle;
    layer.baseGeometry =
      document.querySelector('input[name="baseGeometry"]:checked')?.value ||
      layer.baseGeometry;
    updateGridAnchorControl(layer);
    updateRulers();
  };

  document.querySelectorAll('input[name="alignment"]').forEach((radio) => {
    radio.addEventListener("change", refreshAnchorVisibilityFromRadios);
  });
  document.querySelectorAll('input[name="layoutStyle"]').forEach((radio) => {
    radio.addEventListener("change", refreshAnchorVisibilityFromRadios);
  });

  const baseGeometryRadios = document.querySelectorAll(
    'input[name="baseGeometry"]'
  );
  baseGeometryRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      const layer = getActiveLayer();
      if (!layer) return;
      const previousGeometry = layer.baseGeometry;
      layer.baseGeometry = radio.value;
      if (layer.baseGeometry === "radial" && previousGeometry !== "radial") {
        if (!Number.isFinite(Number(layer.gapX))) {
          layer.gapX = config.controls.element.gap.x.radial.default;
        }
        if (
          !Number.isFinite(Number(layer.gapY)) ||
          Number(layer.gapY) === config.controls.element.gap.y.grid.default
        ) {
          layer.gapY = config.controls.element.gap.y.radial.default;
        }
        if (!Number.isFinite(Number(layer.innerRadius))) {
          layer.innerRadius = config.controls.element.radial.innerRadius.default;
        }
      }
      if (layer.baseGeometry !== "radial") {
        layer.alignToRadius = true;
      }
      if (!Number.isFinite(Number(layer.innerRadius))) {
        layer.innerRadius = config.controls.element.radial.innerRadius.default;
      }
      updatePatternModeControls(layer);
      updateRulers();
      scheduleRender();
      saveState(state);
    });
  });

  const layersList = document.getElementById("layersList");
  const addLayerButton = document.getElementById("addLayer");
  const layerIdByRef = new WeakMap();
  let nextLayerDomId = 1;

  const getLayerDomId = (layer) => {
    if (!layerIdByRef.has(layer)) {
      layerIdByRef.set(layer, String(nextLayerDomId));
      nextLayerDomId += 1;
    }
    return layerIdByRef.get(layer);
  };

  const duplicateLayer = (index) => {
    if (state.layers.length >= MAX_LAYERS) return;
    const source = state.layers[index];
    if (!source) return;
    const clone = {
      ...source,
      name: `${source.name} ${config.layers.copySuffix}`,
    };
    state.layers.splice(index + 1, 0, clone);
    state.activeLayerIndex = index + 1;
    renderLayerList();
    applySettingsToUI();
    saveState(state);
    scheduleRender();
  };

  const renderLayerList = () => {
    if (!layersList) return;
    const previousPositions = new Map();
    layersList.querySelectorAll(".layer-item[data-layer-id]").forEach((node) => {
      previousPositions.set(node.dataset.layerId, node.getBoundingClientRect().top);
    });
    layersList.innerHTML = "";
    state.layers.forEach((layer, index) => {
      const item = document.createElement("div");
      item.className = "layer-item";
      item.dataset.layerId = getLayerDomId(layer);
      if (index === state.activeLayerIndex) {
        item.classList.add("active");
      }

      const reorder = document.createElement("div");
      reorder.className = "layer-actions";

      const upButton = document.createElement("button");
      upButton.className = "layer-action";
      upButton.type = "button";
      upButton.textContent = "↑";
      upButton.disabled = index === 0;
      upButton.addEventListener("click", (event) => {
        event.stopPropagation();
        if (index === 0) return;
        const temp = state.layers[index - 1];
        state.layers[index - 1] = state.layers[index];
        state.layers[index] = temp;
        if (state.activeLayerIndex === index) {
          state.activeLayerIndex = index - 1;
        } else if (state.activeLayerIndex === index - 1) {
          state.activeLayerIndex = index;
        }
        renderLayerList();
        saveState(state);
        scheduleRender();
      });

      const downButton = document.createElement("button");
      downButton.className = "layer-action";
      downButton.type = "button";
      downButton.textContent = "↓";
      downButton.disabled = index === state.layers.length - 1;
      downButton.addEventListener("click", (event) => {
        event.stopPropagation();
        if (index === state.layers.length - 1) return;
        const temp = state.layers[index + 1];
        state.layers[index + 1] = state.layers[index];
        state.layers[index] = temp;
        if (state.activeLayerIndex === index) {
          state.activeLayerIndex = index + 1;
        } else if (state.activeLayerIndex === index + 1) {
          state.activeLayerIndex = index;
        }
        renderLayerList();
        saveState(state);
        scheduleRender();
      });

      reorder.appendChild(upButton);
      reorder.appendChild(downButton);

      const renameButton = document.createElement("button");
      renameButton.className = "layer-rename";
      renameButton.type = "button";
      renameButton.textContent = "✎";

      const nameContainer = document.createElement("div");
      nameContainer.className = "layer-name-container";

      const nameDisplay = document.createElement("span");
      nameDisplay.className = "layer-name";
      nameDisplay.textContent =
        layer.name || `${config.layers.defaultNamePrefix} ${index + 1}`;

      const nameInput = document.createElement("input");
      nameInput.className = "layer-name-input";
      nameInput.type = "text";
      nameInput.value =
        layer.name || `${config.layers.defaultNamePrefix} ${index + 1}`;
      nameInput.style.display = "none";
      nameContainer.appendChild(nameDisplay);
      nameContainer.appendChild(nameInput);

      const finishRename = () => {
        const nextName =
          nameInput.value.trim() ||
          `${config.layers.defaultNamePrefix} ${index + 1}`;
        layer.name = nextName;
        nameDisplay.textContent = nextName;
        nameInput.style.display = "none";
        nameDisplay.style.display = "inline";
        saveState(state);
      };

      renameButton.addEventListener("click", (event) => {
        event.stopPropagation();
        nameInput.value =
          layer.name || `${config.layers.defaultNamePrefix} ${index + 1}`;
        nameDisplay.style.display = "none";
        nameInput.style.display = "inline";
        nameInput.focus();
        nameInput.select();
      });

      nameInput.addEventListener("click", (event) => {
        event.stopPropagation();
      });

      nameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          finishRename();
        }
      });

      nameInput.addEventListener("blur", () => {
        finishRename();
      });

      const duplicateButton = document.createElement("button");
      duplicateButton.className = "layer-duplicate";
      duplicateButton.type = "button";
      const duplicateIcon = document.createElement("img");
      duplicateIcon.src = "icons/duplicate.png";
      duplicateIcon.alt = config.layers.copySuffix;
      duplicateButton.appendChild(duplicateIcon);
      duplicateButton.addEventListener("click", (event) => {
        event.stopPropagation();
        duplicateLayer(index);
      });

      const visibilityButton = document.createElement("button");
      visibilityButton.className = "layer-visibility";
      visibilityButton.type = "button";
      const visibilityIcon = document.createElement("img");
      visibilityIcon.src =
        layer.visible === false ? "icons/hide.png" : "icons/show.png";
      visibilityIcon.alt = layer.visible === false ? "Hide" : "Show";
      visibilityButton.appendChild(visibilityIcon);
      if (layer.visible === false) visibilityButton.classList.add("is-hidden");
      visibilityButton.addEventListener("click", (event) => {
        event.stopPropagation();
        layer.visible = !layer.visible;
        renderLayerList();
        saveState(state);
        scheduleRender();
      });

      item.appendChild(reorder);
      item.appendChild(renameButton);
      item.appendChild(duplicateButton);
      item.appendChild(visibilityButton);
      item.appendChild(nameContainer);

      if (index > 0) {
        const deleteButton = document.createElement("button");
        deleteButton.className = "layer-delete";
        deleteButton.type = "button";
        deleteButton.textContent = "×";
        deleteButton.addEventListener("click", (event) => {
          event.stopPropagation();
          state.layers.splice(index, 1);
          if (state.activeLayerIndex >= state.layers.length) {
            state.activeLayerIndex = state.layers.length - 1;
          }
          renderLayerList();
          applySettingsToUI();
          saveState(state);
          scheduleRender();
        });
        item.appendChild(deleteButton);
      }

      item.addEventListener("click", () => {
        setActiveLayer(index);
      });

      layersList.appendChild(item);
    });

    if (addLayerButton) {
      if (state.layers.length < MAX_LAYERS) {
        addLayerButton.style.display = "block";
        addLayerButton.disabled = false;
      } else {
        addLayerButton.style.display = "block";
        addLayerButton.disabled = true;
      }
    }
    requestAnimationFrame(() => {
      layersList.querySelectorAll(".layer-item[data-layer-id]").forEach((node) => {
        const previousTop = previousPositions.get(node.dataset.layerId);
        if (previousTop === undefined) return;
        const currentTop = node.getBoundingClientRect().top;
        const deltaY = previousTop - currentTop;
        if (Math.abs(deltaY) < 1) return;
        node.animate(
          [
            { transform: `translateY(${deltaY}px)` },
            { transform: "translateY(0)" }
          ],
          {
            duration: 280,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)"
          }
        );
      });
    });
  };

  const syncLayerFromInputs = (layer) => {
    if (!layer) return;
    const getValue = (id) => document.getElementById(id)?.value;
    const setNumber = (id, setter) => {
      const raw = Number(getValue(id));
      if (!Number.isNaN(raw)) setter(raw);
    };
    layer.shapeType = shapeTypeSelect?.value || layer.shapeType;
    layer.baseGeometry =
      document.querySelector('input[name="baseGeometry"]:checked')?.value ||
      layer.baseGeometry;
    layer.layoutStyle =
      document.querySelector('input[name="layoutStyle"]:checked')?.value ||
      layer.layoutStyle;
    layer.alignment =
      document.querySelector('input[name="alignment"]:checked')?.value ||
      layer.alignment;
    layer.gridAnchor =
      document.querySelector('input[name="gridAnchor"]:checked')?.value ||
      layer.gridAnchor ||
      "element";
    setNumber("sizeNumber", (value) => {
      layer.size = value;
    });
    setNumber("widthNumber", (value) => {
      layer.width = value;
    });
    setNumber("heightNumber", (value) => {
      layer.height = value;
    });
    setNumber("offsetXNumber", (value) => {
      layer.offsetX = value;
    });
    setNumber("offsetYNumber", (value) => {
      layer.offsetY = value;
    });
    setNumber("gapXNumber", (value) => {
      layer.gapX = value;
    });
    setNumber("gapYNumber", (value) => {
      layer.gapY = value;
    });
    setNumber("innerRadiusNumber", (value) => {
      layer.innerRadius = value;
    });
    setNumber("weightNumber", (value) => {
      layer.weight = value;
    });
    setNumber("shapeRotationNumber", (value) => {
      layer.shapeRotation = value;
    });
    setNumber("patternRotationNumber", (value) => {
      layer.patternRotation = value;
    });
    layer.fill = fillEnabledInput?.checked ?? layer.fill;
    layer.fillColor = fillColorInput?.value || layer.fillColor;
    layer.alignToRadius = alignToRadiusInput?.checked ?? layer.alignToRadius;
    if (layer.baseGeometry === "radial") {
      const radialLimits = {
        x: config.controls.element.gap.x.radial,
        y: config.controls.element.gap.y.radial
      };
      layer.gapX = clampValue(
        Number(layer.gapX) || config.controls.element.gap.x.radial.default,
        radialLimits.x.numberMin,
        radialLimits.x.numberMax
      );
      layer.gapY = clampValue(
        Number(layer.gapY) || config.controls.element.gap.y.radial.default,
        radialLimits.y.numberMin,
        radialLimits.y.numberMax
      );
      layer.innerRadius = clampValue(
        Number(layer.innerRadius) || config.controls.element.radial.innerRadius.default,
        config.controls.element.radial.innerRadius.number.min,
        config.controls.element.radial.innerRadius.number.max
      );
    }
    layer.strokeColor = getValue("strokeColor") || layer.strokeColor;
  };

  const setActiveLayer = (index) => {
    if (index === state.activeLayerIndex) return;
    const currentLayer = getActiveLayer();
    syncLayerFromInputs(currentLayer);
    state.activeLayerIndex = index;
    renderLayerList();
    applySettingsToUI();
    saveState(state);
    scheduleRender();
  };

  if (addLayerButton) {
    addLayerButton.addEventListener("click", () => {
      if (state.layers.length >= MAX_LAYERS) return;
      state.layers.push({
        ...createDefaultLayer(),
        name: `${config.layers.defaultNamePrefix} ${state.layers.length + 1}`,
      });
      state.activeLayerIndex = state.layers.length - 1;
      renderLayerList();
      applySettingsToUI();
      saveState(state);
      scheduleRender();
    });
  }

  const applySettingsToUI = () => {
    if (widthInput) widthInput.value = String(state.globalSettings.canvasWidth);
    if (heightInput) heightInput.value = String(state.globalSettings.canvasHeight);
    if (pageBackgroundColorInput) {
      pageBackgroundColorInput.value =
        state.globalSettings.backgroundColor || config.controls.canvas.backgroundColor.default;
    }
    if (showGuidesInput) {
      showGuidesInput.checked = state.globalSettings.showGuides !== false;
    }
    applyBackgroundModeUI(state.globalSettings.withoutBackground);
    setPresetSelection(state.globalSettings.pagePreset);
    setRadioValue("orientation", state.globalSettings.orientation);

    const layer = getActiveLayer();
    if (layer) {
      if (shapeTypeSelect) shapeTypeSelect.value = layer.shapeType;
      updateShapeControls(layer.shapeType);
      setRadioValue("baseGeometry", layer.baseGeometry);
      setRadioValue("layoutStyle", layer.layoutStyle);
      setRadioValue("alignment", layer.alignment);
      setRadioValue("gridAnchor", layer.gridAnchor || "element");
      setLinkedValue("sizeRange", "sizeNumber", layer.size);
      setLinkedValue("widthRange", "widthNumber", layer.width);
      setLinkedValue("heightRange", "heightNumber", layer.height);
      setLinkedValue("offsetXRange", "offsetXNumber", layer.offsetX);
      setLinkedValue("offsetYRange", "offsetYNumber", layer.offsetY);
      setLinkedValue("gapXRange", "gapXNumber", layer.gapX);
      setLinkedValue("gapYRange", "gapYNumber", layer.gapY);
      setLinkedValue("innerRadiusRange", "innerRadiusNumber", layer.innerRadius);
      setLinkedValue("weightRange", "weightNumber", layer.weight);
      setLinkedValue(
        "shapeRotationRange",
        "shapeRotationNumber",
        layer.shapeRotation
      );
      setLinkedValue(
        "patternRotationRange",
        "patternRotationNumber",
        layer.patternRotation
      );
      if (strokeColorInput) strokeColorInput.value = layer.strokeColor;
      if (fillEnabledInput) fillEnabledInput.checked = Boolean(layer.fill);
      if (fillColorInput) {
        fillColorInput.value =
          layer.fillColor || config.controls.element.fillColor.default;
      }
      updateFillControls(Boolean(layer.fill));
      if (alignToRadiusInput) {
        alignToRadiusInput.checked = layer.alignToRadius === true;
      }
      updatePatternModeControls(layer);
    }
    updateCanvasSize();
    updateOrientationRadios();
    updateRulers();
  };

  window.addEventListener("resize", updateRulers);
  canvas.addEventListener("transitionrun", (event) => {
    if (event.propertyName === "transform") {
      syncRulersDuringTransition();
    }
  });
  canvas.addEventListener("transitionend", (event) => {
    if (event.propertyName === "transform") {
      updateRulers();
    }
  });

  const resetButton = document.getElementById("resetDefaults");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      const fresh = resetState();
      state.globalSettings = fresh.globalSettings;
      state.layers = fresh.layers;
      state.activeLayerIndex = fresh.activeLayerIndex;
      applySettingsToUI();
      renderLayerList();
      saveState(state);
      scheduleRender();
    });
  }

  const downloadImage = () => {
    const downloadBlob = (blob, filename) => {
      const url = URL.createObjectURL(blob);
      const tempLink = document.createElement("a");
      tempLink.download = filename;
      tempLink.href = url;
      tempLink.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const dataUrlToBytes = (dataUrl) => {
      const base64 = dataUrl.split(",")[1] || "";
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    };

    const buildPdfFromJpeg = (jpegBytes, imageWidthPx, imageHeightPx) => {
      const encoder = new TextEncoder();
      const chunks = [];
      let offset = 0;
      const objectOffsets = [];

      const appendText = (text) => {
        const bytes = encoder.encode(text);
        chunks.push(bytes);
        offset += bytes.length;
      };
      const appendBytes = (bytes) => {
        chunks.push(bytes);
        offset += bytes.length;
      };

      const pointsPerPx = config.export.pdfPointsPerPx;
      const pageWidth = Math.max(1, Math.round(imageWidthPx * pointsPerPx));
      const pageHeight = Math.max(1, Math.round(imageHeightPx * pointsPerPx));

      appendText("%PDF-1.4\n");

      objectOffsets[1] = offset;
      appendText("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

      objectOffsets[2] = offset;
      appendText("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

      objectOffsets[3] = offset;
      appendText(
        `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
      );

      objectOffsets[4] = offset;
      appendText(
        `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidthPx} /Height ${imageHeightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
      );
      appendBytes(jpegBytes);
      appendText("\nendstream\nendobj\n");

      const contentStream = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`;
      const contentBytes = encoder.encode(contentStream);
      objectOffsets[5] = offset;
      appendText(`5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
      appendBytes(contentBytes);
      appendText("endstream\nendobj\n");

      const xrefOffset = offset;
      appendText("xref\n0 6\n");
      appendText("0000000000 65535 f \n");
      for (let i = 1; i <= 5; i += 1) {
        appendText(`${String(objectOffsets[i]).padStart(10, "0")} 00000 n \n`);
      }
      appendText(
        `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
      );

      return new Blob(chunks, { type: "application/pdf" });
    };

    const link = document.createElement("a");
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    const timestamp = `${now.getFullYear()}-${pad(
      now.getMonth() + 1
    )}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(
      now.getMinutes()
    )}-${pad(now.getSeconds())}`;
    const exportFormat =
      document.getElementById("exportFormat")?.value || config.export.defaultFormat;
    const exportBackgroundOverride =
      exportFormat === "png" && state.globalSettings.withoutBackground
        ? null
        : getEffectiveBackgroundColor();
    if (renderExport) renderExport(exportBackgroundOverride);
    const targetCanvas = exportCanvas || canvas;
    const createBackgroundCanvas = (sourceCanvas, fillColor) => {
      const flattenedCanvas = document.createElement("canvas");
      flattenedCanvas.width = sourceCanvas.width;
      flattenedCanvas.height = sourceCanvas.height;
      const flattenedCtx = flattenedCanvas.getContext("2d");
      if (flattenedCtx) {
        flattenedCtx.fillStyle =
          fillColor || config.controls.canvas.backgroundColor.default;
        flattenedCtx.fillRect(
          0,
          0,
          flattenedCanvas.width,
          flattenedCanvas.height
        );
        flattenedCtx.drawImage(sourceCanvas, 0, 0);
      }
      return flattenedCanvas;
    };

    if (exportFormat === "pdf") {
      const flattenedCanvas = createBackgroundCanvas(
        targetCanvas,
        getEffectiveBackgroundColor()
      );
      const jpegDataUrl = flattenedCanvas.toDataURL(
        "image/jpeg",
        config.export.jpgQuality
      );
      const jpegBytes = dataUrlToBytes(jpegDataUrl);
      const pdfBlob = buildPdfFromJpeg(
        jpegBytes,
        targetCanvas.width,
        targetCanvas.height
      );
      downloadBlob(pdfBlob, `coloring-page_${timestamp}.pdf`);
      return;
    }
    const isJpg = exportFormat === "jpg";
    const mime = isJpg ? "image/jpeg" : "image/png";
    const ext = isJpg ? "jpg" : "png";
    link.download = `coloring-page_${timestamp}.${ext}`;
    if (isJpg) {
      const flattenedCanvas = createBackgroundCanvas(
        targetCanvas,
        getEffectiveBackgroundColor()
      );
      link.href = flattenedCanvas.toDataURL(
        "image/jpeg",
        config.export.jpgQuality
      );
    } else {
      link.href = targetCanvas.toDataURL(mime, undefined);
    }
    link.click();
  };

  const downloadButton = document.getElementById("downloadImage");
  if (downloadButton) {
    downloadButton.addEventListener("click", downloadImage);
  }

  renderLayerList();
  applySettingsToUI();
  updateShapeControls(getActiveLayer()?.shapeType || "circle");
  scheduleRender();
};
