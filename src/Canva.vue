<script setup>
import { onMounted, reactive, ref } from 'vue';

const canvas = ref(null);
let ctx = null;

const selectedFrame = ref(null);
const selectedShape = ref(null);
const startPos = ref({ x: 0, y: 0 });

const actions = ["none", "cursor", "frame", "rectangle", "text"];
const activeAction = ref("cursor");
const isDrawing = ref(false);
const isWriting = ref(false);
const shapeColor = ref("#3498db");

const frames = reactive([
  {
    id: 'frame-1',
    title: 'Frame 1',
    type: 'div',
    className: 'frame-1',
    style: {
      width: 400,
      height: 200,
      backgroundColor: 'rgba(255, 0, 0, 0.2)',
      border: '2px solid #e74c3c',
      position: 'relative',
    },
    x: 50,
    y: 50,
    shapes: [],
    selected: false,
  },
]);

const isPointInFrame = (x, y, frame) => {
  return x >= frame.x &&
    x <= frame.x + frame.style.width &&
    y >= frame.y &&
    y <= frame.y + frame.style.height;
};

const isPointInShape = (x, y, shape, frame) => {
  const absX = shape.x + frame.x;
  const absY = shape.y + frame.y;

  if (shape.type === 'rectangle') {
    return x >= absX &&
      x <= absX + shape.width &&
      y >= absY &&
      y <= absY + shape.height;
  } else if (shape.type === 'circle') {
    const distance = Math.sqrt(
      Math.pow(x - (absX + shape.radius), 2) +
      Math.pow(y - (absY + shape.radius), 2)
    );
    return distance <= shape.radius;
  } else if (shape.type === 'text') {
    return x >= absX &&
      x <= absX + 100 &&
      y >= absY &&
      y <= absY + 24;
  }
  return false;
};

function setupCanvas() {
  canvas.value.width = window.innerWidth;
  canvas.value.height = window.innerHeight;
  ctx = canvas.value.getContext('2d');
}

function redraw() {
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);

  frames.forEach((frame) => {
    ctx.fillStyle = frame.style.backgroundColor;
    ctx.fillRect(frame.x, frame.y, frame.style.width, frame.style.height);

    if (frame.selected) {
      ctx.strokeStyle = '#2980b9';
      ctx.lineWidth = 3;
    } else {
      ctx.strokeStyle = frame.style.border.split(' ')[2] || '#000';
      ctx.lineWidth = parseInt(frame.style.border.split(' ')[0]) || 1;
    }
    ctx.strokeRect(frame.x, frame.y, frame.style.width, frame.style.height);

    ctx.fillStyle = '#000';
    ctx.font = '12px Arial';
    ctx.fillText(frame.title, frame.x + 5, frame.y - 5);

    frame.shapes.forEach((shape) => {
      ctx.fillStyle = shape.color;
      ctx.strokeStyle = shape.selected ? '#2ecc71' : '#000';
      ctx.lineWidth = shape.selected ? 3 : 1;

      if (shape.type === 'rectangle') {
        ctx.fillRect(frame.x + shape.x, frame.y + shape.y, shape.width, shape.height);
        ctx.strokeRect(frame.x + shape.x, frame.y + shape.y, shape.width, shape.height);
      } else if (shape.type === 'circle') {
        ctx.beginPath();
        ctx.arc(
          frame.x + shape.x + shape.radius,
          frame.y + shape.y + shape.radius,
          shape.radius,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.stroke();
      } else if (shape.type === 'text') {
        if (isWriting.value && shape.selected) return;

        ctx.font = '16px Arial';
        ctx.fillText(shape.textContent || '', frame.x + shape.x, frame.y + shape.y + 16);

        if (shape.selected) {
          const textWidth = ctx.measureText(shape.textContent || '').width;
          ctx.strokeRect(
            frame.x + shape.x - 2,
            frame.y + shape.y - 2,
            textWidth + 4,
            24
          );
        }
      }
    });
  });
}

