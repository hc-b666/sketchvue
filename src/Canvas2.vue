<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useHistory } from './hooks/useHistory';
import { Drawer, Generator } from './Drawer';
import { adjustElementCoordinates, adjustmentRequired } from './utils/coordinates';

const canvas = ref(null);
const textarea = ref(null);
/**
 * @type {CanvasRenderingContext2D}
 */
let ctx = null;
const tools = ['selection', 'rectangle', 'line', 'ellipse', 'text'];
/**
 * @type {Generator}
 */
const generator = new Generator();

const { state: elements, setState: setElements, undo, redo } = useHistory([]);
const action = ref('none');
const tool = ref('rectangle');
const selectedElement = ref(null);
const panOffset = ref({ x: 0, y: 0 });
const startPanMousePos = ref({ x: 0, y: 0 });

onMounted(() => {
  ctx = canvas.value.getContext('2d');
  renderCanvas();
  autoFocusTextarea();

  canvas.value.addEventListener('mousedown', handleMousedown);
  canvas.value.addEventListener('mousemove', handleMousemove);
  canvas.value.addEventListener('mouseup', handleMouseup);

  document.addEventListener('keydown', undoredo);
});

onUnmounted(() => {
  document.removeEventListener('keydown', undoredo);

  if (canvas.value) {
    canvas.value.removeEventListener('mousedown', handleMousedown);
    canvas.value.removeEventListener('mousemove', handleMousemove);
    canvas.value.removeEventListener('mouseup', handleMouseup);
  }
});

watch([elements, action, selectedElement, panOffset], renderCanvas, { deep: true });
watch([action, selectedElement], autoFocusTextarea, { deep: true });

const undoredo = (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') undo();
  else if ((e.metaKey || e.ctrlKey) && e.key === 'y') redo();
};

function renderCanvas() {
  if (!canvas.value) return;
  canvas.value.width = window.innerWidth;
  canvas.value.height = window.innerHeight;
  const ctx = canvas.value.getContext('2d');
  const drawer = new Drawer(ctx);

  drawer.clear();
  ctx.save();
  ctx.translate(panOffset.value.x, panOffset.value.y);

  const currentElements = elements.value;
  if (currentElements && Array.isArray(currentElements)) {
    currentElements.forEach((element) => {
      if (action.value === 'writing' && selectedElement.value.id === element.id) return;
      drawElement(drawer, element);
    });
  }

  ctx.restore();
}

function autoFocusTextarea() {
  if (textarea.value && action.value === 'writing') {
    console.log('autofocus worked');
    setTimeout(() => {
      textarea.value.focus();
      textarea.value = selectedElement.value.text;
    }, 0);
  }
}

/**
 * 
 * @param {Drawer} drawer
 * @param element 
 */
function drawElement(drawer, element) {
  if (!element) return;

  switch (element.type) {
    case 'line':
    case 'rectangle':
    case 'ellipse':
      drawer.draw(element.canvasShape);
      break;
    case 'text':
      ctx.textBaseline = 'top';
      ctx.font = '16px Arial';
      ctx.fillText(element.text, element.x1, element.y1);
      break;
    default:
      console.error('Unknown element type:', element.type);
  }
}

function createElement(id, x1, y1, x2, y2, type) {
  switch (type) {
    case 'line':
      const lineShape = generator.line(x1, y1, x2, y2);
      return {
        id,
        type,
        x1,
        y1,
        x2,
        y2,
        canvasShape: lineShape,
      };
    case 'rectangle':
      const rectShape = generator.rectangle(
        Math.min(x1, x2),
        Math.min(y1, y2),
        Math.abs(x2 - x1),
        Math.abs(y2 - y1)
      );
      return {
        id,
        type,
        x1,
        y1,
        x2,
        y2,
        canvasShape: rectShape,
      };
    case 'ellipse':
      const ellipesShape = generator.ellipse(x1, y1, x2, y2);
      return {
        id,
        type,
        x1,
        y1,
        x2,
        y2,
        canvasShape: ellipesShape,
      };
    case 'text':
      return {
        id,
        type,
        x1,
        y1,
        x2,
        y2,
        text: "",
      };
    default:
      console.error('Unknown element type:', type);
      return null;
  }
}

function updateElement(id, x1, y1, x2, y2, type, options = {}) {
  const currentElements = elements.value;
  if (!currentElements || !Array.isArray(currentElements)) return;

  const elementsCopy = [...currentElements];

  switch (type) {
    case 'line':
    case 'rectangle':
    case 'ellipse':
      elementsCopy[id] = createElement(id, x1, y1, x2, y2, type);
      break;
    case 'text':
      const text = options.text || "";
      const textWidth = ctx ? ctx.measureText(text).width : 100;
      const textHeight = 16;

      elementsCopy[id] = {
        ...createElement(id, x1, y1, x1 + textWidth, y1 + textHeight, type),
        text,
      };
      break;
    default:
      console.error('Unknown element type:', type);
  }

  setElements(elementsCopy, true);
}
function getMouseCoordinates(e) {
  const clientX = e.clientX - panOffset.value.x;
  const clientY = e.clientY - panOffset.value.y;
  return { clientX, clientY };
}

