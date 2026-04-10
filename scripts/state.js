let APP_CONFIG = null;

const normalizeBoolean = (value, fallback) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return fallback;
};

const requireConfig = () => {
  if (!APP_CONFIG) {
    throw new Error("State config is not initialized. Call initStateConfig(config) first.");
  }
  return APP_CONFIG;
};

const getStorageKey = () => requireConfig().storage.stateKey;
export const getGroupStateKey = () => requireConfig().storage.groupStateKey;
export const getFooterStateKey = () => requireConfig().storage.footerStateKey;
export const getMaxLayers = () => Number(requireConfig().layers.max);

export const initStateConfig = (config) => {
  APP_CONFIG = config;
};

export const getPresetSize = (presetKey, orientation) => {
  const config = requireConfig();
  const preset = config.controls.canvas.presets[presetKey];
  if (
    !preset ||
    !Number.isFinite(Number(preset.width)) ||
    !Number.isFinite(Number(preset.height))
  ) {
    return {
      width: config.controls.canvas.width.default,
      height: config.controls.canvas.height.default
    };
  }
  let { width, height } = preset;
  if (orientation === "square") {
    const side = Math.max(width, height);
    return { width: side, height: side };
  }
  if (orientation === "horizontal") {
    [width, height] = [height, width];
  }
  return { width, height };
};

export const createDefaultLayer = () => {
  const config = requireConfig();
  const layerDefaults = config.controls.element.defaults;
  const patternDefaults = config.controls.pattern.defaults;
  return {
    name: config.layers.defaultNamePrefix,
    visible: true,
    shapeType: layerDefaults.shapeType,
    size: config.controls.element.size.default,
    width: config.controls.element.width.default,
    height: config.controls.element.height.default,
    offsetX: config.controls.pattern.position.x.default,
    offsetY: config.controls.pattern.position.y.default,
    gapX: config.controls.element.gap.x.grid.default,
    gapY: config.controls.element.gap.y.grid.default,
    innerRadius: config.controls.element.radial.innerRadius.default,
    weight: config.controls.element.weight.default,
    strokeColor: config.controls.element.strokeColor.default,
    fill: layerDefaults.fill,
    fillColor: config.controls.element.fillColor.default,
    baseGeometry: patternDefaults.baseGeometry,
    layoutStyle: patternDefaults.layoutStyle,
    alignToRadius: patternDefaults.alignToRadius,
    alignment: patternDefaults.alignment,
    shapeRotation: config.controls.element.rotation.default,
    patternRotation: config.controls.pattern.rotation.default
  };
};

export const createDefaultState = () => {
  const config = requireConfig();
  const defaultPageSize = getPresetSize(
    config.controls.canvas.defaults.preset,
    config.controls.canvas.defaults.orientation
  );
  return {
    globalSettings: {
      pagePreset: config.controls.canvas.defaults.preset,
      orientation: config.controls.canvas.defaults.orientation,
      canvasWidth: defaultPageSize.width,
      canvasHeight: defaultPageSize.height,
      backgroundColor: config.controls.canvas.backgroundColor.default,
      withoutBackground: config.controls.canvas.defaults.withoutBackground
    },
    layers: [{ ...createDefaultLayer(), name: `${config.layers.defaultNamePrefix} 1` }],
    activeLayerIndex: 0
  };
};

export const saveState = (state) => {
  localStorage.setItem(getStorageKey(), JSON.stringify(state));
};