onMounted(() => {
  setupCanvas();
  redraw();

  window.addEventListener('resize', () => {
    setupCanvas();
    redraw();
  });

  canvas.value.addEventListener('mousedown', handleMousedown);
  canvas.value.addEventListener('mousemove', handleMousemove);
  canvas.value.addEventListener('mouseup', handleMouseup);
});

function handleMousedown(e) {
  const { offsetX, offsetY } = e;

  frames.forEach(frame => {
    frame.selected = false;
    frame.shapes.forEach(shape => shape.selected = false);
  });
  selectedFrame.value = null;
  selectedShape.value = null;

  if (activeAction.value === "none" || activeAction.value === "cursor") {
    for (let i = frames.length - 1; i >= 0; i--) {
      const frame = frames[i];

      for (let j = frame.shapes.length - 1; j >= 0; j--) {
        const shape = frame.shapes[j];
        if (isPointInShape(offsetX, offsetY, shape, frame)) {
          shape.selected = true;
          selectedShape.value = shape;
          frame.selected = true;
          selectedFrame.value = frame;
          startPos.value = {
            x: offsetX - (frame.x + shape.x),
            y: offsetY - (frame.y + shape.y)
          };
          redraw();
          return;
        }
      }

      if (isPointInFrame(offsetX, offsetY, frame)) {
        frame.selected = true;
        selectedFrame.value = frame;
        startPos.value = { x: offsetX - frame.x, y: offsetY - frame.y };
        redraw();
        return;
      }
    }
  }

  else if (activeAction.value === "frame") {
    isDrawing.value = true;
    startPos.value = { x: offsetX, y: offsetY };

    const newFrame = {
      id: `frame-${frames.length + 1}`,
      title: `Frame ${frames.length + 1}`,
      type: 'div',
      className: `frame-${frames.length + 1}`,
      style: {
        width: 0,
        height: 0,
        backgroundColor: 'rgba(52, 152, 219, 0.2)',
        border: '2px solid #3498db',
      },
      x: offsetX,
      y: offsetY,
      shapes: [],
      selected: false,
    };

    selectedFrame.value = newFrame;
    frames.push(newFrame);
  }
  else if (["rectangle", "circle", "text"].includes(activeAction.value)) {
    for (let i = frames.length - 1; i >= 0; i--) {
      const frame = frames[i];
      if (isPointInFrame(offsetX, offsetY, frame)) {
        isDrawing.value = true;
        frame.selected = true;
        selectedFrame.value = frame;

        const relativeX = offsetX - frame.x;
        const relativeY = offsetY - frame.y;
        startPos.value = { x: relativeX, y: relativeY };

        if (activeAction.value === "rectangle") {
          const newShape = {
            id: `shape-${frame.shapes.length + 1}`,
            type: 'rectangle',
            x: relativeX,
            y: relativeY,
            width: 0,
            height: 0,
            color: shapeColor.value,
            selected: true,
          };
          selectedShape.value = newShape;
          frame.shapes.push(newShape);
        } else if (activeAction.value === "circle") {
          const newShape = {
            id: `shape-${frame.shapes.length + 1}`,
            type: 'circle',
            x: relativeX,
            y: relativeY,
            radius: 0,
            color: shapeColor.value,
            selected: true,
          };
          selectedShape.value = newShape;
          frame.shapes.push(newShape);
        } else if (activeAction.value === "text") {
          const newShape = {
            id: `shape-${frame.shapes.length + 1}`,
            type: 'text',
            x: relativeX,
            y: relativeY,
            color: shapeColor.value,
            selected: true,
            textContent: '',
          };
          selectedShape.value = newShape;
          frame.shapes.push(newShape);
          isDrawing.value = false;
          isWriting.value = true;

          setTimeout(() => {
            const textareaElement = document.querySelector('textarea');
            if (textareaElement) textareaElement.focus();
          }, 0);
        }

        redraw();
        break;
      }
    }
  }
}

