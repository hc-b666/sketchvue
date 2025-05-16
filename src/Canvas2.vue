<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useHistory } from './hooks/useHistory';
import { Drawer, Generator } from './Drawer';
import {
  adjustElementCoordinates,
  adjustmentRequired,
  cursorForPosition,
  getElementAtPosition,
  getShiftedCoordinates,
  isElementInsideFrame,
  positionWithinElement,
  resizedCoordinates,
} from './utils/coordinates';

String.prototype.toCapitalize = function () {
  return this.charAt(0).toUpperCase() + this.slice(1).toLowerCase();
}

const canvas = ref(null);
const textarea = ref(null);
/**
 * @type {CanvasRenderingContext2D}
 */
let ctx = null;
const tools = ['selection', 'rectangle', 'line', 'ellipse', 'text', 'frame'];
/**
 * @type {Generator}
 */
const generator = new Generator();

const numberOfShapes = {
  line: 0,
  rectangle: 0,
  ellipse: 0,
  text: 0,
  frame: 0,
};

const { state: elements, setState: setElements, undo, redo } = useHistory([]);
const action = ref('none');
const tool = ref('rectangle');
const selectedElement = ref(null);
const selectedElement2 = ref(null);
const panOffset = ref({ x: 0, y: 0 });
const startPanMousePos = ref({ x: 0, y: 0 });
const shiftPressed = ref(false);

onMounted(() => {
  ctx = canvas.value.getContext('2d');
  renderCanvas();
  autoFocusTextarea();

  canvas.value.addEventListener('mousedown', handleMousedown);
  canvas.value.addEventListener('mousemove', handleMousemove);
  canvas.value.addEventListener('mouseup', handleMouseup);

  canvas.value.addEventListener('dblclick', handleDblClick);

  document.addEventListener('keydown', undoredo);
  document.addEventListener('keyup', handleShiftKeyup);
});

onUnmounted(() => {
  document.removeEventListener('keydown', undoredo);
  document.removeEventListener('keyup', handleShiftKeyup);

  if (canvas.value) {
    canvas.value.removeEventListener('mousedown', handleMousedown);
    canvas.value.removeEventListener('mousemove', handleMousemove);
    canvas.value.removeEventListener('mouseup', handleMouseup);

    canvas.value.removeEventListener('dblclick', handleDblClick);
  }
});

watch([elements, action, selectedElement, panOffset, shiftPressed], renderCanvas, { deep: true });
watch([action, selectedElement], autoFocusTextarea, { deep: true });
watch(
  () => selectedElement2.value?.canvasShape?.options?.fillStyle,
  (newFillStyle) => {
    if (
      selectedElement2.value &&
      typeof selectedElement2.value.id === 'number' &&
      selectedElement2.value.canvasShape &&
      newFillStyle !== undefined
    ) {
      const idx = selectedElement2.value.id;
      const currentElements = elements.value;
      if (currentElements && currentElements[idx]) {
        const { x1, y1, x2, y2, type, shapeNumber } = currentElements[idx];
        updateElement(idx, x1, y1, x2, y2, type, shapeNumber, { fillStyle: newFillStyle });
      }
    }
  }, {
  deep: true,
}
);
const undoredo = (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') undo();
  else if ((e.metaKey || e.ctrlKey) && e.key === 'y') redo();
  else if (e.key === 'Shift') shiftPressed.value = true;
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
    currentElements.filter((el) => el.type === 'frame').forEach((el) => {
      drawElement(drawer, el);
    });
    currentElements.filter((el) => el.type !== 'frame').forEach((element) => {
      if (action.value === 'writing' && selectedElement.value.id === element.id) return;
      drawElement(drawer, element);
    });
  }

  ctx.restore();
}

function autoFocusTextarea() {
  if (textarea.value && action.value === 'writing') {
    setTimeout(() => {
      textarea.value.focus();
      textarea.value = selectedElement.value.text;
    }, 0);
  }
}

function handleShiftKeyup(e) {
  if (e.key === 'Shift') {
    shiftPressed.value = false;
  }
}

