const drawShape = (ctx, x, y, type, size, weight) => {
  if (!ctx) return;

  ctx.save();
  ctx.beginPath();
  ctx.lineWidth = weight;
  ctx.strokeStyle = "#000";

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

  const PRESETS = {
    a4: { width: 2480, height: 3508 },
    a5: { width: 1748, height: 2480 },
  };

  const STORAGE_KEY = "patternSettings";
  const DEFAULT_PRESET = "a4";
  const DEFAULT_ORIENTATION = "horizontal";

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

  const settings = {
    pagePreset: DEFAULT_PRESET,
    orientation: DEFAULT_ORIENTATION,
    canvasWidth: defaultPageSize.width,
    canvasHeight: defaultPageSize.height,
    shapeType: "circle",
    size: 30,
    gapX: 80,
    gapY: 80,
    weight: 2,
    layout: "grid",
    alignment: "top-left",
    shapeRotation: 0,
    patternRotation: 0,
  };

  let needsUpdate = true;

  const generatePattern = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const size = Number(settings.size);
    const gapX = Number(settings.gapX);
    const gapY = Number(settings.gapY);
    const stepX = size + gapX;
    const stepY = size + gapY;

    const coverageWidth = canvas.width * 1.5;
    const coverageHeight = canvas.height * 1.5;
    const extra = 2;
    let cols = Math.ceil(coverageWidth / stepX) + 1 + extra;
    let rows = Math.ceil(coverageHeight / stepY) + 1 + extra;

    let startX = -canvas.width / 2 - size / 2;
    let startY = -canvas.height / 2 - size / 2;
    if (settings.alignment === "center") {
      startX = -Math.floor(cols / 2) * stepX;
      startY = -Math.floor(rows / 2) * stepY;
    }

    const shapeRadians = (settings.shapeRotation * Math.PI) / 180;
    const patternRadians = (settings.patternRotation * Math.PI) / 180;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(patternRadians);

    let rowIndex = 0;
    for (let row = 0; row < rows; row += 1) {
      const y = startY + row * stepY;
      const rowOffset =
        settings.layout === "brick" && rowIndex % 2 === 0
          ? stepX / 2
          : 0;
      const rowStartX = startX + rowOffset;

      for (let col = 0; col < cols; col += 1) {
        const x = rowStartX + col * stepX;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(shapeRadians);
        drawShape(ctx, 0, 0, settings.shapeType, settings.size, settings.weight);
        ctx.restore();
      }
      rowIndex += 1;
    }
    ctx.restore();
  };

  let isSyncing = false;
  const saveSettings = () => {
    if (isSyncing) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
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
      settings[key] = numericValue;
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
          settings[key] = radio.value;
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
  bindRadioGroup("shapeType", "shapeType");
  bindRadioGroup("layout", "layout");
  bindRadioGroup("alignment", "alignment");

  const shapeRotationInput = document.getElementById("shapeRotation");
  if (shapeRotationInput) {
    shapeRotationInput.addEventListener("input", () => {
      settings.shapeRotation = Number(shapeRotationInput.value) || 0;
      needsUpdate = true;
      saveSettings();
    });
  }

  const patternRotationInput = document.getElementById("patternRotation");
  if (patternRotationInput) {
    patternRotationInput.addEventListener("input", () => {
      settings.patternRotation = Number(patternRotationInput.value) || 0;
      needsUpdate = true;
      saveSettings();
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
    settings.canvasWidth = width;
    settings.canvasHeight = height;
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
      settings.orientation = target;
      isUpdatingOrientation = false;
    }
  };

  const setPresetSelection = (value) => {
    const presetRadio = document.querySelector(
      `input[name="pagePreset"][value="${value}"]`
    );
    if (presetRadio) presetRadio.checked = true;
    settings.pagePreset = value;
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
    settings.pagePreset = presetKey;
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
      settings.orientation = radio.value;
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
    if (widthInput) widthInput.value = String(settings.canvasWidth);
    if (heightInput) heightInput.value = String(settings.canvasHeight);
    setRadioValue("pagePreset", settings.pagePreset);
    setRadioValue("orientation", settings.orientation);
    setRadioValue("shapeType", settings.shapeType);
    setRadioValue("layout", settings.layout);
    setRadioValue("alignment", settings.alignment);
    setLinkedValue("sizeRange", "sizeNumber", settings.size);
    setLinkedValue("gapXRange", "gapXNumber", settings.gapX);
    setLinkedValue("gapYRange", "gapYNumber", settings.gapY);
    setLinkedValue("weightRange", "weightNumber", settings.weight);
    if (shapeRotationInput) {
      shapeRotationInput.value = String(settings.shapeRotation);
    }
    if (patternRotationInput) {
      patternRotationInput.value = String(settings.patternRotation);
    }
    updateCanvasSize();
    updateOrientationRadios();
    isSyncing = false;
  };

  const loadSettings = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      applyPreset(DEFAULT_PRESET);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
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
      Object.assign(settings, parsed);
      applySettingsToUI();
      saveSettings();
    } catch {
      applyPreset(DEFAULT_PRESET);
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
      Object.assign(settings, {
        pagePreset: DEFAULT_PRESET,
        orientation: DEFAULT_ORIENTATION,
        canvasWidth: resetSize.width,
        canvasHeight: resetSize.height,
        shapeType: "circle",
        size: 30,
        gapX: 80,
        gapY: 80,
        weight: 2,
        layout: "grid",
        alignment: "top-left",
        shapeRotation: 0,
        patternRotation: 0,
      });
      applySettingsToUI();
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
