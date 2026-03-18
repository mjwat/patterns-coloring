const drawShape = (ctx, x, y, type, size, weight, strokeColor) => {
  if (!ctx) return;

  ctx.save();
  ctx.beginPath();
  ctx.lineWidth = weight;
  ctx.strokeStyle = strokeColor || "#000";

  const half = size / 2;

  if (type === "circle") {
    ctx.arc(x, y, half, 0, Math.PI * 2);
  } else if (type === "square") {
    ctx.rect(x - half, y - half, size, size);
  }

  ctx.stroke();
  ctx.restore();
};

window.addEventListener("load", () => {
  const canvas = document.getElementById("mainCanvas");
  const ctx = canvas?.getContext("2d");
  if (!ctx) return;

  const GROUP_STATE_KEY = "patternGroupStates";
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

  const PRESETS = {
    a4: { width: 2480, height: 3508 },
    a5: { width: 1748, height: 2480 },
  };

  const STORAGE_KEY = "patternSettings";
  const DEFAULT_PRESET = "a4";
  const DEFAULT_ORIENTATION = "horizontal";
  const MAX_LAYERS = 3;

  const getPresetSize = (presetKey, orientation) => {
    const preset = PRESETS[presetKey];
    if (!preset) return { width: 800, height: 600 };
    let { width, height } = preset;
    if (orientation === "horizontal") {
      [width, height] = [height, width];
    }
    return { width, height };
  };

  const defaultPageSize = getPresetSize(
    DEFAULT_PRESET,
    DEFAULT_ORIENTATION
  );

  const globalSettings = {
    pagePreset: DEFAULT_PRESET,
    orientation: DEFAULT_ORIENTATION,
    canvasWidth: defaultPageSize.width,
    canvasHeight: defaultPageSize.height,
  };

  const createDefaultLayer = () => ({
    name: "Layer",
    shapeType: "circle",
    size: 30,
    gapX: 80,
    gapY: 80,
    weight: 2,
    strokeColor: "#000000",
    layout: "grid",
    alignment: "top-left",
    shapeRotation: 0,
    patternRotation: 0,
  });

  let layers = [{ ...createDefaultLayer(), name: "Layer 1" }];
  let activeLayerIndex = 0;

  let needsUpdate = true;

  const generatePattern = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    layers.forEach((layer) => {
      const size = Number(layer.size);
      const gapX = Number(layer.gapX);
      const gapY = Number(layer.gapY);
      if (!Number.isFinite(size) || size <= 0) return;
      const stepX = Math.max(1, size + gapX);
      const stepY = Math.max(1, size + gapY);

      const diagonal = Math.hypot(canvas.width, canvas.height);
      const offset = diagonal / 2;
      const coverageWidth = canvas.width + diagonal;
      const coverageHeight = canvas.height + diagonal;
      const extra = 2;
      let cols = Math.ceil(coverageWidth / stepX) + 1 + extra;
      let rows = Math.ceil(coverageHeight / stepY) + 1 + extra;

      let startX = -canvas.width / 2 - offset;
      let startY = -canvas.height / 2 - offset;
      if (layer.alignment === "center") {
        startX = -Math.floor(cols / 2) * stepX;
        startY = -Math.floor(rows / 2) * stepY;
      }

      const shapeRadians = (layer.shapeRotation * Math.PI) / 180;
      const patternRadians = (layer.patternRotation * Math.PI) / 180;

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(patternRadians);

      let rowIndex = 0;
      for (let row = 0; row < rows; row += 1) {
        const y = startY + row * stepY;
        const rowOffset =
          layer.layout === "brick" && rowIndex % 2 === 0
            ? stepX / 2
            : 0;
        const rowStartX = startX + rowOffset;

        for (let col = 0; col < cols; col += 1) {
          const x = rowStartX + col * stepX;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(shapeRadians);
          drawShape(
            ctx,
            0,
            0,
            layer.shapeType,
            layer.size,
            layer.weight,
            layer.strokeColor
          );
          ctx.restore();
        }
        rowIndex += 1;
      }
      ctx.restore();
    });
  };

  const getActiveLayer = () => layers[activeLayerIndex];

  let isSyncing = false;
  const saveSettings = () => {
    if (isSyncing) return;
    const payload = {
      globalSettings,
      layers,
      activeLayerIndex,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  };

  const bindLinkedInputs = (rangeId, numberId, key) => {
    const range = document.getElementById(rangeId);
    const number = document.getElementById(numberId);
    if (!range || !number) return;

    const updateValue = (value) => {
      const numericValue = Number(value);
      if (Number.isNaN(numericValue)) return;
      range.value = String(numericValue);
      number.value = String(numericValue);
      const layer = getActiveLayer();
      if (!layer) return;
      layer[key] = numericValue;
      needsUpdate = true;
      saveSettings();
    };

    range.addEventListener("input", () => updateValue(range.value));
    number.addEventListener("input", () => updateValue(number.value));
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
          needsUpdate = true;
          saveSettings();
        }
      });
    });
  };

  bindLinkedInputs("sizeRange", "sizeNumber", "size");
  bindLinkedInputs("gapXRange", "gapXNumber", "gapX");
  bindLinkedInputs("gapYRange", "gapYNumber", "gapY");
  bindLinkedInputs("weightRange", "weightNumber", "weight");
  bindLinkedInputs("shapeRotationRange", "shapeRotationNumber", "shapeRotation");
  bindLinkedInputs(
    "patternRotationRange",
    "patternRotationNumber",
    "patternRotation"
  );

  const strokeColorInput = document.getElementById("strokeColor");
  const strokeColorHexInput = document.getElementById("strokeColorHex");

  const normalizeHex = (value) => {
    const raw = value.trim();
    const withHash = raw.startsWith("#") ? raw : `#${raw}`;
    const cleaned = withHash.replace(/[^#0-9a-fA-F]/g, "");
    const hex = cleaned.slice(1).padEnd(6, "0").slice(0, 6);
    return `#${hex.toUpperCase()}`;
  };

  const isValidHex = (value) => /^#[0-9A-Fa-f]{6}$/.test(value);

  const applyStrokeColor = (hex) => {
    const layer = getActiveLayer();
    if (!layer) return;
    layer.strokeColor = hex;
    if (strokeColorInput) strokeColorInput.value = hex;
    if (strokeColorHexInput) strokeColorHexInput.value = hex;
    needsUpdate = true;
    saveSettings();
  };

  if (strokeColorInput) {
    strokeColorInput.addEventListener("input", () => {
      const hex = normalizeHex(strokeColorInput.value);
      applyStrokeColor(hex);
    });
  }

  if (strokeColorHexInput) {
    strokeColorHexInput.addEventListener("input", () => {
      const normalized = normalizeHex(strokeColorHexInput.value);
      strokeColorHexInput.value = normalized;
      if (isValidHex(normalized)) {
        applyStrokeColor(normalized);
      }
    });
  }
  bindRadioGroup("shapeType", "shapeType");
  bindRadioGroup("layout", "layout");
  bindRadioGroup("alignment", "alignment");

  const layersList = document.getElementById("layersList");
  const addLayerButton = document.getElementById("addLayer");

  const renderLayerList = () => {
    if (!layersList) return;
    layersList.innerHTML = "";
    layers.forEach((layer, index) => {
      const item = document.createElement("div");
      item.className = "layer-item";
      if (index === activeLayerIndex) {
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
        const temp = layers[index - 1];
        layers[index - 1] = layers[index];
        layers[index] = temp;
        if (activeLayerIndex === index) {
          activeLayerIndex = index - 1;
        } else if (activeLayerIndex === index - 1) {
          activeLayerIndex = index;
        }
        renderLayerList();
        saveSettings();
        needsUpdate = true;
      });

      const downButton = document.createElement("button");
      downButton.className = "layer-action";
      downButton.type = "button";
      downButton.textContent = "↓";
      downButton.disabled = index === layers.length - 1;
      downButton.addEventListener("click", (event) => {
        event.stopPropagation();
        if (index === layers.length - 1) return;
        const temp = layers[index + 1];
        layers[index + 1] = layers[index];
        layers[index] = temp;
        if (activeLayerIndex === index) {
          activeLayerIndex = index + 1;
        } else if (activeLayerIndex === index + 1) {
          activeLayerIndex = index;
        }
        renderLayerList();
        saveSettings();
        needsUpdate = true;
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
        saveSettings();
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

      item.appendChild(reorder);
      item.appendChild(renameButton);
      item.appendChild(nameContainer);

      if (index > 0) {
        const deleteButton = document.createElement("button");
        deleteButton.className = "layer-delete";
        deleteButton.type = "button";
        deleteButton.textContent = "×";
        deleteButton.addEventListener("click", (event) => {
          event.stopPropagation();
          layers.splice(index, 1);
          if (activeLayerIndex >= layers.length) {
            activeLayerIndex = layers.length - 1;
          }
          renderLayerList();
          applySettingsToUI();
          saveSettings();
          needsUpdate = true;
        });
        item.appendChild(deleteButton);
      }

      item.addEventListener("click", () => {
        setActiveLayer(index);
      });

      layersList.appendChild(item);
    });

    if (addLayerButton) {
      addLayerButton.style.display = layers.length < MAX_LAYERS ? "block" : "none";
    }
  };

  const syncLayerFromInputs = (layer) => {
    if (!layer) return;
    const getValue = (id) => document.getElementById(id)?.value;
    const setNumber = (id, setter) => {
      const raw = Number(getValue(id));
      if (!Number.isNaN(raw)) setter(raw);
    };
    layer.shapeType =
      document.querySelector('input[name="shapeType"]:checked')?.value ||
      layer.shapeType;
    layer.layout =
      document.querySelector('input[name="layout"]:checked')?.value ||
      layer.layout;
    layer.alignment =
      document.querySelector('input[name="alignment"]:checked')?.value ||
      layer.alignment;
    setNumber("sizeNumber", (value) => {
      layer.size = value;
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
    if (index === activeLayerIndex) return;
    const currentLayer = getActiveLayer();
    syncLayerFromInputs(currentLayer);
    activeLayerIndex = index;
    renderLayerList();
    applySettingsToUI();
    saveSettings();
    needsUpdate = true;
  };

  if (addLayerButton) {
    addLayerButton.addEventListener("click", () => {
      if (layers.length >= MAX_LAYERS) return;
      layers.push({
        ...createDefaultLayer(),
        name: `Layer ${layers.length + 1}`,
      });
      activeLayerIndex = layers.length - 1;
      renderLayerList();
      applySettingsToUI();
      saveSettings();
      needsUpdate = true;
    });
  }


  const widthInput = document.getElementById("canvasWidth");
  const heightInput = document.getElementById("canvasHeight");
  const widthLabel = document.getElementById("widthLabel");
  const heightLabel = document.getElementById("heightLabel");

  const updateCanvasSize = () => {
    const width = Number(widthInput?.value) || canvas.width;
    const height = Number(heightInput?.value) || canvas.height;
    canvas.width = width;
    canvas.height = height;
    if (widthLabel) widthLabel.textContent = `${width} px`;
    if (heightLabel) heightLabel.textContent = `${height} px`;
    globalSettings.canvasWidth = width;
    globalSettings.canvasHeight = height;
    needsUpdate = true;
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
      globalSettings.orientation = target;
      isUpdatingOrientation = false;
    }
  };

  const setPresetSelection = (value) => {
    const presetRadio = document.querySelector(
      `input[name="pagePreset"][value="${value}"]`
    );
    if (presetRadio) presetRadio.checked = true;
    globalSettings.pagePreset = value;
  };

  widthInput?.addEventListener("input", () => {
    setPresetSelection("manual");
    updateCanvasSize();
    updateOrientationRadios();
    saveSettings();
  });
  heightInput?.addEventListener("input", () => {
    setPresetSelection("manual");
    updateCanvasSize();
    updateOrientationRadios();
    saveSettings();
  });

  const applyPreset = (presetKey) => {
    const preset = PRESETS[presetKey];
    if (!preset || !widthInput || !heightInput) return;

    const orientation = document.querySelector(
      'input[name="orientation"]:checked'
    )?.value;

    let { width, height } = preset;
    if (orientation === "horizontal") {
      [width, height] = [height, width];
    }

    widthInput.value = String(width);
    heightInput.value = String(height);
    globalSettings.pagePreset = presetKey;
    updateCanvasSize();
    updateOrientationRadios();
    saveSettings();
  };

  const orientationRadios = document.querySelectorAll(
    'input[name="orientation"]'
  );
  orientationRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked || !widthInput || !heightInput) return;
      if (isUpdatingOrientation) return;
      globalSettings.orientation = radio.value;
      const currentWidth = widthInput.value;
      widthInput.value = heightInput.value;
      heightInput.value = currentWidth;
      updateCanvasSize();
      saveSettings();
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

  const applySettingsToUI = () => {
    isSyncing = true;
    if (widthInput) widthInput.value = String(globalSettings.canvasWidth);
    if (heightInput) heightInput.value = String(globalSettings.canvasHeight);
    setRadioValue("pagePreset", globalSettings.pagePreset);
    setRadioValue("orientation", globalSettings.orientation);

    const layer = getActiveLayer();
    if (layer) {
      setRadioValue("shapeType", layer.shapeType);
      setRadioValue("layout", layer.layout);
      setRadioValue("alignment", layer.alignment);
      setLinkedValue("sizeRange", "sizeNumber", layer.size);
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
      if (strokeColorHexInput) strokeColorHexInput.value = layer.strokeColor;
    }
    updateCanvasSize();
    updateOrientationRadios();
    isSyncing = false;
  };

  const loadSettings = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      applyPreset(DEFAULT_PRESET);
      renderLayerList();
      return;
    }
    try {
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed.layers)) {
        Object.assign(globalSettings, parsed.globalSettings || {});
        layers = parsed.layers.map((layer, index) => ({
          ...createDefaultLayer(),
          name: layer.name || `Layer ${index + 1}`,
          ...layer,
        }));
        if (layers.length > MAX_LAYERS) {
          layers = layers.slice(0, MAX_LAYERS);
        }
        activeLayerIndex =
          typeof parsed.activeLayerIndex === "number"
            ? parsed.activeLayerIndex
            : 0;
        if (activeLayerIndex < 0 || activeLayerIndex >= layers.length) {
          activeLayerIndex = 0;
        }
      } else {
        if (parsed.spacingX !== undefined && parsed.gapX === undefined) {
          parsed.gapX = parsed.spacingX;
        }
        if (parsed.spacingY !== undefined && parsed.gapY === undefined) {
          parsed.gapY = parsed.spacingY;
        }
        if (parsed.shapeType === "triangle") {
          parsed.shapeType = "circle";
        }
        if (parsed.angle !== undefined && parsed.shapeRotation === undefined) {
          parsed.shapeRotation = parsed.angle;
        }
        if (parsed.patternRotation === undefined) {
          parsed.patternRotation = 0;
        }
        if (parsed.strokeColor === undefined) {
          parsed.strokeColor = "#000000";
        }

        Object.assign(globalSettings, {
          pagePreset: parsed.pagePreset || DEFAULT_PRESET,
          orientation: parsed.orientation || DEFAULT_ORIENTATION,
          canvasWidth: parsed.canvasWidth || defaultPageSize.width,
          canvasHeight: parsed.canvasHeight || defaultPageSize.height,
        });

        const legacyLayer = { ...createDefaultLayer(), name: "Layer 1" };
        if (parsed.shapeType !== undefined) legacyLayer.shapeType = parsed.shapeType;
        if (parsed.size !== undefined) legacyLayer.size = parsed.size;
        if (parsed.gapX !== undefined) legacyLayer.gapX = parsed.gapX;
        if (parsed.gapY !== undefined) legacyLayer.gapY = parsed.gapY;
        if (parsed.weight !== undefined) legacyLayer.weight = parsed.weight;
        if (parsed.strokeColor !== undefined) {
          legacyLayer.strokeColor = parsed.strokeColor;
        }
        if (parsed.layout !== undefined) legacyLayer.layout = parsed.layout;
        if (parsed.alignment !== undefined) legacyLayer.alignment = parsed.alignment;
        if (parsed.shapeRotation !== undefined) {
          legacyLayer.shapeRotation = parsed.shapeRotation;
        }
        if (parsed.patternRotation !== undefined) {
          legacyLayer.patternRotation = parsed.patternRotation;
        }
        layers = [legacyLayer];
        activeLayerIndex = 0;
      }

      applySettingsToUI();
      renderLayerList();
      saveSettings();
    } catch {
      applyPreset(DEFAULT_PRESET);
      renderLayerList();
    }
  };

  const resetButton = document.getElementById("resetDefaults");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      const resetSize = getPresetSize(
        DEFAULT_PRESET,
        DEFAULT_ORIENTATION
      );
      Object.assign(globalSettings, {
        pagePreset: DEFAULT_PRESET,
        orientation: DEFAULT_ORIENTATION,
        canvasWidth: resetSize.width,
        canvasHeight: resetSize.height,
      });
      layers = [{ ...createDefaultLayer(), name: "Layer 1" }];
      activeLayerIndex = 0;
      applySettingsToUI();
      renderLayerList();
      saveSettings();
    });
  }

  const exportCanvas = () => {
    const link = document.createElement("a");
    link.download = "coloring-page.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const downloadButton = document.getElementById("downloadImage");
  if (downloadButton) {
    downloadButton.addEventListener("click", exportCanvas);
  }

  loadSettings();

  const renderLoop = () => {
    if (needsUpdate) {
      generatePattern();
      needsUpdate = false;
    }
    requestAnimationFrame(renderLoop);
  };

  renderLoop();
});