const layers = computed(() => {
  const frames = elements.value.filter((el) => el.type === 'frame');
  const otherElements = elements.value.filter((el) => el.type !== 'frame');

  const insideFrameIds = new Set();
  frames.forEach(frame => {
    frame.children = otherElements.filter(child => isElementInsideFrame(child, frame));
    frame.children.forEach(child => insideFrameIds.add(child.id));
  });

  const lays = elements.value.filter(el =>
    el.type === 'frame' || !insideFrameIds.has(el.id)
  );

  return lays;
});

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
    case 'frame':
      drawer.draw(element.canvasShape, { title: element.title });
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

function createElement(id, x1, y1, x2, y2, type, shapeNumber) {
  switch (type) {
    case 'frame':
      const frameShape = generator.frame(
        Math.min(x1, x2),
        Math.min(y1, y2),
        Math.abs(x2 - x1),
        Math.abs(y2 - y1),
      );
      return {
        id,
        type,
        x1,
        y1,
        x2,
        y2,
        title: `Frame ${shapeNumber}`,
        shapeNumber,
        canvasShape: frameShape,
        children: [],
      };
    case 'line':
      const lineShape = generator.line(x1, y1, x2, y2);
      return {
        id,
        type,
        x1,
        y1,
        x2,
        y2,
        title: `Line ${shapeNumber}`,
        shapeNumber,
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
        title: `Rectangle ${shapeNumber}`,
        shapeNumber,
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
        title: `Ellipse ${shapeNumber}`,
        shapeNumber,
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
        title: `Text ${shapeNumber}`,
        shapeNumber,
        text: "",
      };
    default:
      console.error('Unknown element type:', type);
      return null;
  }
}

