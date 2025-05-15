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
      options: shapeOptions,
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
      options: shapeOptions,
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

  draw(shape) {
    const { type } = shape;
    switch (type) {
      case "rectangle":
        this._drawRectangle(shape);
        break;
      case "line":
        this._drawLine(shape);
        break;
      default:
        throw new Error(`Unknown shape type: ${type}`);
    }
  }

  _drawRectangle(shape) {
    const { x, y, width, height, options } = shape;
    this.ctx.beginPath();

    this.ctx.fillStyle = '#000';
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 1;

    this.ctx.fillRect(x, y, width, height);
    this.ctx.strokeRect(x, y, width, height);

    this.ctx.stroke();
  }

  _drawLine(shape) {
    const { x1, y1, x2, y2, options } = shape;
    this.ctx.beginPath();

    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.strokeStyle = "black";
    this.ctx.lineWidth = 1;

    this.ctx.stroke();
  }
}
