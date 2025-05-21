<script setup>
  import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
  import { useHistory } from './hooks/useHistory'
  import { Drawer, createElement } from './Drawer'
  import {
    adjustElementCoordinates,
    adjustmentRequired,
    cursorForPosition,
    getElementAtPosition,
    getShiftedCoordinates,
    isElementInsideFrame,
    positionWithinElement,
    resizedCoordinates,
    viewPaddings,
  } from './utils/coordinates'
  import IconMousePointer from './icons/IconMousePointer.vue'
  import IconRectangle from './icons/IconRectangle.vue'
  import IconSlash from './icons/IconSlash.vue'
  import IconCircle from './icons/IconCircle.vue'
  import IconTypeOutline from './icons/IconTypeOutline.vue'
  import IconFrame from './icons/IconFrame.vue'
  import IconUndo from './icons/IconUndo.vue'
  import IconRedo from './icons/IconRedo.vue'
  import IconImage from './icons/IconImage.vue'

  import Select from 'primevue/select'
  import Button from 'primevue/button'
  import InputNumber from 'primevue/inputnumber'

  String.prototype.toCapitalize = function () {
    return this.charAt(0).toUpperCase() + this.slice(1).toLowerCase()
  }

  const canvas = ref(null)
  const textarea = ref(null)
  /**
   * @type {CanvasRenderingContext2D}
   */
  let ctx = null
  const tools = ['selection', 'frame', 'rectangle', 'line', 'ellipse', 'text', 'image']
  function changeTool(newTool) {
    action.value = 'none'
    selectedElement.value = null
    selectedElement2.value = null

    if (newTool === 'image') {
      // handle image upload
      return
    }

    if (tools.includes(newTool)) tool.value = newTool
  }

  const numberOfShapes = {
    line: 0,
    rectangle: 0,
    ellipse: 0,
    text: 0,
    frame: 0,
  }

  const toolIcons = {
    selection: IconMousePointer,
    rectangle: IconRectangle,
    line: IconSlash,
    ellipse: IconCircle,
    text: IconTypeOutline,
    frame: IconFrame,
    image: IconImage,
  }

  const { state: elements, setState: setElements, undo, redo } = useHistory([])
  const action = ref('none')
  const tool = ref('rectangle')
  const selectedElement = ref(null)
  const selectedElement2 = ref(null)
  const panOffset = ref({ x: 0, y: 0 })
  const startPanMousePos = ref({ x: 0, y: 0 })
  const shiftPressed = ref(false)
  const canvaBgColor = ref('#1e1e1e')
  const lastHoveredElement = ref(null)
  const lastHoveredOriginalOptions = ref(null)
  const viewPaddingsPressed = ref(false)
  const zoomLevel = ref(1)
  const selectedExportType = ref(null)
  const exportTypes = [
    { label: 'PNG', value: 'png' },
    { label: 'JPEG', value: 'jpeg' },
    { label: 'WEBP', value: 'webp' },
  ]

  onMounted(() => {
    ctx = canvas.value.getContext('2d')
    renderCanvas()
    autoFocusTextarea()

    canvas.value.addEventListener('mousedown', handleMousedown)
    canvas.value.addEventListener('mousemove', handleMousemove)
    canvas.value.addEventListener('mouseup', handleMouseup)

    canvas.value.addEventListener('dblclick', handleDblClick)

    document.addEventListener('keydown', undoredo)
    document.addEventListener('keyup', handleShiftKeyup)

    canvas.value.addEventListener('wheel', handleWheelZoom)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', undoredo)
    document.removeEventListener('keyup', handleShiftKeyup)

    if (canvas.value) {
      canvas.value.removeEventListener('mousedown', handleMousedown)
      canvas.value.removeEventListener('mousemove', handleMousemove)
      canvas.value.removeEventListener('mouseup', handleMouseup)

      canvas.value.removeEventListener('dblclick', handleDblClick)
      canvas.value.removeEventListener('wheel', handleWheelZoom)
    }
  })

  watch(
    [
      elements,
      action,
      selectedElement,
      selectedElement2,
      panOffset,
      shiftPressed,
      viewPaddingsPressed,
      zoomLevel,
    ],
    renderCanvas,
    { deep: true },
  )
  watch([action, selectedElement], autoFocusTextarea, { deep: true })
  watch(
    [
      () => selectedElement2.value?.canvasShape?.options?.fillStyle,
      () => selectedElement2.value?.canvasShape?.options?.strokeStyle,
      () => selectedElement2.value?.canvasShape?.options?.borderRadius,
    ],
    (
      [newFillStyle, newStrokeStyle, newBorderRadius],
      [oldFillStyle, oldStrokeStyle, oldBorderRadius],
    ) => {
      if (
        selectedElement2.value &&
        typeof selectedElement2.value.id === 'number' &&
        selectedElement2.value.canvasShape
      ) {
        const idx = selectedElement2.value.id
        const currentElements = elements.value
        if (currentElements && currentElements[idx]) {
          const { x1, y1, x2, y2, type, shapeNumber } = currentElements[idx]
          const options = {}
          if (newFillStyle !== undefined && newFillStyle !== oldFillStyle)
            options.fillStyle = newFillStyle
          if (newStrokeStyle !== undefined && newStrokeStyle !== oldStrokeStyle)
            options.strokeStyle = newStrokeStyle
          if (newBorderRadius !== undefined && newBorderRadius !== oldBorderRadius)
            options.borderRadius = newBorderRadius
          if (Object.keys(options).length > 0) {
            updateElement(idx, x1, y1, x2, y2, type, shapeNumber, options)
          }
        }
      }
    },
    { deep: true },
  )
  watch(
    [
      () => selectedElement2.value?.canvasShape?.width,
      () => selectedElement2.value?.canvasShape?.height,
    ],
    ([newWidth, newHeight], [oldWidth, oldHeight]) => {
      if (
        selectedElement2.value &&
        typeof selectedElement2.value.id === 'number' &&
        selectedElement2.value.canvasShape &&
        (newWidth !== oldWidth || newHeight !== oldHeight)
      ) {
        const idx = selectedElement2.value.id
        const currentElements = elements.value
        if (currentElements && currentElements[idx]) {
          const { x1, y1, type, shapeNumber } = currentElements[idx]
          const x2 = x1 + Number(newWidth)
          const y2 = y1 + Number(newHeight)
          updateElement(idx, x1, y1, x2, y2, type, shapeNumber, {
            ...selectedElement2.value.canvasShape.options,
          })
        }
      }
    },
    { deep: true },
  )

  const undoredo = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') undo()
    else if ((e.metaKey || e.ctrlKey) && e.key === 'y') redo()
    else if (e.key === 'Shift') shiftPressed.value = true
    else if (e.key === 'Control') viewPaddingsPressed.value = true
  }

  function renderCanvas() {
    if (!canvas.value) return
    canvas.value.width = window.innerWidth
    canvas.value.height = window.innerHeight
    const ctx = canvas.value.getContext('2d')
    const drawer = new Drawer(ctx)

    drawer.clear()
    ctx.save()
    ctx.translate(panOffset.value.x, panOffset.value.y)
    ctx.scale(zoomLevel.value, zoomLevel.value)

    const currentElements = elements.value
    if (currentElements && Array.isArray(currentElements)) {
      currentElements
        .filter((el) => el.type === 'frame')
        .forEach((el) => {
          drawElement(drawer, el)
        })
      currentElements
        .filter((el) => el.type !== 'frame')
        .forEach((element) => {
          if (action.value === 'writing' && selectedElement.value.id === element.id) return
          drawElement(drawer, element)
        })
    }

    if (
      viewPaddingsPressed.value &&
      selectedElement2.value &&
      selectedElement2.value.type !== 'frame'
    ) {
      const frame = elements.value.find(
        (el) => el.type === 'frame' && isElementInsideFrame(selectedElement2.value, el),
      )
      if (frame) {
        const paddings = viewPaddings(selectedElement2.value, frame)
        const { x1, y1, x2, y2 } = selectedElement2.value
        const { x1: fx1, y1: fy1, x2: fx2, y2: fy2 } = frame

        ctx.save()
        ctx.strokeStyle = 'red'
        ctx.fillStyle = 'red'
        ctx.lineWidth = 1
        ctx.font = '14px Arial'
        ctx.textBaseline = 'middle'

        const centerX = x1 + (x2 - x1) / 2
        const centerY = y1 + (y2 - y1) / 2

        ctx.beginPath()
        ctx.moveTo(centerX, fy1)
        ctx.lineTo(centerX, y1)
        ctx.stroke()
        ctx.fillText(
          parseInt(paddings.paddingTop),
          centerX + 6,
          fy1 + parseInt(paddings.paddingTop) / 2,
        )

        ctx.beginPath()
        ctx.moveTo(centerX, y2)
        ctx.lineTo(centerX, fy2)
        ctx.stroke()
        ctx.fillText(parseInt(paddings.paddingBottom), centerX + 6, y2 + paddings.paddingBottom / 2)

        ctx.beginPath()
        ctx.moveTo(fx1, centerY)
        ctx.lineTo(x1, centerY)
        ctx.stroke()
        ctx.fillText(
          parseInt(paddings.paddingLeft),
          fx1 + parseInt(paddings.paddingLeft) / 2,
          centerY - 8,
        )

        ctx.beginPath()
        ctx.moveTo(x2, centerY)
        ctx.lineTo(fx2, centerY)
        ctx.stroke()
        ctx.fillText(
          parseInt(paddings.paddingRight),
          x2 + parseInt(paddings.paddingRight) / 2,
          centerY - 8,
        )
      }
    }

    ctx.restore()
  }

  function autoFocusTextarea() {
    if (textarea.value && action.value === 'writing') {
      setTimeout(() => {
        textarea.value.focus()
        textarea.value = selectedElement.value.text
      }, 0)
    }
  }

  function handleShiftKeyup(e) {
    if (e.key === 'Shift') shiftPressed.value = false
    else if (e.key === 'Control') viewPaddingsPressed.value = false
  }

  const layers = computed(() => {
    const frames = elements.value.filter((el) => el.type === 'frame')
    const otherElements = elements.value.filter((el) => el.type !== 'frame')

    const insideFrameIds = new Set()
    frames.forEach((frame) => {
      frame.children = otherElements.filter((child) => isElementInsideFrame(child, frame))
      frame.children.forEach((child) => insideFrameIds.add(child.id))
    })

    const lays = elements.value.filter((el) => el.type === 'frame' || !insideFrameIds.has(el.id))

    return lays
  })

  function handleWheelZoom(e) {
    e.preventDefault()

    const rect = canvas.value.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const beforeZoomX = (mouseX - panOffset.value.x) / zoomLevel.value
    const beforeZoomY = (mouseY - panOffset.value.y) / zoomLevel.value

    let newZoom = zoomLevel.value
    if (e.deltaY < 0) newZoom = Math.min(zoomLevel.value + 0.1, 3)
    else newZoom = Math.max(zoomLevel.value - 0.1, 0.5)

    panOffset.value = {
      x: mouseX - beforeZoomX * newZoom,
      y: mouseY - beforeZoomY * newZoom,
    }

    zoomLevel.value = newZoom
  }

  function drawElement(drawer, element) {
    if (!element) return

    const isSelected = selectedElement2.value && selectedElement2.value.id === element.id

    switch (element.type) {
      case 'line':
      case 'rectangle':
        const options = { ...(element.canvasShape.options || {}) }
        if (isSelected) {
          options.strokeStyle = '#3498db'
          options.lineWidth = 2
        }
        drawer.draw({ ...element.canvasShape, options })
        break
      case 'ellipse':
        const ellipseOptions = { ...(element.canvasShape.options || {}) }
        if (isSelected && selectedElement2.value.type === 'ellipse') {
          ellipseOptions.strokeStyle = '#3498db'
          ellipseOptions.lineWidth = 2
          ellipseOptions.outsideRect = {
            x: element.x1,
            y: element.y1,
            width: element.x2 - element.x1,
            height: element.y2 - element.y1,
          }
        }
        drawer.draw({ ...element.canvasShape, options: ellipseOptions })
        break
      case 'frame':
        const frameOptions = { ...(element.canvasShape.options || {}) }
        if (isSelected) {
          frameOptions.strokeStyle = 'blue'
          frameOptions.lineWidth = 2
        }
        drawer.draw({ ...element.canvasShape, options: frameOptions }, { title: element.title })
        break
      case 'text':
        ctx.textBaseline = 'top'
        ctx.font = '16px Arial'
        ctx.fillStyle = 'white'
        ctx.fillText(element.text, element.x1, element.y1)
        break
      default:
        console.error('Unknown element type:', element.type)
    }
  }

  function updateElement(id, x1, y1, x2, y2, type, shapeNumber, options = {}) {
    const currentElements = elements.value
    if (!currentElements || !Array.isArray(currentElements)) return

    const elementsCopy = [...currentElements]

    const existingElement = elementsCopy[id]
    const existingFillStyle = existingElement?.canvasShape?.options?.fillStyle

    switch (type) {
      case 'line':
      case 'rectangle':
      case 'ellipse':
      case 'frame':
        const newElement = createElement(id, x1, y1, x2, y2, type, shapeNumber, options)
        if (existingFillStyle && !options.fillStyle) {
          newElement.canvasShape.options.fillStyle = existingFillStyle
        } else if (options.fillStyle) {
          newElement.canvasShape.options.fillStyle = options.fillStyle
        }
        elementsCopy[id] = newElement
        break
      case 'text':
        const text = options.text || ''
        const textWidth = ctx ? ctx.measureText(text).width : 100
        const textHeight = 16

        elementsCopy[id] = {
          ...createElement(id, x1, y1, x1 + textWidth, y1 + textHeight, type, shapeNumber),
          text,
        }
        break
      default:
        console.error('Unknown element type:', type)
    }

    setElements(elementsCopy, true)
  }

  function getMouseCoordinates(e) {
    const clientX = (e.clientX - panOffset.value.x) / zoomLevel.value
    const clientY = (e.clientY - panOffset.value.y) / zoomLevel.value
    return { clientX, clientY }
  }

  function handleDblClick(e) {
    if (tool.value !== 'selection') return
    const { clientX, clientY } = getMouseCoordinates(e)
    const element = getElementAtPosition(ctx, clientX, clientY, elements.value)
    if (element && element.type === 'text' && element.position === 'inside') {
      selectedElement.value = {
        ...element,
        offsetX: clientX - element.x1,
        offsetY: clientY - element.y1,
      }
      action.value = 'writing'
      setTimeout(() => {
        if (textarea.value) {
          textarea.value.focus()
          textarea.value.value = element.text
        }
      }, 0)
    }
  }

  function handleMousedown(e) {
    if (action.value === 'writing') return

    const { clientX, clientY } = getMouseCoordinates(e)

    if (selectedElement.value && selectedElement.value.type === 'frame') {
      const position = positionWithinElement(ctx, clientX, clientY, selectedElement.value)

      if (position && position !== 'inside') {
        action.value = 'resizing'
        selectedElement.value = {
          ...selectedElement.value,
          position,
          offsetX: clientX - selectedElement.value.x1,
          offsetY: clientY - selectedElement.value.y1,
        }
        selectedElement2.value = { ...selectedElement.value }
      } else if (position === 'inside') {
        action.value = 'moving'
        selectedElement.value = {
          ...selectedElement.value,
          position,
          offsetX: clientX - selectedElement.value.x1,
          offsetY: clientY - selectedElement.value.y1,
        }
        selectedElement2.value = { ...selectedElement.value }
      }

      if (canvas.value) {
        canvas.value.style.cursor = cursorForPosition(selectedElement.value.position)
      }

      return
    }

    if (tool.value === 'selection') {
      const element = getElementAtPosition(ctx, clientX, clientY, elements.value)
      if (element) {
        const offsetX = clientX - element.x1
        const offsetY = clientY - element.y1

        selectedElement.value = { ...element, offsetX, offsetY }
        selectedElement2.value = { ...element, offsetX, offsetY }

        if (element.position === 'inside') action.value = 'moving'
        else action.value = 'resizing'

        if (canvas.value) {
          canvas.value.style.cursor = cursorForPosition(element.position)
        }
      } else {
        selectedElement2.value = null
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
          action.value = 'panning'
          startPanMousePos.value = { x: e.clientX, y: e.clientY }
        }
      }
    } else {
      const currentElements = elements.value || []
      const id = currentElements.length
      const shapeNumber = ++numberOfShapes[tool.value]
      const element = createElement(id, clientX, clientY, clientX, clientY, tool.value, shapeNumber)

      setElements([...currentElements, element])
      selectedElement.value = element

      action.value = tool.value === 'text' ? 'writing' : 'drawing'

      if (tool.value === 'text') {
        setTimeout(() => {
          if (textarea.value) {
            textarea.value.focus()
            textarea.value.value = ''
          }
        }, 0)
      }
    }
  }

  function handleMousemove(e) {
    const { clientX, clientY } = getMouseCoordinates(e)

    if (action.value === 'panning') {
      const deltaX = e.clientX - startPanMousePos.value.x
      const deltaY = e.clientY - startPanMousePos.value.y
      panOffset.value = {
        x: panOffset.value.x + deltaX,
        y: panOffset.value.y + deltaY,
      }
      startPanMousePos.value = {
        x: e.clientX,
        y: e.clientY,
      }
      return
    }

    if (action.value === 'drawing') {
      const currentElements = elements.value
      if (!currentElements || !Array.isArray(currentElements) || currentElements.length === 0)
        return

      const index = currentElements.length - 1
      const { x1, y1, shapeNumber, type } = currentElements[index]

      if (
        shiftPressed.value &&
        (type === 'rectangle' || type === 'line' || type === 'ellipse' || type === 'frame')
      ) {
        const { newX2, newY2 } = getShiftedCoordinates(x1, y1, clientX, clientY, type)
        updateElement(index, x1, y1, newX2, newY2, type, shapeNumber)
      } else {
        updateElement(index, x1, y1, clientX, clientY, tool.value, shapeNumber)
      }
    } else if (action.value === 'moving') {
      if (!selectedElement.value) return

      const { id, x1, x2, y1, y2, type, offsetX, offsetY, shapeNumber } = selectedElement.value
      const width = x2 - x1
      const height = y2 - y1
      const newX1 = clientX - offsetX
      const newY1 = clientY - offsetY
      const options = type === 'text' ? { text: selectedElement.value.text } : {}
      updateElement(id, newX1, newY1, newX1 + width, newY1 + height, type, shapeNumber, options)

      selectedElement2.value = {
        ...selectedElement.value,
        x1: newX1,
        y1: newY1,
        x2: newX1 + width,
        y2: newY1 + height,
        canvasShape: {
          ...selectedElement.value.canvasShape,
          x: newX1,
          y: newY1,
          width,
          height,
        },
      }
    } else if (action.value === 'resizing') {
      if (!selectedElement.value || !selectedElement.value.position) return

      const { id, type, position, x1, y1, x2, y2, shapeNumber } = selectedElement.value
      const coords = resizedCoordinates(clientX, clientY, position, { x1, y1, x2, y2 })
      if (shiftPressed.value && (type === 'rectangle' || type === 'line' || type === 'ellipse')) {
        const { newX2, newY2 } = getShiftedCoordinates(
          coords.x1,
          coords.y1,
          coords.x2,
          coords.y2,
          type,
        )
        updateElement(id, coords.x1, coords.y1, newX2, newY2, type, shapeNumber)
      } else {
        updateElement(id, coords.x1, coords.y1, coords.x2, coords.y2, type, shapeNumber)
      }

      selectedElement2.value = {
        ...selectedElement.value,
        x1: coords.x1,
        y1: coords.y1,
        x2: coords.x2,
        y2: coords.y2,
        canvasShape: {
          ...selectedElement.value.canvasShape,
          x: coords.x1,
          y: coords.y1,
          width: coords.x2 - coords.x1,
          height: coords.y2 - coords.y1,
        },
      }
    } else if (action.value === 'none') {
      let element = getElementAtPosition(ctx, clientX, clientY, elements.value, true)
      if (selectedElement.value && selectedElement.value.type === 'frame') {
        element = getElementAtPosition(ctx, clientX, clientY, elements.value, true)
      } else {
        element = getElementAtPosition(ctx, clientX, clientY, elements.value, false)
      }
      if (canvas.value) {
        canvas.value.style.cursor = element ? cursorForPosition(element.position) : 'default'
      }

      if (lastHoveredElement.value && (!element || element.id !== lastHoveredElement.value.id)) {
        const prev = elements.value[lastHoveredElement.value.id]
        if (
          prev &&
          prev.canvasShape &&
          prev.canvasShape.options &&
          lastHoveredOriginalOptions.value
        ) {
          updateElement(prev.id, prev.x1, prev.y1, prev.x2, prev.y2, prev.type, prev.shapeNumber, {
            ...prev.canvasShape.options,
            ...lastHoveredOriginalOptions.value,
          })
        }
        lastHoveredElement.value = null
        lastHoveredOriginalOptions.value = null
      }

      if (element && (!lastHoveredElement.value || element.id !== lastHoveredElement.value.id)) {
        lastHoveredElement.value = { ...element }
        lastHoveredOriginalOptions.value = {
          strokeStyle: element.canvasShape.options?.strokeStyle,
          lineWidth: element.canvasShape.options?.lineWidth,
        }
        const hoverOptions = {
          ...element.canvasShape.options,
          strokeStyle: '#3498db',
          lineWidth: 3,
        }
        updateElement(
          element.id,
          element.x1,
          element.y1,
          element.x2,
          element.y2,
          element.type,
          element.shapeNumber,
          hoverOptions,
        )
      }
    }
  }

  function handleMouseup(e) {
    const { clientX, clientY } = getMouseCoordinates(e)

    if (selectedElement.value) {
      if (
        selectedElement.value.type === 'text' &&
        clientX - selectedElement.value.offsetX === selectedElement.value.x1 &&
        clientY - selectedElement.value.offsetY === selectedElement.value.y1
      ) {
        action.value = 'writing'
        return
      }

      const index = selectedElement.value.id
      const currentElements = elements.value
      if (!currentElements || !Array.isArray(currentElements) || !currentElements[index]) {
        action.value = 'none'
        selectedElement.value = null
        return
      }

      const { id, type } = currentElements[index]
      if ((action.value === 'drawing' || action.value === 'resizing') && adjustmentRequired(type)) {
        const { x1, y1, x2, y2, shapeNumber } = adjustElementCoordinates(currentElements[index])
        updateElement(id, x1, y1, x2, y2, type, shapeNumber)
      }
    }

    if (action.value === 'writing') return

    if (canvas.value) {
      canvas.value.style.cursor = 'default'
    }

    tool.value = 'selection'
    action.value = 'none'
    selectedElement.value = null
  }

  function handleBlur(e) {
    if (!selectedElement.value) return

    const { id, x1, y1, type, shapeNumber } = selectedElement.value
    const text = e.target.value

    if (text && text.trim() !== '') {
      const textWidth = ctx.measureText(text).width || 100
      const textHeight = 16

      updateElement(id, x1, y1, x1 + textWidth, y1 + textHeight, type, shapeNumber, { text })
    }

    action.value = 'none'
    selectedElement.value = null
  }

  function setSelectedElement(el) {
    selectedElement.value = { ...el }
    selectedElement2.value = { ...el }
    action.value = 'none'
  }

  function handleAlign(align) {
    if (selectedElement2.value && selectedElement2.value.type === 'frame') return

    const frames = elements.value.filter((el) => el.type === 'frame')
    if (frames.length === 0) return

    frames.forEach((frame) => {
      if (!isElementInsideFrame(selectedElement2.value, frame)) return

      const { x1, y1, x2, y2 } = selectedElement2.value
      const { x1: fx1, y1: fy1, x2: fx2, y2: fy2 } = frame

      switch (align) {
        case 'left-hor':
          updateElement(
            selectedElement2.value.id,
            fx1,
            y1,
            fx1 + (x2 - x1),
            y2,
            selectedElement2.value.type,
            selectedElement2.value.shapeNumber,
          )
          break
        case 'center-hor':
          const leftpad = (fx2 - fx1 - (x2 - x1)) / 2
          updateElement(
            selectedElement2.value.id,
            fx1 + leftpad,
            y1,
            fx1 + leftpad + (x2 - x1),
            y2,
            selectedElement2.value.type,
            selectedElement2.value.shapeNumber,
          )
          break
        case 'right-hor':
          updateElement(
            selectedElement2.value.id,
            x1 + (fx2 - x2),
            y1,
            fx2,
            y2,
            selectedElement2.value.type,
            selectedElement2.value.shapeNumber,
          )
          break
        case 'top-ver':
          updateElement(
            selectedElement2.value.id,
            x1,
            fy1,
            x2,
            fy1 + (y2 - y1),
            selectedElement2.value.type,
            selectedElement2.value.shapeNumber,
          )
          break
        case 'center-ver':
          const toppad = (fy2 - fy1 - (y2 - y1)) / 2
          updateElement(
            selectedElement2.value.id,
            x1,
            fy1 + toppad,
            x2,
            fy1 + toppad + (y2 - y1),
            selectedElement2.value.type,
            selectedElement2.value.shapeNumber,
          )
          break
        case 'bottom-ver':
          updateElement(
            selectedElement2.value.id,
            x1,
            y1 + (fy2 - y2),
            x2,
            fy2,
            selectedElement2.value.type,
            selectedElement2.value.shapeNumber,
          )
          break
        default:
          break
      }

      selectedElement2.value = elements.value[selectedElement2.value.id]
    })
  }

  function handleExport() {
    if (!selectedExportType.value) {
      alert('Please select an export type')
      return
    }

    let canvasUrl = canvas.value.toDataURL(`image/${selectedExportType.value.value}`, 1.0)
    const createEl = document.createElement('a')
    createEl.href = canvasUrl

    createEl.download = `canvas.${selectedExportType.value.value}`

    createEl.click()
    createEl.remove()
  }