function updateElement(id, x1, y1, x2, y2, type, shapeNumber, options = {}) {
  const currentElements = elements.value;
  if (!currentElements || !Array.isArray(currentElements)) return;

  const elementsCopy = [...currentElements];

  const existingElement = elementsCopy[id];
  const existingFillStyle = existingElement?.canvasShape?.options?.fillStyle;

  switch (type) {
    case 'line':
    case 'rectangle':
    case 'ellipse':
    case 'frame':
      const newElement = createElement(id, x1, y1, x2, y2, type, shapeNumber);
      if (existingFillStyle && !options.fillStyle) {
        newElement.canvasShape.options.fillStyle = existingFillStyle;
      } else if (options.fillStyle) {
        newElement.canvasShape.options.fillStyle = options.fillStyle;
      }
      elementsCopy[id] = newElement;
      break;
    case 'text':
      const text = options.text || "";
      const textWidth = ctx ? ctx.measureText(text).width : 100;
      const textHeight = 16;

      elementsCopy[id] = {
        ...createElement(id, x1, y1, x1 + textWidth, y1 + textHeight, type, shapeNumber),
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

function handleDblClick(e) {
  if (tool.value !== 'selection') return;
  const { clientX, clientY } = getMouseCoordinates(e);
  const element = getElementAtPosition(ctx, clientX, clientY, elements.value);
  if (element && element.type === 'text' && element.position === 'inside') {
    selectedElement.value = { ...element, offsetX: clientX - element.x1, offsetY: clientY - element.y1 };
    action.value = 'writing';
    setTimeout(() => {
      if (textarea.value) {
        textarea.value.focus();
        textarea.value.value = element.text;
      }
    }, 0);
  }
}

function handleMousedown(e) {
  if (action.value === 'writing') return;

  const { clientX, clientY } = getMouseCoordinates(e);

  if (selectedElement.value && selectedElement.value.type === 'frame') {
    const position = positionWithinElement(ctx, clientX, clientY, selectedElement.value);

    if (position && position !== 'inside') {
      action.value = 'resizing';
      selectedElement.value = { ...selectedElement.value, position, offsetX: clientX - selectedElement.value.x1, offsetY: clientY - selectedElement.value.y1 };
      selectedElement2.value = { ...selectedElement.value };
    } else if (position === 'inside') {
      action.value = 'moving';
      selectedElement.value = { ...selectedElement.value, position, offsetX: clientX - selectedElement.value.x1, offsetY: clientY - selectedElement.value.y1 };
      selectedElement2.value = { ...selectedElement.value };
    }

    if (canvas.value) {
      canvas.value.style.cursor = cursorForPosition(selectedElement.value.position);
    }

    return;
  }

  if (tool.value === 'selection') {
    const element = getElementAtPosition(ctx, clientX, clientY, elements.value);
    if (element) {
      const offsetX = clientX - element.x1;
      const offsetY = clientY - element.y1;

      selectedElement.value = { ...element, offsetX, offsetY };
      selectedElement2.value = { ...element, offsetX, offsetY };

      if (element.position === 'inside') action.value = 'moving';
      else action.value = 'resizing';

      if (canvas.value) {
        canvas.value.style.cursor = cursorForPosition(element.position);
      }
    } else {
      selectedElement2.value = null;
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        action.value = 'panning';
        startPanMousePos.value = { x: e.clientX, y: e.clientY };
      }
    }
  } else {
    const currentElements = elements.value || [];
    const id = currentElements.length;
    const shapeNumber = ++numberOfShapes[tool.value];
    const element = createElement(id, clientX, clientY, clientX, clientY, tool.value, shapeNumber);

    setElements([...currentElements, element]);
    selectedElement.value = element;

    action.value = tool.value === 'text' ? 'writing' : 'drawing';

    if (tool.value === 'text') {
      setTimeout(() => {
        if (textarea.value) {
          textarea.value.focus();
          textarea.value.value = '';
        }
      }, 0);
    }
  }
}

function handleMousemove(e) {
  const { clientX, clientY } = getMouseCoordinates(e);

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
    const { x1, y1, shapeNumber, type } = currentElements[index];

    if (shiftPressed.value && (type === 'rectangle' || type === 'line' || type === 'ellipse' || type === 'frame')) {
      const { newX2, newY2 } = getShiftedCoordinates(x1, y1, clientX, clientY, type);
      updateElement(index, x1, y1, newX2, newY2, type, shapeNumber);
    } else {
      updateElement(index, x1, y1, clientX, clientY, tool.value, shapeNumber);
    }
  } else if (action.value === 'moving') {
    if (!selectedElement.value) return;

    const { id, x1, x2, y1, y2, type, offsetX, offsetY, shapeNumber } = selectedElement.value;
    const width = x2 - x1;
    const height = y2 - y1;
    const newX1 = clientX - offsetX;
    const newY1 = clientY - offsetY;
    const options = type === 'text' ? { text: selectedElement.value.text } : {};
    updateElement(id, newX1, newY1, newX1 + width, newY1 + height, type, shapeNumber, options);

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
    };
  } else if (action.value === 'resizing') {
    if (!selectedElement.value || !selectedElement.value.position) return;

    const { id, type, position, x1, y1, x2, y2, shapeNumber } = selectedElement.value;
    const coords = resizedCoordinates(clientX, clientY, position, { x1, y1, x2, y2 });
    updateElement(id, coords.x1, coords.y1, coords.x2, coords.y2, type, shapeNumber);

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
      }
    };
  } else if (action.value === 'none') {
    let element;
    if (selectedElement.value && selectedElement.value.type === 'frame') {
      element = getElementAtPosition(ctx, clientX, clientY, elements.value, true);
    } else {
      element = getElementAtPosition(ctx, clientX, clientY, elements.value, false);
    }
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
      clientX - selectedElement.value.offsetX === selectedElement.value.x1 &&
      clientY - selectedElement.value.offsetY === selectedElement.value.y1
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
      const { x1, y1, x2, y2, shapeNumber } = adjustElementCoordinates(currentElements[index]);
      updateElement(id, x1, y1, x2, y2, type, shapeNumber);
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

  const { id, x1, y1, type, shapeNumber } = selectedElement.value;
  const text = e.target.value;

  if (text && text.trim() !== '') {
    const textWidth = ctx.measureText(text).width || 100;
    const textHeight = 16;

    updateElement(id, x1, y1, x1 + textWidth, y1 + textHeight, type, shapeNumber, { text });
  }

  action.value = 'none';
  selectedElement.value = null;
}

