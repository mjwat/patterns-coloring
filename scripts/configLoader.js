const REQUIRED_PATHS = [
  "storage.stateKey",
  "storage.groupStateKey",
  "storage.footerStateKey",
  "layers.max",
  "layers.defaultNamePrefix",
  "layers.copySuffix",
  "controls",
  "controls.canvas.backgroundColor.default",
  "controls.canvas.defaults.preset",
  "controls.canvas.defaults.orientation",
  "controls.canvas.defaults.presetOrientation",
  "controls.canvas.defaults.withoutBackground",
  "controls.canvas.width.default",
  "controls.canvas.height.default",
  "controls.canvas.presets",
  "controls.canvas.presets.a4.label",
  "controls.canvas.presets.a4.width",
  "controls.canvas.presets.a4.height",
  "controls.canvas.presets.custom.label",
  "debounce.rangeMs",
  "debounce.inputMs",
  "controls.element.shapeOptions",
  "controls.element.defaults",
  "controls.element.defaults.shapeType",
  "controls.element.defaults.fill",
  "controls.element.size.default",
  "controls.element.width.default",
  "controls.element.height.default",
  "controls.element.gap.x.grid.default",
  "controls.element.gap.x.line.default",
  "controls.element.gap.x.radial.default",
  "controls.element.gap.y.grid.default",
  "controls.element.gap.y.line.default",
  "controls.element.gap.y.radial.default",
  "controls.element.radial.innerRadius.default",
  "controls.element.weight.default",
  "controls.element.rotation.default",
  "controls.element.strokeColor.default",
  "controls.element.fillColor.default",
  "controls.element.gap.x.grid.rangeMin",
  "controls.element.gap.x.line.rangeMin",
  "controls.element.gap.x.radial.rangeMin",
  "controls.element.gap.y.grid.rangeMin",
  "controls.element.gap.y.line.rangeMin",
  "controls.element.gap.y.radial.rangeMin",
  "controls.pattern.position.x.default",
  "controls.pattern.position.y.default",
  "controls.pattern.rotation.default",
  "controls.pattern.defaults",
  "controls.pattern.defaults.gridAnchor",
  "render.grid.minStep",
  "render.grid.edgePaddingCells",
  "render.grid.bleedStepMultiplier",
  "render.radial.minItemsPerRing",
  "controls.element.gap.x.radial.numberMin",
  "controls.element.radial.innerRadius.number.min",
  "export.defaultFormat",
  "export.formats",
  "export.jpgQuality",
  "export.pdfPointsPerPx"
];

const getByPath = (obj, path) =>
  path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);

const validateConfig = (config) => {
  const missing = REQUIRED_PATHS.filter((path) => getByPath(config, path) === undefined);
  if (missing.length > 0) {
    console.error(
      `[config] Missing required keys in config.json: ${missing.join(", ")}`
    );
    return false;
  }
  return true;
};

export const loadConfig = async () => {
  try {
    const response = await fetch("../config.json", { cache: "no-store" });
    if (!response.ok) {
      console.error(
        `[config] Failed to load config.json (status ${response.status})`
      );
      return null;
    }
    const config = await response.json();
    if (!validateConfig(config)) {
      return null;
    }
    return config;
  } catch (error) {
    console.error("[config] Failed to parse or load config.json", error);
    return null;
  }
};