function handleMousemove(e) {
  const { offsetX, offsetY } = e;

  if (isWriting.value && selectedShape.value && selectedShape.value.type === 'text') {
    return;
  }

  if (activeAction.value === "cursor" && selectedFrame.value) {
    if (selectedShape.value) {
      selectedShape.value.x = offsetX - selectedFrame.value.x - startPos.value.x;
      selectedShape.value.y = offsetY - selectedFrame.value.y - startPos.value.y;
    } else {
      selectedFrame.value.x = offsetX - startPos.value.x;
      selectedFrame.value.y = offsetY - startPos.value.y;
    }
    redraw();
    return;
  }

  if (!isDrawing.value) return;

  if (activeAction.value === "frame") {
    const width = offsetX - startPos.value.x;
    const height = offsetY - startPos.value.y;
    const frame = selectedFrame.value;

    if (width < 0) {
      frame.x = offsetX;
      frame.style.width = Math.abs(width);
    } else {
      frame.x = startPos.value.x;
      frame.style.width = width;
    }

    if (height < 0) {
      frame.y = offsetY;
      frame.style.height = Math.abs(height);
    } else {
      frame.y = startPos.value.y;
      frame.style.height = height;
    }
  } else if (activeAction.value === "rectangle" && selectedShape.value) {
    const frame = selectedFrame.value;
    const shape = selectedShape.value;
    const relX = offsetX - frame.x;
    const relY = offsetY - frame.y;

    const width = relX - startPos.value.x;
    const height = relY - startPos.value.y;

    if (width < 0) {
      shape.x = relX;
      shape.width = Math.abs(width);
    } else {
      shape.x = startPos.value.x;
      shape.width = width;
    }

    if (height < 0) {
      shape.y = relY;
      shape.height = Math.abs(height);
    } else {
      shape.y = startPos.value.y;
      shape.height = height;
    }
  } else if (activeAction.value === "circle" && selectedShape.value) {
    const frame = selectedFrame.value;
    const shape = selectedShape.value;
    const relX = offsetX - frame.x;
    const relY = offsetY - frame.y;

    const distance = Math.max(
      Math.abs(relX - startPos.value.x),
      Math.abs(relY - startPos.value.y)
    );

    shape.radius = distance;
  }

  redraw();
}

function handleMouseup(e) {
  if (isWriting.value && selectedShape.value && selectedShape.value.type === 'text') {
    const textareaElement = document.querySelector('textarea');
    if (textareaElement) {
      const frame = selectedFrame.value;
      textareaElement.style.top = `${frame.y + selectedShape.value.y}px`;
      textareaElement.style.left = `${frame.x + selectedShape.value.x}px`;
      textareaElement.focus();
    }
    return;
  }

  isDrawing.value = false;

  if (activeAction.value === "cursor") {
    activeAction.value = "none";
  }
}

function finishTextEditing() {
  if (isWriting.value && selectedShape.value && selectedShape.value.type === 'text') {
    isWriting.value = false;
    redraw();
  }
}

function changeAction(action) {
  cleanup();
  activeAction.value = action;
}

function cleanup() {
  selectedFrame.value = null;
  selectedShape.value = null;
}

function changeAlign(align) {
  if (selectedShape.value && selectedFrame.value) {
    const frame = selectedFrame.value;
    const shape = selectedShape.value;

    if (align === 'left') {
      shape.x = 0;
    } else if (align === 'center') {
      shape.x = (frame.style.width - shape.width) / 2;
    } else if (align === 'right') {
      shape.x = frame.style.width - shape.width;
    }
    redraw();
  }
}

function changeJustify(justify) {
  if (selectedShape.value && selectedFrame.value) {
    const frame = selectedFrame.value;
    const shape = selectedShape.value;

    if (justify === 'left') {
      shape.y = 0;
    } else if (justify === 'center') {
      shape.y = (frame.style.height - shape.height) / 2;
    } else if (justify === 'right') {
      shape.y = frame.style.height - shape.height;
    }
    redraw();
  }
}

</script>

