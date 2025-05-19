export class Generator {
  constructor() {}

  rectangle(x, y, width, height, options = {}) {
    const shapeOptions = { ...options };

    return {
      type: "rectangle",
      x,
      y,
      width,
      height,
      options: {
        ...shapeOptions,
        strokeStyle: shapeOptions.strokeStyle || "#d9d9d9",
        lineWidth: shapeOptions.lineWidth || 1,
        fillStyle: shapeOptions.fillStyle || "#d9d9d9",
      },
    };
  }

  frame(x, y, width, height, options = {}) {
    const shapeOptions = { ...options };

    return {
      type: "frame",
      x,
      y,
      width,
      height,
      options: {
        ...shapeOptions,
        strokeStyle: shapeOptions.strokeStyle || "white",
        lineWidth: shapeOptions.lineWidth || 1,
        fillStyle: shapeOptions.fillRect || "white",
      },
    };
  }

  line(x1, y1, x2, y2, options = {}) {
    const shapeOptions = { ...options };

    return {
      type: "line",
      x1,
      y1,
      x2,
      y2,
      options: {
        ...shapeOptions,
        strokeStyle: shapeOptions.strokeStyle || "#d9d9d9",
        lineWidth: shapeOptions.lineWidth || 1,
      },
    };
  }

  ellipse(x1, y1, x2, y2, options = {}) {
    const x = (x1 + x2) / 2;
    const y = (y1 + y2) / 2;
    const rX = Math.abs(x1 - x2) / 2;
    const rY = Math.abs(y1 - y2) / 2;
    const rotation = 0;
    const startAngle = 0;
    const endAngle = 2 * Math.PI;

    return {
      type: "ellipse",
      x,
      y,
      rX,
      rY,
      rotation,
      startAngle,
      endAngle,
      options: {
        ...options,
        strokeStyle: options.strokeStyle || "#d9d9d9",
        lineWidth: options.lineWidth || 1,
        fillStyle: options.fillStyle || "#d9d9d9",
      },
    };
  }
}

export class Drawer {
  /**
   *
   * @param {CanvasRenderingContext2D} ctx
   */
  constructor(ctx) {
    this.ctx = ctx;
  }

  clear() {
    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  draw(shape, options = {}) {
    const { type } = shape;
    switch (type) {
      case "rectangle":
        this._drawRectangle(shape);
        break;
      case "line":
        this._drawLine(shape);
        break;
      case "ellipse":
        this._drawEllipse(shape);
        break;
      case "frame":
        this._drawFrame(shape, options.title);
        break;
      default:
        throw new Error(`Unknown shape type: ${type}`);
    }
  }

  _drawRectangle(shape) {
    const { x, y, width, height, options } = shape;
    this.ctx.beginPath();

    this.ctx.fillStyle = options.fillStyle || "white";
    this.ctx.strokeStyle = options.strokeStyle || "black";
    this.ctx.lineWidth = options.lineWidth || 1;

    this.ctx.fillRect(x, y, width, height);
    this.ctx.strokeRect(x, y, width, height);

    this.ctx.stroke();
  }

  _drawLine(shape) {
    const { x1, y1, x2, y2, options } = shape;
    this.ctx.beginPath();

    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.strokeStyle = options.strokeStyle || "black";
    this.ctx.lineWidth = options.lineWidth || 1;

    this.ctx.stroke();
  }

  _drawEllipse(shape) {
    const { x, y, rX, rY, rotation, startAngle, endAngle, options } = shape;
    
    if (options.outsideRect) {
      const { x, y, width, height } = options.outsideRect;
      this.ctx.beginPath();

      this.ctx.strokeStyle = options.strokeStyle || "#d9d9d9";
      this.ctx.fillStyle = options.fillStyle || "#d9d9d9";
      this.ctx.lineWidth = 1;

      this.ctx.strokeRect(x, y, width, height);
      this.ctx.stroke();
    }
    
    this.ctx.beginPath();

    this.ctx.ellipse(x, y, rX, rY, rotation, startAngle, endAngle, false);

    this.ctx.fillStyle = "#000";
    this.ctx.strokeStyle = options.strokeStyle || "black";
    this.ctx.lineWidth = options.lineWidth || 1;

    this.ctx.stroke();
  }

  _drawFrame(shape, title) {
    const { x, y, width, height, options } = shape;
    this.ctx.beginPath();

    this.ctx.fillStyle = options.fillStyle || "white";
    this.ctx.strokeStyle = options.strokeStyle || "black";
    this.ctx.lineWidth = options.lineWidth || 1;

    this.ctx.fillRect(x, y, width, height);
    this.ctx.strokeRect(x, y, width, height);

    this.ctx.fillStyle = "gray";
    this.ctx.font = "12px Arial";
    this.ctx.fillText(title, x, y - 5);

    this.ctx.stroke();
  }
}
