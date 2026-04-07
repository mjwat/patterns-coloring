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

export const drawShape = (
  ctx,
  x,
  y,
  type,
  size,
  width,
  height,
  weight,
  strokeColor
) => {
  if (!ctx) return;

  ctx.save();
  ctx.beginPath();
  ctx.lineWidth = weight;
  ctx.strokeStyle = strokeColor || "#000";

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

  ctx.stroke();
  ctx.restore();
};

export const generatePattern = (ctx, canvas, layers, backgroundColor = "#ffffff") => {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.fillStyle = backgroundColor || "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
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
      const ringSpacing = Math.max(10, Number.isFinite(gapX) ? gapX : 100);
      const itemsPerRing = Math.max(2, Math.round(Number.isFinite(gapY) ? gapY : 8));
      const innerRadius = Math.max(
        10,
        Number.isFinite(Number(layer.innerRadius)) ? Number(layer.innerRadius) : 50
      );
      const alignToRadius = layer.alignToRadius !== false;
      const originX = anchorX - offsetX;
      const originY = anchorY - offsetY;
      const shapeExtent = Math.max(size, width, height);
      const maxRadius =
        Math.hypot(originX, originY) +
        halfDiagonal +
        Math.max(shapeExtent, ringSpacing) * 2;

      let ringIndex = 0;
      for (let radius = innerRadius; radius <= maxRadius; radius += ringSpacing) {
        const angleStep = (Math.PI * 2) / itemsPerRing;
        const startAngle =
          layoutStyle === "offset" && ringIndex % 2 === 0 ? angleStep / 2 : 0;

        for (let itemIndex = 0; itemIndex < itemsPerRing; itemIndex += 1) {
          const angle = startAngle + itemIndex * angleStep;
          const x = originX + Math.cos(angle) * radius;
          const y = originY + Math.sin(angle) * radius;
          const rotation = alignToRadius ? angle + shapeRadians : shapeRadians;
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
            layer.strokeColor
          );
          ctx.restore();
        }
        ringIndex += 1;
      }
    } else {
      const stepX = Math.max(1, (isLine ? size : width) + gapX);
      const stepY = Math.max(1, (isLine ? 0 : height) + gapY);
      const extraX = halfDiagonal + Math.abs(offsetX) + stepX * 2;
      const extraY = halfDiagonal + Math.abs(offsetY) + stepY * 2;
      const minX = -extraX;
      const maxX = extraX;
      const minY = -extraY;
      const maxY = extraY;

      const startCol = Math.floor((minX - (anchorX - offsetX)) / stepX) - 2;
      const endCol = Math.ceil((maxX - (anchorX - offsetX)) / stepX) + 2;
      const startRow = Math.floor((minY - (anchorY - offsetY)) / stepY) - 2;
      const endRow = Math.ceil((maxY - (anchorY - offsetY)) / stepY) + 2;

      for (let row = startRow; row <= endRow; row += 1) {
        const rowOffset =
          layoutStyle === "offset" && Math.abs(row) % 2 === 0 ? stepX / 2 : 0;
        const y = anchorY + row * stepY - offsetY;

        for (let col = startCol; col <= endCol; col += 1) {
          const x = anchorX + col * stepX - offsetX + rowOffset;
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
            layer.strokeColor
          );
          ctx.restore();
        }
      }
    }
    ctx.restore();
  });
};