export const loadState = () => {
  const config = requireConfig();
  const raw = localStorage.getItem(getStorageKey());
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const defaultPageSize = getPresetSize(
      config.controls.canvas.defaults.preset,
      config.controls.canvas.defaults.orientation
    );

    if (Array.isArray(parsed.layers)) {
      const layers = parsed.layers
        .map((layer, index) => {
          const migratedLayer = {
            ...createDefaultLayer(),
            name: layer.name || `${config.layers.defaultNamePrefix} ${index + 1}`,
            ...layer
          };
          migratedLayer.alignToRadius = normalizeBoolean(
            migratedLayer.alignToRadius,
            createDefaultLayer().alignToRadius
          );
          if (layer.layout && !layer.layoutStyle) {
            if (layer.layout === "brick") {
              migratedLayer.baseGeometry = "grid";
              migratedLayer.layoutStyle = "offset";
            } else if (layer.layout === "grid") {
              migratedLayer.baseGeometry = "grid";
              migratedLayer.layoutStyle = "straight";
            }
          }
          return migratedLayer;
        })
        .slice(0, getMaxLayers());

      const activeLayerIndex =
        typeof parsed.activeLayerIndex === "number" &&
        parsed.activeLayerIndex >= 0 &&
        parsed.activeLayerIndex < layers.length
          ? parsed.activeLayerIndex
          : 0;

      return {
        globalSettings: {
          ...createDefaultState().globalSettings,
          ...(parsed.globalSettings || {})
        },
        layers,
        activeLayerIndex
      };
    }

    const legacy = { ...createDefaultLayer(), name: `${config.layers.defaultNamePrefix} 1` };
    if (parsed.spacingX !== undefined && parsed.gapX === undefined) {
      parsed.gapX = parsed.spacingX;
    }
    if (parsed.spacingY !== undefined && parsed.gapY === undefined) {
      parsed.gapY = parsed.spacingY;
    }
    if (parsed.shapeType === "triangle") {
      parsed.shapeType = "circle";
    }
    if (parsed.shapeType === "polygon") {
      parsed.shapeType = "hexagon";
    }
    if (parsed.angle !== undefined && parsed.shapeRotation === undefined) {
      parsed.shapeRotation = parsed.angle;
    }
    if (parsed.patternRotation === undefined) {
      parsed.patternRotation =
        config.controls.pattern.rotation.default;
    }
    if (parsed.strokeColor === undefined) {
      parsed.strokeColor = config.controls.element.strokeColor.default;
    }

    if (parsed.shapeType !== undefined) legacy.shapeType = parsed.shapeType;
    if (parsed.size !== undefined) legacy.size = parsed.size;
    if (parsed.width !== undefined) legacy.width = parsed.width;
    if (parsed.height !== undefined) legacy.height = parsed.height;
    if (parsed.offsetX !== undefined) legacy.offsetX = parsed.offsetX;
    if (parsed.offsetY !== undefined) legacy.offsetY = parsed.offsetY;
    if (parsed.gapX !== undefined) legacy.gapX = parsed.gapX;
    if (parsed.gapY !== undefined) legacy.gapY = parsed.gapY;
    if (parsed.weight !== undefined) legacy.weight = parsed.weight;
    if (parsed.strokeColor !== undefined) legacy.strokeColor = parsed.strokeColor;
    if (parsed.fill !== undefined) legacy.fill = parsed.fill;
    if (parsed.fillColor !== undefined) legacy.fillColor = parsed.fillColor;
    if (parsed.baseGeometry !== undefined) legacy.baseGeometry = parsed.baseGeometry;
    if (parsed.layoutStyle !== undefined) legacy.layoutStyle = parsed.layoutStyle;
    if (parsed.layout !== undefined) {
      if (parsed.layout === "brick") {
        legacy.baseGeometry = "grid";
        legacy.layoutStyle = "offset";
      } else if (parsed.layout === "grid") {
        legacy.baseGeometry = "grid";
        legacy.layoutStyle = "straight";
      }
    }
    if (parsed.innerRadius !== undefined) legacy.innerRadius = parsed.innerRadius;
    if (parsed.alignToRadius !== undefined) {
      legacy.alignToRadius = normalizeBoolean(
        parsed.alignToRadius,
        createDefaultLayer().alignToRadius
      );
    }
    if (parsed.alignment !== undefined) legacy.alignment = parsed.alignment;
    if (parsed.shapeRotation !== undefined) legacy.shapeRotation = parsed.shapeRotation;
    if (parsed.patternRotation !== undefined) legacy.patternRotation = parsed.patternRotation;
    if (parsed.visible !== undefined) legacy.visible = parsed.visible;

    return {
      globalSettings: {
        pagePreset: parsed.pagePreset || config.controls.canvas.defaults.preset,
        orientation: parsed.orientation || config.controls.canvas.defaults.orientation,
        canvasWidth: parsed.canvasWidth || defaultPageSize.width,
        canvasHeight: parsed.canvasHeight || defaultPageSize.height,
        backgroundColor: parsed.backgroundColor || config.controls.canvas.backgroundColor.default,
        withoutBackground:
          parsed.withoutBackground === undefined
            ? config.controls.canvas.defaults.withoutBackground
            : Boolean(parsed.withoutBackground)
      },
      layers: [legacy],
      activeLayerIndex: 0
    };
  } catch {
    return null;
  }
};

export const resetState = () => {
  localStorage.removeItem(getStorageKey());
  return createDefaultState();
};