</script>

<template>
  <div id="app">
    <div id="toolbar">
      <div class="tool-section">
        <button
          v-for="t in tools"
          :key="t"
          @click="changeTool(t)"
          :class="{ active: tool === t }"
        >
          <component
            :is="toolIcons[t]"
            style="width: 16px; height: 16px"
          ></component>
        </button>
      </div>

      <div class="tool-section">
        <button
          @click="undo"
          title="Undo (Ctrl+Z)"
        >
          <IconUndo style="width: 16px; height: 16px" />
        </button>
        <button
          @click="redo"
          title="Redo (Ctrl+Y)"
        >
          <IconRedo style="width: 16px; height: 16px" />
        </button>
      </div>
    </div>

    <aside id="sidebar-left">
      <h5>Layers</h5>
      <div
        v-for="el in layers"
        :key="el.id"
      >
        <button @click="setSelectedElement(el)">
          {{ el.title }}
        </button>
        <div v-if="el.type === 'frame' && el.children.length > 0">
          <ul style="padding-left: 8px">
            <li
              v-for="child in el.children"
              :key="child.id"
            >
              <button @click="setSelectedElement(child)">
                {{ child.title }}
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div class="export-controls">
        <Button
          @click="handleExport"
          label="Export"
          size="small"
          style="width: auto"
        />

        <Select
          v-model="selectedExportType"
          :options="exportTypes"
          optionLabel="label"
          :default-value="exportTypes[0]"
          style="width: auto"
          size="small"
        />
      </div>
    </aside>

    <aside class="sidebar-right">
      <!-- line -->
      <div
        v-if="selectedElement2 && selectedElement2.type === 'line'"
        class="sidebar-right-content"
      >
        <span>
          {{ selectedElement2.type.toCapitalize() }}
        </span>
        <div class="sidebar-right-content_position">
          <h5>Position</h5>
          <div class="sidebar-right-content_position_items">
            <p>X: {{ parseInt(selectedElement2.x1) }}</p>
            <p>Y: {{ parseInt(selectedElement2.y1) }}</p>
          </div>
        </div>
        <div class="sidebar-right-content_layout">
          <h5>Layout</h5>
          <div class="sidebar-right-content_layout_items">
            <p>Width: {{ parseInt(Math.abs(selectedElement2.x2 - selectedElement2.x1)) }}</p>
            <p>Height: 0</p>
          </div>
        </div>
      </div>

      <!-- text -->
      <div
        v-else-if="selectedElement2 && selectedElement2.type === 'text'"
        class="sidebar-right-content"
      >
        <span>
          {{ selectedElement2.type.toCapitalize() }}
        </span>
        <div class="sidebar-right-content_position">
          <h5>Position</h5>
          <div class="sidebar-right-content_position_items">
            <p>X: {{ parseInt(selectedElement2.x1) }}</p>
            <p>Y: {{ parseInt(selectedElement2.y1) }}</p>
          </div>
        </div>
        <div class="sidebar-right-content_layout">
          <h5>Layout</h5>
          <div class="sidebar-right-content_layout_items">
            <p>Width: {{ parseInt(selectedElement2.x2 - selectedElement2.x1) }}</p>
            <p>Height: {{ parseInt(selectedElement2.y2 - selectedElement2.y1) }}</p>
          </div>
        </div>
      </div>

      <!-- rectangle, ellipse -->
      <div
        v-else-if="
          selectedElement2 && selectedElement2.type !== 'line' && selectedElement2.type !== 'text'
        "
        class="sidebar-right__rectangle"
      >
        <h5>{{ selectedElement2.type.toCapitalize() }}</h5>

        <!-- alignment -->
        <div class="sidebar-right-content_alignment">
          <h5>Alignment</h5>
          <div class="sidebar-right-content_alignment_items">
            <button @click="handleAlign('left-hor')">Left -</button>
            <button @click="handleAlign('center-hor')">Center -</button>
            <button @click="handleAlign('right-hor')">Right -</button>
          </div>
          <div class="sidebar-right-content_alignment_items">
            <button @click="handleAlign('top-ver')">Top |</button>
            <button @click="handleAlign('center-ver')">Center |</button>
            <button @click="handleAlign('bottom-ver')">Bottom |</button>
          </div>
        </div>

        <!-- position -->
        <div class="sidebar-right-content_position">
          <h5>Position</h5>
          <div class="sidebar-right-content_position_items">
            <p>X: {{ parseInt(selectedElement2.canvasShape.x) }}</p>
            <p>Y: {{ parseInt(selectedElement2.canvasShape.y) }}</p>
          </div>
        </div>

        <!-- layout -->
        <div class="sidebar-right__rectangle-styles">
          <h5>Styles</h5>
          <div class="sidebar-right__rectangle-styles-dimensions">
            <label for="">
              Width:
              <InputNumber
                :value="selectedElement2.canvasShape.options.width"
                @input="
                  (e) => {
                    selectedElement2.canvasShape.width = e.target.value
                  }
                "
                inputId="integeronly"
                fluid
              />
            </label>
            <p>Width: {{ parseInt(selectedElement2.canvasShape.width) }}</p>
            <p>Height: {{ parseInt(selectedElement2.canvasShape.height) }}</p>
          </div>

          <!-- rectangle fill style -->
          <div class="sidebar-right__rectangle-styles-background">
            <label
              for="rectCircBgColor"
              style="font-size: 14px"
              >Fill Style</label
            >
            <div @click="$refs.rectCircBgColor.click()">
              <span>{{ selectedElement2.canvasShape.options.fillStyle }}</span>
              <input
                id="rectCircBgColor"
                type="color"
                :value="selectedElement2.canvasShape.options.fillStyle"
                @input="
                  (e) => {
                    selectedElement2.canvasShape.options.fillStyle = e.target.value
                  }
                "
                style="background: transparent"
                ref="rectCircBgColor"
                @click.stop
              />
            </div>
          </div>

          <!-- rectangle stroke style -->
          <div class="sidebar-right__rectangle-styles-stroke">
            <label
              for="rectCircStroke"
              style="font-size: 14px"
              >Stroke Style</label
            >
            <div @click="$refs.rectCircStroke.click()">
              <span>{{ selectedElement2.canvasShape.options.strokeStyle }}</span>
              <input
                id="rectCircStroke"
                type="color"
                :value="selectedElement2.canvasShape.options.strokeStyle"
                @input="
                  (e) => {
                    selectedElement2.canvasShape.options.strokeStyle = e.target.value
                  }
                "
                style="background: transparent"
                ref="rectCircStroke"
                @click.stop
              />
            </div>
          </div>
        </div>

        <!-- border radius -->
        <div>
          <label for="borderRadius">Border Radius</label>
          <InputNumber
            id="borderRadius"
            v-model="selectedElement2.canvasShape.options.borderRadius"
            inputId="integeronly"
            fluid
            size="small"
          />
        </div>
      </div>

      <!-- Page styles -->
      <div
        v-else
        class="sidebar-right__page"
      >
        <h5>Page</h5>

        <div class="sidebar-right__page-background">
          <label
            for="bgColor"
            style="font-size: 14px"
            >Background Color</label
          >
          <div @click="$refs.bgColorInput.click()">
            <span>{{ canvaBgColor }}</span>
            <input
              id="bgColor"
              type="color"
              :value="canvaBgColor"
              @input="
                (e) => {
                  canvaBgColor = e.target.value
                }
              "
              style="background: transparent"
              ref="bgColorInput"
              @click.stop
            />
          </div>
        </div>
      </div>

      <!-- Zoom controls -->
      <div style="margin-top: auto">
        <p style="font-size: 14px">Zoom level: {{ parseInt(zoomLevel * 100) }}</p>
      </div>
    </aside>

    <canvas
      id="canvas"
      ref="canvas"
      :style="{ backgroundColor: canvaBgColor }"
    ></canvas>
    <textarea
      v-if="action === 'writing'"
      ref="textarea"
      :value="selectedElement?.text || ''"
      @input="
        (e) => {
          if (selectedElement) selectedElement.text = e.target.value
        }
      "
      @blur="handleBlur"
      :style="{
        position: 'absolute',
        top: `${selectedElement?.y1 - 2 + panOffset.y}px`,
        left: `${selectedElement?.x1 + panOffset.x}px`,
        zIndex: 100,
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        whiteSpace: 'pre',
        overflow: 'hidden',
        color: 'white',
        background: 'transparent',
      }"
    ></textarea>
  </div>
