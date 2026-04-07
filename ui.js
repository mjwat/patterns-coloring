import {
  GROUP_STATE_KEY,
  DEFAULT_PRESET,
  DEFAULT_ORIENTATION,
  MAX_LAYERS,
  getPresetSize,
  createDefaultLayer,
  resetState,
} from "./state.js";

export const initUI = ({
  state,
  canvas,
  exportCanvas,
  requestRender,
  saveState,
  renderExport,
}) => {
  if (!canvas) return;
  const FOOTER_STATE_KEY = "patternFooterCollapsed";

  const getActiveLayer = () => state.layers[state.activeLayerIndex];
  // Current debounce: 100ms (sliders), 400ms (number/text)
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
  const pageBackgroundColorControl = document.getElementById(
    "pageBackgroundColorControl"
  );
  const pageBackgroundModeRadios = document.querySelectorAll(
    'input[name="pageBackgroundMode"]'
  );
  const widthLabel = document.getElementById("widthLabel");
  const heightLabel = document.getElementById("heightLabel");
  const getSelectedOrientation = () =>
    document.querySelector('input[name="orientation"]:checked')?.value ||
    DEFAULT_ORIENTATION;
  const getEffectiveBackgroundColor = () =>
    state.globalSettings.withoutBackground
      ? "#ffffff"
      : state.globalSettings.backgroundColor || "#ffffff";
  const applyBackgroundModeUI = (withoutBackground) => {
    if (pageBackgroundColorControl) {
      pageBackgroundColorControl.style.display = withoutBackground
        ? "none"
        : "grid";
    }
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
  }, 400);

  pageBackgroundColorInput?.addEventListener("input", () => {
    const color = pageBackgroundColorInput.value || "#ffffff";
    state.globalSettings.backgroundColor = color;
    scheduleRender();
    saveState(state);
  });

  pageBackgroundModeRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      state.globalSettings.withoutBackground = radio.value === "without";
      applyBackgroundModeUI(state.globalSettings.withoutBackground);
      scheduleRender();
      saveState(state);
    });
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
    const presetOrientation = presetKey === "square" ? "square" : "vertical";
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
    }, 100);

    const debouncedNumber = debounce(() => {
      scheduleRender();
      saveState(state);
    }, 400);

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
      applyStrokeColor(strokeColorInput.value || "#000000");
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
      layer.fillColor = fillColorInput.value || "#ffffff";
      scheduleRender();
      saveState(state);
    });
  }

  bindRadioGroup("alignment", "alignment");
  bindRadioGroup("layoutStyle", "layoutStyle");

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

    const gapXRangeMin = isRadial ? 50 : isLine ? 0 : -200;
    const gapXRangeMax = isRadial ? 300 : isLine ? 500 : 200;
    const gapXNumberMin = isRadial ? 10 : isLine ? 0 : -400;
    const gapXNumberMax = isRadial ? 500 : isLine ? 500 : 400;
    updateLimits(
      "gapXRange",
      "gapXNumber",
      gapXRangeMin,
      gapXRangeMax,
      gapXNumberMin,
      gapXNumberMax
    );

    if (isRadial) {
      updateLimits("gapYRange", "gapYNumber", 4, 36, 2, 120);
    } else {
      const gapYRangeMin = isLine ? 0 : -200;
      const gapYRangeMax = isLine ? 500 : 200;
      const gapYNumberMin = isLine ? 0 : -400;
      const gapYNumberMax = isLine ? 500 : 400;
      updateLimits(
        "gapYRange",
        "gapYNumber",
        gapYRangeMin,
        gapYRangeMax,
        gapYNumberMin,
        gapYNumberMax
      );
    }
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
      alignToRadiusInput.checked = Boolean(layer.alignToRadius);
    }

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
          layer.gapX = 100;
        }
        if (!Number.isFinite(Number(layer.gapY)) || Number(layer.gapY) === 100) {
          layer.gapY = 8;
        }
        if (!Number.isFinite(Number(layer.innerRadius))) {
          layer.innerRadius = 50;
        }
      }
      if (layer.baseGeometry !== "radial") {
        layer.alignToRadius = true;
      }
      if (!Number.isFinite(Number(layer.innerRadius))) {
        layer.innerRadius = 50;
      }
      updatePatternModeControls(layer);
      scheduleRender();
      saveState(state);
    });
  });

  const layersList = document.getElementById("layersList");
  const addLayerButton = document.getElementById("addLayer");

  const duplicateLayer = (index) => {
    if (state.layers.length >= MAX_LAYERS) return;
    const source = state.layers[index];
    if (!source) return;
    const clone = {
      ...source,
      name: `${source.name} Copy`,
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
    layersList.innerHTML = "";
    state.layers.forEach((layer, index) => {
      const item = document.createElement("div");
      item.className = "layer-item";
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
      nameDisplay.textContent = layer.name || `Layer ${index + 1}`;

      const nameInput = document.createElement("input");
      nameInput.className = "layer-name-input";
      nameInput.type = "text";
      nameInput.value = layer.name || `Layer ${index + 1}`;
      nameInput.style.display = "none";
      nameContainer.appendChild(nameDisplay);
      nameContainer.appendChild(nameInput);

      const finishRename = () => {
        const nextName = nameInput.value.trim() || `Layer ${index + 1}`;
        layer.name = nextName;
        nameDisplay.textContent = nextName;
        nameInput.style.display = "none";
        nameDisplay.style.display = "inline";
        saveState(state);
      };

      renameButton.addEventListener("click", (event) => {
        event.stopPropagation();
        nameInput.value = layer.name || `Layer ${index + 1}`;
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
      duplicateIcon.alt = "Copy";
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
      layer.gapX = clampValue(Number(layer.gapX) || 100, 10, 500);
      layer.gapY = clampValue(Number(layer.gapY) || 8, 2, 120);
      layer.innerRadius = clampValue(Number(layer.innerRadius) || 50, 10, 500);
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
        name: `Layer ${state.layers.length + 1}`,
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
        state.globalSettings.backgroundColor || "#ffffff";
    }
    const backgroundMode = state.globalSettings.withoutBackground
      ? "without"
      : "with";
    setRadioValue("pageBackgroundMode", backgroundMode);
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
      if (fillColorInput) fillColorInput.value = layer.fillColor || "#ffffff";
      updateFillControls(Boolean(layer.fill));
      if (alignToRadiusInput) {
        alignToRadiusInput.checked = Boolean(layer.alignToRadius);
      }
      updatePatternModeControls(layer);
    }
    updateCanvasSize();
    updateOrientationRadios();
  };

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

      const pointsPerPx = 72 / 96;
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
      document.getElementById("exportFormat")?.value || "png";
    if (renderExport) renderExport();
    const targetCanvas = exportCanvas || canvas;
    const createBackgroundCanvas = (sourceCanvas, fillColor) => {
      const flattenedCanvas = document.createElement("canvas");
      flattenedCanvas.width = sourceCanvas.width;
      flattenedCanvas.height = sourceCanvas.height;
      const flattenedCtx = flattenedCanvas.getContext("2d");
      if (flattenedCtx) {
        flattenedCtx.fillStyle = fillColor || "#ffffff";
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
      const jpegDataUrl = flattenedCanvas.toDataURL("image/jpeg", 0.95);
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
      link.href = flattenedCanvas.toDataURL("image/jpeg", 0.95);
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