function setSelectedElement(el) {
  selectedElement.value = { ...el };
  selectedElement2.value = { ...el };
  action.value = 'none';
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

    <aside id="sidebar-left">
      <h5>Elements</h5>
      <div v-for="el in layers" :key="el.id">
        <button @click="setSelectedElement(el)">{{ el.title }}</button>
        <div v-if="el.type === 'frame' && el.children.length > 0">
          <ul style="padding-left: 8px;">
            <li v-for="child in el.children" :key="child.id">
              <button @click="setSelectedElement(child)">{{ child.title }}</button>
            </li>
          </ul>
        </div>
      </div>
    </aside>

    <aside class="sidebar-right">
      <!-- line -->
      <div v-if="selectedElement2 && selectedElement2.type === 'line'" class="sidebar-right-content">
        <span>{{ selectedElement2.type.toCapitalize() }}</span>
        <div class="sidebar-right-content_position">
          <h5>Position</h5>
          <div class="sidebar-right-content_position_items">
            <p>X: {{ selectedElement2.x1 }}</p>
            <p>Y: {{ selectedElement2.y1 }}</p>
          </div>
        </div>
        <div class="sidebar-right-content_layout">
          <h5>Layout</h5>
          <div class="sidebar-right-content_layout_items">
            <p>Width: {{ Math.abs(selectedElement2.x2 - selectedElement2.x1) }}</p>
            <p>Height: 0</p>
          </div>
        </div>
      </div>

      <!-- text -->
      <div v-if="selectedElement2 && selectedElement2.type === 'text'" class="sidebar-right-content">
        <span>{{ selectedElement2.type.toCapitalize() }}</span>
        <div class="sidebar-right-content_position">
          <h5>Position</h5>
          <div class="sidebar-right-content_position_items">
            <p>X: {{ selectedElement2.x1 }}</p>
            <p>Y: {{ selectedElement2.y1 }}</p>
          </div>
        </div>
        <div class="sidebar-right-content_layout">
          <h5>Layout</h5>
          <div class="sidebar-right-content_layout_items">
            <p>Width: {{ parseInt(selectedElement2.x2 - selectedElement2.x1) }}</p>
            <p>Height: {{ selectedElement2.y2 - selectedElement2.y1 }}</p>
          </div>
        </div>
      </div>

      <!-- rectangle, ellipse -->
      <div v-if="selectedElement2 && selectedElement2.type !== 'line' && selectedElement2.type !== 'text'"
        class="sidebar-right-content">
        <span>{{ selectedElement2.type.toCapitalize() }}</span>
        <div class="sidebar-right-content_position">
          <h5>Position</h5>
          <div class="sidebar-right-content_position_items">
            <p>X: {{ selectedElement2.canvasShape.x }}</p>
            <p>Y: {{ selectedElement2.canvasShape.y }}</p>
          </div>
        </div>
        <div class="sidebar-right-content_layout">
          <h5>Layout</h5>
          <div class="sidebar-right-content_layout_items">
            <p>Width: {{ selectedElement2.canvasShape.width }}</p>
            <p>Height: {{ selectedElement2.canvasShape.height }}</p>
          </div>
          <div class="sidebar-right-content_layout_items">
            <label for="fillStyle">Fill Style</label>
            <input id="fillStyle" type="color" :value="selectedElement2.canvasShape.options.fillStyle"
              @input="e => { selectedElement2.canvasShape.options.fillStyle = e.target.value }" />
          </div>
        </div>
      </div>

    </aside>

    <canvas id="canvas" ref="canvas"></canvas>
    <textarea v-if="action === 'writing'" ref="textarea" :value="selectedElement?.text || ''"
      @input="e => { if (selectedElement) selectedElement.text = e.target.value }" @blur="handleBlur" :style="{
        position: 'absolute',
        top: `${selectedElement?.y1 - 2 + panOffset.y}px`,
        left: `${selectedElement?.x1 + panOffset.x}px`,
        zIndex: 100,
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        whiteSpace: 'pre',
        overflow: 'hidden',
        color: 'black',
      }"></textarea>
  </div>
</template>

<style lang="scss" scoped>
#app {
  width: 100%;
  height: 100vh;
  position: relative;
  font-family: Arial, sans-serif;
}

#sidebar-left {
  width: 240px;
  padding: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  position: absolute;
  top: 0px;
  left: 0px;
  bottom: 0px;
  z-index: 250px;
}

.sidebar-right {
  width: 240px;
  padding: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
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
    &_layout {
      display: flex;
      flex-direction: column;
      gap: 5px;

      &_items {
        display: flex;
        justify-content: space-between;
      }
    }
  }
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