</template>

<style lang="scss" scoped>
  #app {
    width: 100%;
    height: 100vh;
    position: relative;
    overflow: hidden;
  }

  #sidebar-left {
    color: white;
    width: 240px;
    padding: 12px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    position: absolute;
    top: 0px;
    left: 0px;
    bottom: 0px;
    z-index: 250px;
    background-color: oklch(27.4% 0.006 286.033);

    display: flex;
    flex-direction: column;
    gap: 8px;

    button {
      color: white;
      font-size: 12px;
      text-align: start;

      width: 100%;
      padding: 4px 10.5px;

      border-radius: 4px;

      &:hover {
        background-color: oklch(37% 0.013 285.805);
      }
    }

    .export-controls {
      margin-top: auto;

      display: flex;
      align-items: center;
      justify-content: space-between;
    }
  }

  .sidebar-right {
    color: white;
    width: 240px;
    padding: 16px;
    background-color: oklch(27.4% 0.006 286.033);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);

    display: flex;
    flex-direction: column;
    gap: 8px;

    position: absolute;
    top: 0px;
    right: 0px;
    bottom: 0px;
    z-index: 250;

    &-content {
      width: 100%;

      display: flex;
      flex-direction: column;
      gap: 10px;

      &_position,
      &_layout,
      &_alignment {
        display: flex;
        flex-direction: column;
        gap: 5px;

        &_items {
          display: flex;
          justify-content: space-between;

          input {
            background: transparent;
          }

          button {
            color: white;

            padding: 4px 10.5px;
            border-radius: 4px;

            cursor: pointer;

            &:hover {
              background-color: oklch(37% 0.013 285.805);
            }
          }
        }
      }
    }

    &__rectangle {
      &-styles {
        &-background,
        &-stroke {
          display: flex;
          align-items: center;
          justify-content: space-between;

          & > div {
            padding: 4px 10.5px;
            border-radius: 6px;

            display: flex;
            align-items: center;
            gap: 4px;

            cursor: pointer;

            &:hover {
              background-color: oklch(37% 0.013 285.805);
            }

            input {
              width: 16px;
              height: 16px;
              border: none;
              outline: none;
            }

            span {
              font-size: 12px;
              font-weight: 400;
            }
          }
        }
      }
    }

    &__page {
      display: flex;
      flex-direction: column;
      gap: 10px;

      h5 {
        margin-bottom: 0;
      }

      &-background {
        width: 100%;

        display: flex;
        align-items: center;
        justify-content: space-between;

        & > div {
          padding: 4px 10.5px;
          border-radius: 6px;

          display: flex;
          align-items: center;
          gap: 4px;

          cursor: pointer;

          &:hover {
            background-color: oklch(37% 0.013 285.805);
          }

          input {
            width: 16px;
            height: 16px;
            border: none;
            outline: none;
          }

          span {
            font-size: 12px;
            font-weight: 400;
          }
        }
      }
    }
  }

  #canvas {
    width: 100%;
    height: 100%;
  }

  #toolbar {
    padding: 6px;
    background-color: oklch(27.4% 0.006 286.033);
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 15px;
    align-items: center;
    z-index: 100;
  }

  .tool-section {
    display: flex;
    align-items: center;
    gap: 5px;
    padding-right: 5px;
    border-right: 1px solid #ddd;
  }

  .tool-section:last-child {
    border-right: none;
  }

  #toolbar button {
    color: white;
    width: 32px;
    height: 32px;
    display: flex;
    justify-content: center;
    align-items: center;
    background: transparent;
    border: none;
    outline: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }

  #toolbar button:hover {
    background-color: oklch(37% 0.013 285.805);
  }

  #toolbar button.active {
    background-color: #3498db;
    color: white;
    border-color: #2980b9;
  }

  #toolbar button.danger {
    background-color: #fff;
    color: #e74c3c;
    border-color: #e74c3c;
  }

  #toolbar button.danger:hover {
    background-color: #e74c3c;
    color: white;
  }
</style>
