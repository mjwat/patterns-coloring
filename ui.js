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

  const widthInput = document.getElementById("canvasWidth");
  const heightInput = document.getElementById("canvasHeight");
  const widthLabel = document.getElementById("widthLabel");
  const heightLabel = document.getElementById("heightLabel");

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
  const updateOrientationRadios = () => {
    if (!widthInput || !heightInput) return;
    const width = Number(widthInput.value);
    const height = Number(heightInput.value);
    if (!width || !height) return;

    let target = null;
    if (width > height) {
      target = "horizontal";
    } else if (height > width) {
      target = "vertical";
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
    const presetRadio = document.querySelector(
      `input[name="pagePreset"][value="${value}"]`
    );
    if (presetRadio) presetRadio.checked = true;
    state.globalSettings.pagePreset = value;
  };

  const debouncedGlobalNumber = debounce(() => {
    scheduleRender();
    saveState(state);
  }, 400);

  widthInput?.addEventListener("input", () => {
    setPresetSelection("manual");
    updateCanvasSize();
    updateOrientationRadios();
    debouncedGlobalNumber();
  });
  heightInput?.addEventListener("input", () => {
    setPresetSelection("manual");
    updateCanvasSize();
    updateOrientationRadios();
    debouncedGlobalNumber();
  });

  const applyPreset = (presetKey) => {
    const preset = getPresetSize(
      presetKey,
      document.querySelector('input[name="orientation"]:checked')?.value ||
        DEFAULT_ORIENTATION
    );
    if (!widthInput || !heightInput) return;
    widthInput.value = String(preset.width);
    heightInput.value = String(preset.height);
    state.globalSettings.pagePreset = presetKey;
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
      const currentWidth = widthInput.value;
      widthInput.value = heightInput.value;
      heightInput.value = currentWidth;
      updateCanvasSize();
      markDirty();
    });
  });

  const presetRadios = document.querySelectorAll('input[name="pagePreset"]');
  presetRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      if (radio.value === "manual") return;
      applyPreset(radio.value);
    });
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

  bindRadioGroup("layout", "layout");
  bindRadioGroup("alignment", "alignment");

  const shapeTypeSelect = document.getElementById("shapeTypeSelect");
  const sizeControl = document.getElementById("sizeControl");
  const widthControl = document.getElementById("widthControl");
  const heightControl = document.getElementById("heightControl");
  const sizeLabel = document.querySelector('label[for="sizeRange"]');
  const applyGapLimits = (shapeType) => {
    const isLine = shapeType === "line";
    const rangeMin = isLine ? 0 : -200;
    const rangeMax = isLine ? 500 : 200;
    const numberMin = isLine ? 0 : -400;
    const numberMax = isLine ? 500 : 400;

    const updateLimits = (rangeId, numberId) => {
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
      const clamped = clampValue(
        Number(layer[key]),
        numberMin,
        numberMax
      );
      layer[key] = clamped;
      setLinkedValue(rangeId, numberId, clamped);
    };

    updateLimits("gapXRange", "gapXNumber");
    updateLimits("gapYRange", "gapYNumber");
  };

  const updateShapeControls = (shapeType) => {
    const isRect = shapeType === "rectangle" || shapeType === "oval";
    if (sizeControl) sizeControl.style.display = isRect ? "none" : "block";
    if (widthControl) widthControl.style.display = isRect ? "block" : "none";
    if (heightControl) heightControl.style.display = isRect ? "block" : "none";
    if (sizeLabel) {
      sizeLabel.textContent = shapeType === "line" ? "Length" : "Size";
    }
    applyGapLimits(shapeType);
  };

  if (shapeTypeSelect) {
    shapeTypeSelect.addEventListener("change", () => {
      const layer = getActiveLayer();
      if (!layer) return;
      layer.shapeType = shapeTypeSelect.value;
      updateShapeControls(layer.shapeType);
      scheduleRender();
      saveState(state);
    });
  }

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
    layer.layout =
      document.querySelector('input[name="layout"]:checked')?.value ||
      layer.layout;
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
    setNumber("weightNumber", (value) => {
      layer.weight = value;
    });
    setNumber("shapeRotationNumber", (value) => {
      layer.shapeRotation = value;
    });
    setNumber("patternRotationNumber", (value) => {
      layer.patternRotation = value;
    });
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
    setRadioValue("pagePreset", state.globalSettings.pagePreset);
    setRadioValue("orientation", state.globalSettings.orientation);

    const layer = getActiveLayer();
    if (layer) {
      if (shapeTypeSelect) shapeTypeSelect.value = layer.shapeType;
      updateShapeControls(layer.shapeType);
      setRadioValue("layout", layer.layout);
      setRadioValue("alignment", layer.alignment);
      setLinkedValue("sizeRange", "sizeNumber", layer.size);
    setLinkedValue("widthRange", "widthNumber", layer.width);
    setLinkedValue("heightRange", "heightNumber", layer.height);
    setLinkedValue("offsetXRange", "offsetXNumber", layer.offsetX);
    setLinkedValue("offsetYRange", "offsetYNumber", layer.offsetY);
    setLinkedValue("gapXRange", "gapXNumber", layer.gapX);
    setLinkedValue("gapYRange", "gapYNumber", layer.gapY);
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
    const isJpg = exportFormat === "jpg";
    const mime = isJpg ? "image/jpeg" : "image/png";
    const ext = isJpg ? "jpg" : "png";
    if (renderExport) renderExport();
    const targetCanvas = exportCanvas || canvas;
    link.download = `coloring-page_${timestamp}.${ext}`;
    link.href = targetCanvas.toDataURL(mime, isJpg ? 0.95 : undefined);
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
