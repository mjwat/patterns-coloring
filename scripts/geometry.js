const drawPolygon = (ctx, x, y, radius, sides) => {
  const step = (Math.PI * 2) / sides;
  for (let i = 0; i < sides; i += 1) {
    const angle = i * step;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
};

const getRadialShapeOffset = (shapeType) => {
  if (shapeType === "hexagon") {
    // Use a 30deg phase shift so radial alignment is visually distinct.
    return Math.PI / 6;
  }
  return 0;
};

const getRadialUnalignedPhase = (shapeType) => {
  if (shapeType === "hexagon") {
    return 0;
  }
  return 0;
};

export const drawShape = (
  ctx,
  x,
  y,
  type,
  size,
  width,
  height,
  weight,
  strokeColor,
  fillEnabled,
  fillColor
) => {
  if (!ctx) return;

  ctx.save();
  ctx.beginPath();
  ctx.lineWidth = weight;
  if (strokeColor !== undefined && strokeColor !== null) {
    ctx.strokeStyle = strokeColor;
  }
  if (fillColor !== undefined && fillColor !== null) {
    ctx.fillStyle = fillColor;
  }

  if (type === "circle") {
    const radius = size / 2;
    ctx.arc(x, y, radius, 0, Math.PI * 2);
  } else if (type === "square") {
    const half = size / 2;
    ctx.rect(x - half, y - half, size, size);
  } else if (type === "rectangle") {
    const halfW = width / 2;
    const halfH = height / 2;
    ctx.rect(x - halfW, y - halfH, width, height);
  } else if (type === "oval") {
    const radiusX = width / 2;
    const radiusY = height / 2;
    ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  } else if (type === "hexagon") {
    const radius = size / 2;
    drawPolygon(ctx, x, y, radius, 6);
  } else if (type === "line") {
    ctx.beginPath();
    ctx.moveTo(x - size / 2, y);
    ctx.lineTo(x + size / 2, y);
    ctx.lineCap = "round";
  }

  if (fillEnabled && type !== "line") {
    ctx.fill();
  }
  ctx.stroke();
  ctx.restore();
};

export const generatePattern = (
  ctx,
  canvas,
  layers,
  backgroundColor = null,
  config = {}
) => {
  if (!ctx || !canvas) return;
  const renderConfig = config.render || config;
  const elementControls = config.controls?.element || {};
  const gridMinStep = Number(renderConfig.grid?.minStep);
  const gridEdgePaddingCells = Number(renderConfig.grid?.edgePaddingCells);
  const gridBleedStepMultiplier = Number(renderConfig.grid?.bleedStepMultiplier);
  const radialConfig = renderConfig.radial || {};
  const radialGapLimits = elementControls.gap?.x?.radial || {};
  const radialInnerRadiusLimits = elementControls.radial?.innerRadius?.number || {};
  const minRingSpacing = Number(radialGapLimits.numberMin);
  const minItemsPerRing = Number(radialConfig.minItemsPerRing);
  const defaultRingSpacing = Number(elementControls.gap?.x?.radial?.default);
  const defaultItemsPerRing = Number(elementControls.gap?.y?.radial?.default);
  const minInnerRadius = Number(radialInnerRadiusLimits.min);
  const defaultInnerRadius = Number(elementControls.radial?.innerRadius?.default);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (backgroundColor !== null) {
    ctx.save();
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const diagonal = Math.hypot(canvasWidth, canvasHeight);
  const halfDiagonal = diagonal / 2;

  layers.forEach((layer) => {
    if (layer.visible === false) return;
    const size = Number(layer.size);
    const gapX = Number(layer.gapX);
    const gapY = Number(layer.gapY);
    const offsetX = Number(layer.offsetX || 0);
    const offsetY = Number(layer.offsetY || 0);
    const width =
      layer.shapeType === "rectangle" || layer.shapeType === "oval"
        ? Number(layer.width)
        : size;
    const height =
      layer.shapeType === "rectangle" || layer.shapeType === "oval"
        ? Number(layer.height)
        : size;
    if (
      !Number.isFinite(size) ||
      size <= 0 ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    )
      return;

    const baseGeometry = layer.baseGeometry || "grid";
    const layoutStyle =
      layer.layoutStyle || (layer.layout === "brick" ? "offset" : "straight");
    const isLine = layer.shapeType === "line";
    const shapeRadians = (layer.shapeRotation * Math.PI) / 180;
    const patternRadians = (layer.patternRotation * Math.PI) / 180;
    const anchorX = layer.alignment === "center" ? 0 : -canvasWidth / 2;
    const anchorY = layer.alignment === "center" ? 0 : -canvasHeight / 2;

    ctx.save();
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.rotate(patternRadians);

    if (baseGeometry === "radial") {
      const ringGap = Math.max(
        minRingSpacing,
        Number.isFinite(gapX) ? gapX : defaultRingSpacing
      );
      const itemsPerRing = Math.max(
        minItemsPerRing,
        Math.round(Number.isFinite(gapY) ? gapY : defaultItemsPerRing)
      );
      const innerRadius = Math.max(
        minInnerRadius,
        Number.isFinite(Number(layer.innerRadius))
          ? Number(layer.innerRadius)
          : defaultInnerRadius
      );
      const alignToRadius = layer.alignToRadius === true;
      const radialShapeOffset = getRadialShapeOffset(layer.shapeType);
      const radialUnalignedPhase = getRadialUnalignedPhase(layer.shapeType);
      const originX = anchorX - offsetX;
      const originY = anchorY - offsetY;
      const shapeExtent = Math.max(size, width, height);
      // Radial step uses element span + gap so spacing is edge-to-edge.
      const ringStep = Math.max(1, shapeExtent + ringGap);
      const maxRadius =
        Math.hypot(originX, originY) +
        halfDiagonal +
        Math.max(shapeExtent, ringStep) * 2;

      let ringIndex = 0;
      for (let radius = innerRadius; radius <= maxRadius; radius += ringStep) {
        const angleStep = (Math.PI * 2) / itemsPerRing;
        const startAngle =
          layoutStyle === "offset" && ringIndex % 2 === 0 ? angleStep / 2 : 0;

        for (let itemIndex = 0; itemIndex < itemsPerRing; itemIndex += 1) {
          const angle = startAngle + itemIndex * angleStep;
          const x = originX + Math.cos(angle) * radius;
          const y = originY + Math.sin(angle) * radius;
          const rotation = alignToRadius
            ? angle + radialShapeOffset + shapeRadians
            : radialUnalignedPhase;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(rotation);
          drawShape(
            ctx,
            0,
            0,
            layer.shapeType,
            size,
            width,
            height,
            layer.weight,
            layer.strokeColor,
            layer.fill,
            layer.fillColor
          );
          ctx.restore();
        }
        ringIndex += 1;
      }
    } else {
      const stepX = Math.max(gridMinStep, (isLine ? size : width) + gapX);
      const stepY = Math.max(gridMinStep, (isLine ? 0 : height) + gapY);
      const useIntersectionAnchor =
        layer.alignment === "center" &&
        layoutStyle === "straight" &&
        (layer.gridAnchor || "element") === "intersection";
      const anchorShiftX = useIntersectionAnchor ? stepX / 2 : 0;
      const anchorShiftY = useIntersectionAnchor ? stepY / 2 : 0;
      const gridOriginX = anchorX + anchorShiftX - offsetX;
      const gridOriginY = anchorY + anchorShiftY - offsetY;
      const extraX =
        halfDiagonal + Math.abs(offsetX) + stepX * gridBleedStepMultiplier;
      const extraY =
        halfDiagonal + Math.abs(offsetY) + stepY * gridBleedStepMultiplier;
      const minX = -extraX;
      const maxX = extraX;
      const minY = -extraY;
      const maxY = extraY;

      const startCol =
        Math.floor((minX - gridOriginX) / stepX) -
        gridEdgePaddingCells;
      const endCol =
        Math.ceil((maxX - gridOriginX) / stepX) +
        gridEdgePaddingCells;
      const startRow =
        Math.floor((minY - gridOriginY) / stepY) -
        gridEdgePaddingCells;
      const endRow =
        Math.ceil((maxY - gridOriginY) / stepY) +
        gridEdgePaddingCells;

      for (let row = startRow; row <= endRow; row += 1) {
        const rowOffset =
          layoutStyle === "offset" && Math.abs(row) % 2 === 0 ? stepX / 2 : 0;
        const y = gridOriginY + row * stepY;

        for (let col = startCol; col <= endCol; col += 1) {
          const x = gridOriginX + col * stepX + rowOffset;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(shapeRadians);
          drawShape(
            ctx,
            0,
            0,
            layer.shapeType,
            size,
            width,
            height,
            layer.weight,
            layer.strokeColor,
            layer.fill,
            layer.fillColor
          );
          ctx.restore();
        }
      }
    }
    ctx.restore();
  });
};