<template>
  <div id="app">
    <div id="toolbar">
      <div class="tool-section">
        <span class="section-title">Mode:</span>
        <button v-for="action in actions" :key="action" @click="changeAction(action)"
          :class="{ active: activeAction === action }">
          {{ action }}
        </button>
      </div>
    </div>

    <div id="status-bar">
      <div v-if="selectedFrame">
        Selected: {{ selectedFrame.title }}
        <span v-if="selectedShape">
          > {{ selectedShape.type }} {{ selectedShape.id }}
        </span>
      </div>
      <div v-else>No selection</div>
    </div>

    <div v-if="selectedShape" class="sidebar">
      <div>
        <span>Align items</span>
        <button v-for="align in ['left', 'center', 'right']" :key="align" @click="changeAlign(align)">
          {{ align }}
        </button>
      </div>
      <div>
        <span>Justify content</span>
        <button v-for="justify in ['left', 'center', 'right']" :key="justify" @click="changeJustify(justify)">
          {{ justify }}
        </button>
      </div>
    </div>

    <canvas id="canvas" ref="canvas"></canvas>
    <textarea v-if="isWriting && selectedShape && selectedShape.type === 'text'" v-model="selectedShape.textContent"
      @blur="finishTextEditing" @keydown.enter="finishTextEditing" :style="{
        position: 'absolute',
        top: selectedFrame ? (selectedFrame.y + selectedShape.y) + 'px' : '0px',
        left: selectedFrame ? (selectedFrame.x + selectedShape.x) + 'px' : '0px',
        minWidth: '100px',
        minHeight: '24px',
        padding: '2px',
        border: '1px dashed #999',
        background: 'rgba(255, 255, 255, 0.7)',
        zIndex: 100,
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px'
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
  cursor: crosshair;
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

.sidebar {
  padding: 20px;
  color: #2c3e50;
  position: absolute;
  top: 100px;
  left: 20px;
  bottom: 100px;
  background-color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  width: 200px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.sidebar > div {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sidebar span {
  font-size: 14px;
  font-weight: 600;
  color: #34495e;
  margin-bottom: 5px;
}

.sidebar button {
  padding: 8px 12px;
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s ease;
  color: #495057;
}

.sidebar button:hover {
  background-color: #e9ecef;
  transform: translateY(-1px);
}

.sidebar button.active {
  background-color: #3498db;
  color: white;
  border-color: #2980b9;
}

#status-bar {
  position: absolute;
  bottom: 20px;
  left: 20px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
}

input[type="text"] {
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
  width: 100px;
}

input[type="color"] {
  width: 30px;
  height: 20px;
  padding: 0;
  border: 1px solid #ddd;
  border-radius: 2px;
}

.resize-handle {
  position: absolute;
  width: 8px;
  height: 8px;
  background-color: white;
  border: 1px solid #3498db;
  border-radius: 50%;
}

.resize-handle:hover {
  background-color: #3498db;
  cursor: pointer;
}

.resize-handle.top-left { 
  top: -4px; 
  left: -4px;
  cursor: nw-resize;
}
.resize-handle.top-right { 
  top: -4px; 
  right: -4px;
  cursor: ne-resize;
}
.resize-handle.bottom-left { 
  bottom: -4px; 
  left: -4px;
  cursor: sw-resize;
}
.resize-handle.bottom-right { 
  bottom: -4px; 
  right: -4px;
  cursor: se-resize;
}
.resize-handle.top { 
  top: -4px; 
  left: 50%;
  transform: translateX(-50%);
  cursor: n-resize;
}
.resize-handle.bottom { 
  bottom: -4px; 
  left: 50%;
  transform: translateX(-50%);
  cursor: s-resize;
}
.resize-handle.left { 
  left: -4px; 
  top: 50%;
  transform: translateY(-50%);
  cursor: w-resize;
}
.resize-handle.right { 
  right: -4px; 
  top: 50%;
  transform: translateY(-50%);
  cursor: e-resize;
}
</style>