const nearPoint = (x, y, x1, y1, name) => {
  return Math.abs(x - x1) < 5 && Math.abs(y - y1) < 5 ? name : null;
};

const distance = (a, b) => Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));

function onLine(x1, y1, x2, y2, x, y, maxDistance = 1) {
  const a = { x: x1, y: y1 };
  const b = { x: x2, y: y2 };
  const c = { x, y };
  const offset = distance(a, b) - (distance(a, c) + distance(b, c));
  return Math.abs(offset) < maxDistance ? 'inside' : null;
}

function positionWithinElement(x, y, element) {
  const { type, x1, y1, x2, y2 } = element;

  switch (type) {
    case 'line':
      const on = onLine(x1, y1, x2, y2, x, y);
      const start = nearPoint(x, y, x1, y1, 'start');
      const end = nearPoint(x, y, x2, y2, 'end');
      return start || end || on;
    case 'rectangle':
      const topleft = nearPoint(x, y, x1, y1, 'tl');
      const topright = nearPoint(x, y, x2, y1, 'tr');
      const bottomleft = nearPoint(x, y, x1, y2, 'bl');
      const bottomright = nearPoint(x, y, x2, y2, 'br');
      const inside = (x >= x1 && x <= x2 && y >= y1 && y <= y2) ? 'inside' : null;
      return topleft || topright || bottomleft || bottomright || inside;
    case 'ellipse':
      const centerX = (x1 + x2) / 2;
      const centerY = (y1 + y2) / 2;
      const radiusX = Math.abs(x2 - x1) / 2;
      const radiusY = Math.abs(y2 - y1) / 2;
      const ellipseInside = ((x - centerX) ** 2) / (radiusX ** 2) + ((y - centerY) ** 2) / (radiusY ** 2) <= 1;
      return ellipseInside ? 'inside' : null;
    default:
      console.error('error in positionWithinElement');
      return null;
  }
}

function getElementAtPosition(x, y, elements) {
  if (!elements || !Array.isArray(elements)) return null;

  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i];
    const position = positionWithinElement(x, y, element);
    if (position) {
      return { ...element, position };
    }
  }
  return null;
}

const cursorForPosition = position => {
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

function resizedCoordinates(clientX, clientY, position, coordinates) {
  const { x1, y1, x2, y2 } = coordinates;
  switch (position) {
    case 'tl':
    case 'start':
      return { x1: clientX, y1: clientY, x2, y2 };
    case 'tr':
      return { x1, y1: clientY, x2: clientX, y2 };
    case 'bl':
      return { x1: clientX, y1, x2, y2: clientY };
    case 'br':
    case 'end':
      return { x1, y1, x2: clientX, y2: clientY };
    default:
      return { x1, y1, x2, y2 };
  }
}

function handleMousedown(e) {
  if (action.value === 'writing') return;

  const { clientX, clientY } = getMouseCoordinates(e);

  if (tool.value === 'selection') {
    const element = getElementAtPosition(clientX, clientY, elements.value);
    if (element) {
      const offsetX = clientX - element.x1;
      const offsetY = clientY - element.y1;

      selectedElement.value = { ...element, offsetX, offsetY };

      if (element.position === 'inside') action.value = 'moving';
      else action.value = 'resizing';

      if (canvas.value) {
        canvas.value.style.cursor = cursorForPosition(element.position);
      }
    } else {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        action.value = 'panning';
        startPanMousePos.value = { x: e.clientX, y: e.clientY };
      }
    }
  } else {
    const currentElements = elements.value || [];
    const id = currentElements.length;
    const element = createElement(id, clientX, clientY, clientX, clientY, tool.value);

    setElements([...currentElements, element]);
    selectedElement.value = element;

    console.log(tool.value, selectedElement.value, elements.value)

    action.value = tool.value === 'text' ? 'writing' : 'drawing';
  }
}

