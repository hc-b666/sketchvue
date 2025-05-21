export class Generator {
  constructor() {}

  rectangle(x, y, width, height, options = {}) {
    const shapeOptions = { ...options }

    return {
      type: 'rectangle',
      x,
      y,
      width,
      height,
      options: {
        ...shapeOptions,
        strokeStyle: shapeOptions.strokeStyle || '#d9d9d9',
        lineWidth: shapeOptions.lineWidth || 1,
        fillStyle: shapeOptions.fillStyle || '#d9d9d9',
        borderRadius: shapeOptions.borderRadius || 0,
      },
    }
  }

  frame(x, y, width, height, options = {}) {
    const shapeOptions = { ...options }

    return {
      type: 'frame',
      x,
      y,
      width,
      height,
      options: {
        ...shapeOptions,
        strokeStyle: shapeOptions.strokeStyle || 'white',
        lineWidth: shapeOptions.lineWidth || 1,
        fillStyle: shapeOptions.fillRect || 'white',
        borderRadius: shapeOptions.borderRadius || 0,
      },
    }
  }

  line(x1, y1, x2, y2, options = {}) {
    const shapeOptions = { ...options }

    return {
      type: 'line',
      x1,
      y1,
      x2,
      y2,
      options: {
        ...shapeOptions,
        strokeStyle: shapeOptions.strokeStyle || '#d9d9d9',
        lineWidth: shapeOptions.lineWidth || 1,
      },
    }
  }

  ellipse(x1, y1, x2, y2, options = {}) {
    const x = (x1 + x2) / 2
    const y = (y1 + y2) / 2
    const rX = Math.abs(x1 - x2) / 2
    const rY = Math.abs(y1 - y2) / 2
    const rotation = 0
    const startAngle = 0
    const endAngle = 2 * Math.PI

    return {
      type: 'ellipse',
      x,
      y,
      rX,
      rY,
      rotation,
      startAngle,
      endAngle,
      options: {
        ...options,
        strokeStyle: options.strokeStyle || '#d9d9d9',
        lineWidth: options.lineWidth || 1,
        fillStyle: options.fillStyle || '#d9d9d9',
      },
    }
  }
}

const generator = new Generator()

export function createElement(id, x1, y1, x2, y2, type, shapeNumber, options = {}) {
  switch (type) {
    case 'frame':
      const frameShape = generator.frame(
        Math.min(x1, x2),
        Math.min(y1, y2),
        Math.abs(x2 - x1),
        Math.abs(y2 - y1),
      )
      return {
        id,
        type,
        x1,
        y1,
        x2,
        y2,
        centerX: (x1 + x2) / 2,
        centerY: (y1 + y2) / 2,
        title: `Frame ${shapeNumber}`,
        shapeNumber,
        canvasShape: frameShape,
        children: [],
      }
    case 'line':
      const lineShape = generator.line(x1, y1, x2, y2)
      return {
        id,
        type,
        x1,
        y1,
        x2,
        y2,
        centerX: (x1 + x2) / 2,
        centerY: (y1 + y2) / 2,
        title: `Line ${shapeNumber}`,
        shapeNumber,
        canvasShape: lineShape,
      }
    case 'rectangle':
      const rectShape = generator.rectangle(
        Math.min(x1, x2),
        Math.min(y1, y2),
        Math.abs(x2 - x1),
        Math.abs(y2 - y1),
        options,
      )
      return {
        id,
        type,
        x1,
        y1,
        x2,
        y2,
        centerX: (x1 + x2) / 2,
        centerY: (y1 + y2) / 2,
        title: `Rectangle ${shapeNumber}`,
        shapeNumber,
        canvasShape: rectShape,
      }
    case 'ellipse':
      const ellipesShape = generator.ellipse(x1, y1, x2, y2)
      return {
        id,
        type,
        x1,
        y1,
        x2,
        y2,
        centerX: (x1 + x2) / 2,
        centerY: (y1 + y2) / 2,
        title: `Ellipse ${shapeNumber}`,
        shapeNumber,
        canvasShape: ellipesShape,
      }
    case 'text':
      return {
        id,
        type,
        x1,
        y1,
        x2,
        y2,
        title: `Text ${shapeNumber}`,
        shapeNumber,
        text: '',
      }
    default:
      console.error('Unknown element type:', type)
      return null
  }
}

