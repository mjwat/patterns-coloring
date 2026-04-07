export const STORAGE_KEY = "patternSettings";
export const GROUP_STATE_KEY = "patternGroupStates";

export const PRESETS = {
  a1: { width: 7016, height: 9933 },
  a2: { width: 4961, height: 7016 },
  a3: { width: 3508, height: 4961 },
  a4: { width: 2480, height: 3508 },
  a5: { width: 1748, height: 2480 },
  letter_a4: { width: 2550, height: 3300 },
  square: { width: 2550, height: 2550 },
};

export const DEFAULT_PRESET = "a4";
export const DEFAULT_ORIENTATION = "vertical";
export const MAX_LAYERS = 5;

export const getPresetSize = (presetKey, orientation) => {
  const preset = PRESETS[presetKey];
  if (!preset) return { width: 800, height: 600 };
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

export const createDefaultLayer = () => ({
  name: "Layer",
  visible: true,
  shapeType: "circle",
  size: 100,
  width: 100,
  height: 100,
  offsetX: 0,
  offsetY: 0,
  gapX: 100,
  gapY: 100,
  innerRadius: 50,
  weight: 4,
  strokeColor: "#000000",
  fill: false,
  fillColor: "#ffffff",
  baseGeometry: "grid",
  layoutStyle: "straight",
  alignToRadius: true,
  alignment: "top-left",
  shapeRotation: 0,
  patternRotation: 0,
});

export const createDefaultState = () => {
  const defaultPageSize = getPresetSize(
    DEFAULT_PRESET,
    DEFAULT_ORIENTATION
  );
  return {
    globalSettings: {
      pagePreset: DEFAULT_PRESET,
      orientation: DEFAULT_ORIENTATION,
      canvasWidth: defaultPageSize.width,
      canvasHeight: defaultPageSize.height,
      backgroundColor: "#ffffff",
      withoutBackground: false,
    },
    layers: [{ ...createDefaultLayer(), name: "Layer 1" }],
    activeLayerIndex: 0,
  };
};

export const saveState = (state) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const loadState = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const defaultPageSize = getPresetSize(
      DEFAULT_PRESET,
      DEFAULT_ORIENTATION
    );

    if (Array.isArray(parsed.layers)) {
      const layers = parsed.layers
        .map((layer, index) => {
          const migratedLayer = {
            ...createDefaultLayer(),
            name: layer.name || `Layer ${index + 1}`,
            ...layer,
          };
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
        .slice(0, MAX_LAYERS);
      const activeLayerIndex =
        typeof parsed.activeLayerIndex === "number" &&
        parsed.activeLayerIndex >= 0 &&
        parsed.activeLayerIndex < layers.length
          ? parsed.activeLayerIndex
          : 0;
      return {
        globalSettings: {
          ...createDefaultState().globalSettings,
          ...(parsed.globalSettings || {}),
        },
        layers,
        activeLayerIndex,
      };
    }

    const legacy = { ...createDefaultLayer(), name: "Layer 1" };
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
      parsed.patternRotation = 0;
    }
    if (parsed.strokeColor === undefined) {
      parsed.strokeColor = "#000000";
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
    if (parsed.baseGeometry !== undefined) {
      legacy.baseGeometry = parsed.baseGeometry;
    }
    if (parsed.layoutStyle !== undefined) {
      legacy.layoutStyle = parsed.layoutStyle;
    }
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
      legacy.alignToRadius = parsed.alignToRadius;
    }
    if (parsed.alignment !== undefined) legacy.alignment = parsed.alignment;
    if (parsed.shapeRotation !== undefined) {
      legacy.shapeRotation = parsed.shapeRotation;
    }
    if (parsed.patternRotation !== undefined) {
      legacy.patternRotation = parsed.patternRotation;
    }
    if (parsed.visible !== undefined) {
      legacy.visible = parsed.visible;
    }

    return {
      globalSettings: {
        pagePreset: parsed.pagePreset || DEFAULT_PRESET,
        orientation: parsed.orientation || DEFAULT_ORIENTATION,
        canvasWidth: parsed.canvasWidth || defaultPageSize.width,
        canvasHeight: parsed.canvasHeight || defaultPageSize.height,
        backgroundColor: parsed.backgroundColor || "#ffffff",
        withoutBackground: Boolean(parsed.withoutBackground),
      },
      layers: [legacy],
      activeLayerIndex: 0,
    };
  } catch {
    return null;
  }
};

export const resetState = () => {
  localStorage.removeItem(STORAGE_KEY);
  return createDefaultState();
};
