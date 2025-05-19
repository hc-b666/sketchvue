export function adjustElementCoordinates(element) {
  const { type, x1, y1, x2, y2, shapeNumber } = element;
  if (type === "rectangle" || type === "frame") {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    return { x1: minX, y1: minY, x2: maxX, y2: maxY, shapeNumber };
  } else if (type === "ellipse") {
    const x = (x1 + x2) / 2;
    const y = (y1 + y2) / 2;
    const rX = Math.abs(x1 - x2) / 2;
    const rY = Math.abs(y1 - y2) / 2;
    return { x, y, rX, rY, shapeNumber };
  } else {
    if (x1 < x2 || (x1 === x2 && y1 < y2)) {
      return { x1, y1, x2, y2, shapeNumber };
    } else {
      return { x1: x2, y1: y2, x2: x1, y2: y1, shapeNumber };
    }
  }
}

export const adjustmentRequired = (type) =>
  ["line", "rectangle", "frame"].includes(type);

export const nearPoint = (x, y, x1, y1, name) => {
  return Math.abs(x - x1) < 5 && Math.abs(y - y1) < 5 ? name : null;
};

export const distance = (a, b) =>
  Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));

export function onLine(x1, y1, x2, y2, x, y, maxDistance = 1) {
  const a = { x: x1, y: y1 };
  const b = { x: x2, y: y2 };
  const c = { x, y };
  const offset = distance(a, b) - (distance(a, c) + distance(b, c));
  return Math.abs(offset) < maxDistance ? "inside" : null;
}

export function positionWithinElement(ctx, x, y, element) {
  const { type, x1, y1, x2, y2 } = element;

  switch (type) {
    case "line":
      const on = onLine(x1, y1, x2, y2, x, y);
      const start = nearPoint(x, y, x1, y1, "start");
      const end = nearPoint(x, y, x2, y2, "end");
      return start || end || on;
    case "rectangle":
    case "frame":
      const topleft = nearPoint(x, y, x1, y1, "tl");
      const topright = nearPoint(x, y, x2, y1, "tr");
      const bottomleft = nearPoint(x, y, x1, y2, "bl");
      const bottomright = nearPoint(x, y, x2, y2, "br");
      const inside = x >= x1 && x <= x2 && y >= y1 && y <= y2 ? "inside" : null;
      return topleft || topright || bottomleft || bottomright || inside;
    case "ellipse":
      const centerX = (x1 + x2) / 2;
      const centerY = (y1 + y2) / 2;
      const radiusX = Math.abs(x2 - x1) / 2;
      const radiusY = Math.abs(y2 - y1) / 2;
      const ellipseInside =
        (x - centerX) ** 2 / radiusX ** 2 + (y - centerY) ** 2 / radiusY ** 2 <
        1 ? "inside" : null;
      const topLeft = nearPoint(x, y, x1, y1, "tl");
      const topRight = nearPoint(x, y, x2, y1, "tr");
      const bottomLeft = nearPoint(x, y, x1, y2, "bl");
      const bottomRight = nearPoint(x, y, x2, y2, "br");
      return ellipseInside || topLeft || topRight || bottomLeft || bottomRight;
    case "text":
      const textWidth = ctx.measureText(element.text).width;
      const textHeight = 16;
      const textInside =
        x >= x1 && x <= x1 + textWidth && y >= y1 && y <= y1 + textHeight
          ? "inside"
          : null;
      return textInside;
    default:
      console.error("error in positionWithinElement");
      return null;
  }
}

export function getElementAtPosition(ctx, x, y, elements, isFrame = false) {
  if (!elements || !Array.isArray(elements)) return null;

  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i];
    if (!isFrame && element.type === "frame") continue;
    const position = positionWithinElement(ctx, x, y, element);
    if (position) {
      return { ...element, position };
    }
  }
  return null;
}

export const cursorForPosition = (position) => {
  switch (position) {
    case "tl":
    case "br":
    case "start":
    case "end":
      return "nwse-resize";
    case "tr":
    case "bl":
      return "nesw-resize";
    case "inside":
      return "move";
    default:
      return "default";
  }
};

export function resizedCoordinates(clientX, clientY, position, coordinates) {
  const { x1, y1, x2, y2 } = coordinates;
  switch (position) {
    case "tl":
    case "start":
      return { x1: clientX, y1: clientY, x2, y2 };
    case "tr":
      return { x1, y1: clientY, x2: clientX, y2 };
    case "bl":
      return { x1: clientX, y1, x2, y2: clientY };
    case "br":
    case "end":
      return { x1, y1, x2: clientX, y2: clientY };
    default:
      return { x1, y1, x2, y2 };
  }
}

export function getShiftedCoordinates(x1, y1, clientX, clientY, type) {
  let newX2 = clientX;
  let newY2 = clientY;

  if (type === "rectangle" || type === "ellipse" || type === "frame") {
    const dx = clientX - x1;
    const dy = clientY - y1;
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    newX2 = x1 + size * Math.sign(dx);
    newY2 = y1 + size * Math.sign(dy);
  } else if (type === "line") {
    const dx = clientX - x1;
    const dy = clientY - y1;
    const angle = Math.atan2(dy, dx);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    newX2 = x1 + distance * Math.cos(snapAngle);
    newY2 = y1 + distance * Math.sin(snapAngle);
  }

  return { newX2, newY2 };
}

export function isElementInsideFrame(element, frame) {
  if (!element || !frame) return false;
  const { x1, y1, x2, y2 } = element;
  const { x1: frameX1, y1: frameY1, x2: frameX2, y2: frameY2 } = frame;
  return x1 >= frameX1 && y1 >= frameY1 && x2 <= frameX2 && y2 <= frameY2;
}