export class Drawer {
  /**
   *
   * @param {CanvasRenderingContext2D} ctx
   */
  constructor(ctx) {
    this.ctx = ctx
  }

  clear() {
    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
  }

  draw(shape, options = {}) {
    const { type } = shape
    switch (type) {
      case 'rectangle':
        this._drawRectangle(shape)
        break
      case 'line':
        this._drawLine(shape)
        break
      case 'ellipse':
        this._drawEllipse(shape)
        break
      case 'frame':
        this._drawFrame(shape, options.title)
        break
      default:
        throw new Error(`Unknown shape type: ${type}`)
    }
  }

  _drawRectangle(shape) {
    const { x, y, width, height, options } = shape
    this.ctx.beginPath()

    this.ctx.fillStyle = options.fillStyle || 'white'
    this.ctx.strokeStyle = options.strokeStyle || 'black'
    this.ctx.lineWidth = options.lineWidth || 1

    // this.ctx.translate(x + width / 2, y + height / 2);
    // this.ctx.rotate((Math.PI / 180) * 25);
    // this.ctx.translate(-(x + width / 2), -(y + height / 2));
    // this.ctx.fillRect(x, y, width, height);
    // this.ctx.strokeRect(x, y, width, height);
    this.ctx.roundRect(x, y, width, height, options.borderRadius)
    this.ctx.fill()
    this.ctx.stroke()

    this.ctx.stroke()
  }

  _drawLine(shape) {
    const { x1, y1, x2, y2, options } = shape
    this.ctx.beginPath()

    this.ctx.moveTo(x1, y1)
    this.ctx.lineTo(x2, y2)
    this.ctx.strokeStyle = options.strokeStyle || 'black'
    this.ctx.lineWidth = options.lineWidth || 1

    this.ctx.stroke()
  }

  _drawEllipse(shape) {
    const { x, y, rX, rY, rotation, startAngle, endAngle, options } = shape

    if (options.outsideRect) {
      const { x, y, width, height } = options.outsideRect
      this.ctx.beginPath()

      this.ctx.strokeStyle = options.strokeStyle || '#d9d9d9'
      this.ctx.fillStyle = options.fillStyle || '#d9d9d9'
      this.ctx.lineWidth = 1

      this.ctx.strokeRect(x, y, width, height)
      this.ctx.stroke()
    }

    this.ctx.beginPath()

    this.ctx.ellipse(x, y, rX, rY, rotation, startAngle, endAngle, false)

    this.ctx.fillStyle = options.fillStyle || '#d9d9d9'
    this.ctx.strokeStyle = options.strokeStyle || '#d9d9d9'
    this.ctx.lineWidth = options.lineWidth || 1

    this.ctx.stroke()
    this.ctx.fill()
  }

  _drawFrame(shape, title) {
    const { x, y, width, height, options } = shape
    this.ctx.beginPath()

    this.ctx.fillStyle = options.fillStyle || 'white'
    this.ctx.strokeStyle = options.strokeStyle || 'black'
    this.ctx.lineWidth = options.lineWidth || 1

    // this.ctx.fillRect(x, y, width, height);
    // this.ctx.strokeRect(x, y, width, height);
    this.ctx.roundRect(x, y, width, height, options.borderRadius)
    this.ctx.fill()
    this.ctx.stroke()

    this.ctx.fillStyle = 'gray'
    this.ctx.font = '12px Arial'
    this.ctx.fillText(title, x, y - 8)

    this.ctx.stroke()
  }
}