function handleMousemove(e) {
  const { clientX, clientY } = getMouseCoordinates(e);

  console.log(action.value)

  if (action.value === 'panning') {
    const deltaX = e.clientX - startPanMousePos.value.x;
    const deltaY = e.clientY - startPanMousePos.value.y;
    panOffset.value = {
      x: panOffset.value.x + deltaX,
      y: panOffset.value.y + deltaY
    };
    startPanMousePos.value = {
      x: e.clientX,
      y: e.clientY,
    };
    return;
  }

  if (action.value === 'drawing') {
    const currentElements = elements.value;
    if (!currentElements || !Array.isArray(currentElements) || currentElements.length === 0) return;

    const index = currentElements.length - 1;
    const { x1, y1 } = currentElements[index];
    updateElement(index, x1, y1, clientX, clientY, tool.value);
  } else if (action.value === 'moving') {
    if (!selectedElement.value) return;

    const { id, x1, x2, y1, y2, type, offsetX, offsetY } = selectedElement.value;
    const width = x2 - x1;
    const height = y2 - y1;
    const newX1 = clientX - offsetX;
    const newY1 = clientY - offsetY;
    const options = type === 'text' ? { text: selectedElement.value.text } : {};
    updateElement(id, newX1, newY1, newX1 + width, newY1 + height, type, options);
  } else if (action.value === 'resizing') {
    if (!selectedElement.value || !selectedElement.value.position) return;

    const { id, type, position, x1, y1, x2, y2 } = selectedElement.value;
    const coords = resizedCoordinates(clientX, clientY, position, { x1, y1, x2, y2 });
    updateElement(id, coords.x1, coords.y1, coords.x2, coords.y2, type);
  } else if (action.value === 'none') {
    const element = getElementAtPosition(clientX, clientY, elements.value);
    if (canvas.value) {
      canvas.value.style.cursor = element ? cursorForPosition(element.position) : 'default';
    }
  }
}

function handleMouseup(e) {
  const { clientX, clientY } = getMouseCoordinates(e);

  if (selectedElement.value) {
    if (
      selectedElement.value.type === 'text' &&
      clientX - selectedElement.value.offsetX === selectedElement.x1 &&
      clientY - selectedElement.value.offsetY === selectedElement.y1
    ) {
      action.value = 'writing';
      return;
    }

    const index = selectedElement.value.id;
    const currentElements = elements.value;
    if (!currentElements || !Array.isArray(currentElements) || !currentElements[index]) {
      action.value = 'none';
      selectedElement.value = null;
      return;
    }

    const { id, type } = currentElements[index];
    if ((action.value === 'drawing' || action.value === 'resizing') && adjustmentRequired(type)) {
      const { x1, y1, x2, y2 } = adjustElementCoordinates(currentElements[index]);
      updateElement(id, x1, y1, x2, y2, type);
    }
  }

  if (action.value === 'writing') return;

  if (canvas.value) {
    canvas.value.style.cursor = 'default';
  }

  tool.value = 'selection';
  action.value = 'none';
  selectedElement.value = null;
}

function handleBlur(e) {
  if (!selectedElement.value) return;

  const { id, x1, y1, type } = selectedElement.value;
  const text = e.target.value;

  const textWidth = ctx.measureText(text).width;
  const textHeight = 16;

  updateElement(id, x1, y1, x1 + textWidth, y1 + textHeight, type, { text });
  action.value = 'none';
  selectedElement.value = null;
}

</script>

<template>
  <div id="app">
    <div id="toolbar">
      <div class="tool-section">
        <span class="section-title">Mode:</span>
        <button v-for="t in tools" :key="t" @click="tool = t" :class="{ active: tool === t }">
          {{ t }}
        </button>
      </div>

      <div class="tool-section">
        <button @click="undo" title="Undo (Ctrl+Z)">Undo</button>
        <button @click="redo" title="Redo (Ctrl+Y)">Redo</button>
      </div>
    </div>

    <canvas id="canvas" ref="canvas"></canvas>
    <textarea v-if="action === 'writing'" ref="textarea" v-model="selectedElement.text" @blur="handleBlur" :style="{
      position: 'absolute',
      top: selectedElement.y1 - 2 + panOffset.y,
      left: selectedElement.x1 + panOffset.x,
      background: 'transparent',
      zIndex: 100,
      fontFamily: 'Arial, sans-serif',
      width: '200px',
      height: '60px',
      fontSize: '16px',
      whiteSpace: 'pre',
      overflow: 'hidden',
      resize: 'auto',
      color: 'black',
    }"></textarea>
  </div>
</template>

<style scoped>
#app {
  width: 100%;
  height: 100vh;
  position: relative;
  font-family: Arial, sans-serif;
}

#canvas {
  width: 100%;
  height: 100%;
}

#toolbar {
  padding: 10px;
  background-color: #f8f9fa;
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
  padding: 0 5px;
  border-right: 1px solid #ddd;
}

.tool-section:last-child {
  border-right: none;
}

.section-title {
  font-size: 12px;
  color: #666;
}

#toolbar button {
  padding: 5px 10px;
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

#toolbar button:hover {
  background-color: #f0f0f0;
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