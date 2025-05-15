<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { generateCode } from './utils/generateCode';

const tabs = reactive(["Canva", "Code"]);
const activeTab = ref(tabs[0]);

const setActiveTab = (tab) => {
  activeTab.value = tab;
};

watch(() => activeTab.value, (newTab) => {
  if (newTab === 'Canva') {
    setupCanvas();
  }
});

const tree = reactive({
  id: 'root',
  type: 'div',
  className: 'root-container',
  style: {
    width: '1200px',
    height: '800px',
    position: 'relative',
    border: '1px solid #000',
    backgroundColor: 'blue',
  },
  children: [],
});

const layers = reactive({
  frames: [
    {
      id: 'frame-1',
      title: 'Frame 1',
      type: 'div',
      className: 'frame-1',
      style: {
        width: '400px',
        height: '200px',
        backgroundColor: 'white',
      },
      children: [],
    },
  ],
});

const canvas = ref(null);
let selectedRect = ref(null);
const selectedRectDimensions = reactive({
  width: 0,
  height: 0,
});
let ctx = null;
let draggingRect = null;
let resizingRect = null;
let offsetX = 0;
let offsetY = 0;
let activeHandle = null;
const handleSize = 10;

let isDrawing = false;
let startX = 0;
let startY = 0;
let tempRect = null;

const isContainerSelected = computed(() => {
  return selectedRect.value !== null;
});

function setupCanvas() {
  canvas.value.width = window.innerWidth;
  canvas.value.height = window.innerHeight;
  ctx = canvas.value.getContext('2d');
  renderTree();
}

onMounted(() => {
  setupCanvas();

  canvas.value.addEventListener('mousedown', onMouseDown);
  canvas.value.addEventListener('mousemove', onMouseMove);
  canvas.value.addEventListener('mouseup', onMouseUp);
});

function renderTree() {
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
  drawNode(ctx, tree, 0, 0);

  if (selectedRect.value) {
    drawHandles(selectedRect.value);
  }
}

function drawFrame(frame) {

}

function drawNode(ctx, node, offsetX, offsetY) {
  if (node.type === 'div') {
    const { width, height, top = 0, left = 0, backgroundColor } = node.style;
    drawRect(ctx, node, offsetX + parseInt(left), offsetY + parseInt(top), parseInt(width), parseInt(height), backgroundColor);
  }
  node.children.sort((a, b) => a.style.zIndex - b.style.zIndex).forEach((child) => {
    drawNode(ctx, child, offsetX, offsetY);
  });
}

function drawRect(ctx, node, x, y, width, height, color = 'rgba(0, 0, 255, 0.5)') {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = '#000';
  ctx.strokeRect(x, y, width, height);
  ctx.fillText(node.id, x + 5, y + 15);
}

function drawHandles(rect) {
  const { left, top, width, height } = rect.style;
  const rectX = parseInt(left);
  const rectY = parseInt(top);
  const rectWidth = parseInt(width);
  const rectHeight = parseInt(height);

  drawHandle(rectX, rectY);
  drawHandle(rectX + rectWidth, rectY);
  drawHandle(rectX, rectY + rectHeight);
  drawHandle(rectX + rectWidth, rectY + rectHeight);

  drawHandle(rectX + rectWidth / 2, rectY);
  drawHandle(rectX + rectWidth / 2, rectY + rectHeight);
  drawHandle(rectX, rectY + rectHeight / 2);
  drawHandle(rectX + rectWidth, rectY + rectHeight / 2);
}

function drawHandle(x, y) {
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'black';
  ctx.beginPath();
  ctx.arc(x, y, handleSize / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function addRect() {
  if (!selectedRect.value) return;

  const newRect = {
    id: `rect${selectedRect.value.children.length + 1}`,
    type: 'div',
    className: 'rect',
    style: {
      width: '200px',
      height: '100px',
      position: 'absolute',
      top: `${50 + selectedRect.value.children.length * 20}px`,
      left: `${50 + selectedRect.value.children.length * 20}px`,
      backgroundColor: '#ff0000',
      zIndex: selectedRect.value.children.length + 1,
    },
    children: [],
  };

  selectedRect.value.children.push(newRect);
  renderTree();
}

function createFrame() {
  const newContainer = {
    id: `container${tree.children.length + 1}`,
    type: 'div',
    className: 'flex-container',
    style: {
      width: '400px',
      height: '200px',
      position: 'absolute',
      top: `${50 + tree.children.length * 20}px`,
      left: `${50 + tree.children.length * 20}px`,
      backgroundColor: 'green',
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
    },
    children: [],
  };

  tree.children.push(newContainer);
  renderTree();
}

function removeFrame() {
  if (!selectedRect.value) return;

  if (selectedRect.value.className && selectedRect.value.className.includes('flex-container')) {
    const findParentNode = (node, targetNode) => {
      for (let i = 0; i < node.children.length; i++) {
        if (node.children[i] === targetNode) {
          return node;
        }
        const found = findParentNode(node.children[i], targetNode);
        if (found) return found;
      }
      return null;
    };

    const parentNode = findParentNode(tree, selectedRect.value);
    if (parentNode) {
      const index = parentNode.children.indexOf(selectedRect.value);
      if (index > -1) {
        parentNode.children.splice(index, 1);
        selectedRect.value = null;
        renderTree();
      }
    }
  }
}

function onMouseDown(event) {
  const { offsetX: mouseX, offsetY: mouseY } = event;

  isDrawing = true;
  startX = mouseX;
  startY = mouseY;

  // tempRect = {
  //   id: `frame-${layers.frames.length + 1}`,
  //   type: 'div',
  //   className: 'frame',

  // }

  if (selectedRect.value) {
    const { left, top, width, height } = selectedRect.value.style;
    const rectX = parseInt(left);
    const rectY = parseInt(top);
    const rectWidth = parseInt(width);
    const rectHeight = parseInt(height);

    if (isHandleClicked(mouseX, mouseY, rectX, rectY)) {
      activeHandle = 'top-left';
      resizingRect = selectedRect.value;
      return;
    } else if (isHandleClicked(mouseX, mouseY, rectX + rectWidth, rectY)) {
      activeHandle = 'top-right';
      resizingRect = selectedRect.value;
      return;
    } else if (isHandleClicked(mouseX, mouseY, rectX, rectY + rectHeight)) {
      activeHandle = 'bottom-left';
      resizingRect = selectedRect.value;
      return;
    } else if (isHandleClicked(mouseX, mouseY, rectX + rectWidth, rectY + rectHeight)) {
      activeHandle = 'bottom-right';
      resizingRect = selectedRect.value;
      return;
    }
    else if (isHandleClicked(mouseX, mouseY, rectX + rectWidth / 2, rectY)) {
      activeHandle = 'top-center';
      resizingRect = selectedRect.value;
      return;
    } else if (isHandleClicked(mouseX, mouseY, rectX + rectWidth / 2, rectY + rectHeight)) {
      activeHandle = 'bottom-center';
      resizingRect = selectedRect.value;
      return;
    } else if (isHandleClicked(mouseX, mouseY, rectX, rectY + rectHeight / 2)) {
      activeHandle = 'left-center';
      resizingRect = selectedRect.value;
      return;
    } else if (isHandleClicked(mouseX, mouseY, rectX + rectWidth, rectY + rectHeight / 2)) {
      activeHandle = 'right-center';
      resizingRect = selectedRect.value;
      return;
    }
  }

  const findClickedRect = (node, mouseX, mouseY) => {
    const { left, top, width, height } = node.style;
    const rectX = parseInt(left);
    const rectY = parseInt(top);
    const rectWidth = parseInt(width);
    const rectHeight = parseInt(height);

    if (
      mouseX >= rectX &&
      mouseX <= rectX + rectWidth &&
      mouseY >= rectY &&
      mouseY <= rectY + rectHeight
    ) {
      return node;
    }

    const sortedChildren = [...node.children].sort((a, b) =>
      (b.style.zIndex || 0) - (a.style.zIndex || 0)
    );

    for (const child of sortedChildren) {
      const clickedChild = findClickedRect(child, mouseX, mouseY);
      if (clickedChild) {
        return clickedChild;
      }
    }

    return null;
  };

  const clickedRect = findClickedRect(tree, mouseX, mouseY);

  if (clickedRect) {
    draggingRect = clickedRect;
    selectedRect.value = clickedRect;
    selectedRectDimensions.width = parseInt(clickedRect.style.width);
    selectedRectDimensions.height = parseInt(clickedRect.style.height);
    const { left, top } = clickedRect.style;
    offsetX = mouseX - parseInt(left);
    offsetY = mouseY - parseInt(top);
    renderTree();
    return;
  }

  selectedRect.value = null;
  renderTree();
}

function onMouseMove(event) {
  const { offsetX: mouseX, offsetY: mouseY } = event;
  console.log(isDrawing);

  if (isDrawing) {
    const width = mouseX - startX;
    const height = mouseY - startY;

    const rect = {
      id: `frame-${layers.frames.length + 1}`,
      type: 'div',
      className: 'frame',
      style: {
        width: `${width}px`,
        height: `${height}px`,
        // position: 'absolute',
        // top: `${startY}px`,
        // left: `${startX}px`,
        backgroundColor: 'rgba(0, 0, 255, 0.5)',
      },
      children: [],
    };

    layers.frames.push(rect);
    renderTree();

    return;
  }

  if (resizingRect) {
    const { style } = resizingRect;
    const rectX = parseInt(style.left);
    const rectY = parseInt(style.top);
    const rectWidth = parseInt(style.width);
    const rectHeight = parseInt(style.height);

    const minSize = 20;

    switch (activeHandle) {
      case 'top-left':
        const newWidthTL = Math.max(minSize, rectWidth + (rectX - mouseX));
        const newHeightTL = Math.max(minSize, rectHeight + (rectY - mouseY));
        style.left = `${rectX - (newWidthTL - rectWidth)}px`;
        style.top = `${rectY - (newHeightTL - rectHeight)}px`;
        style.width = `${newWidthTL}px`;
        style.height = `${newHeightTL}px`;
        break;

      case 'top-right':
        const newWidthTR = Math.max(minSize, mouseX - rectX);
        const newHeightTR = Math.max(minSize, rectHeight + (rectY - mouseY));
        style.width = `${newWidthTR}px`;
        style.top = `${rectY - (newHeightTR - rectHeight)}px`;
        style.height = `${newHeightTR}px`;
        break;

      case 'bottom-left':
        const newWidthBL = Math.max(minSize, rectWidth + (rectX - mouseX));
        style.left = `${rectX - (newWidthBL - rectWidth)}px`;
        style.width = `${newWidthBL}px`;
        style.height = `${Math.max(minSize, mouseY - rectY)}px`;
        break;

      case 'bottom-right':
        style.width = `${Math.max(minSize, mouseX - rectX)}px`;
        style.height = `${Math.max(minSize, mouseY - rectY)}px`;
        break;

      case 'top-center':
        const newHeightTC = Math.max(minSize, rectHeight + (rectY - mouseY));
        style.top = `${rectY - (newHeightTC - rectHeight)}px`;
        style.height = `${newHeightTC}px`;
        break;

      case 'bottom-center':
        style.height = `${Math.max(minSize, mouseY - rectY)}px`;
        break;

      case 'left-center':
        const newWidthLC = Math.max(minSize, rectWidth + (rectX - mouseX));
        style.left = `${rectX - (newWidthLC - rectWidth)}px`;
        style.width = `${newWidthLC}px`;
        break;

      case 'right-center':
        style.width = `${Math.max(minSize, mouseX - rectX)}px`;
        break;
    }

    renderTree();
    return;
  }

  if (draggingRect) {
    draggingRect.style.left = `${mouseX - offsetX}px`;
    draggingRect.style.top = `${mouseY - offsetY}px`;
    renderTree();
  }
}

function onMouseUp() {
  draggingRect = null;
  resizingRect = null;
  activeHandle = null;
  selectedRectDimensions.width = 0;
  selectedRectDimensions.height = 0;
}

function isHandleClicked(mouseX, mouseY, handleCenterX, handleCenterY) {
  const handleRadius = handleSize / 2;
  const distance = Math.sqrt(
    Math.pow(mouseX - handleCenterX, 2) + Math.pow(mouseY - handleCenterY, 2)
  );

  return distance <= handleRadius;
}
</script>

<template>
  <div class="app">
    <aside class="sidebar">
      <h2>Layers</h2>
      <ul>
        <li v-for="frame in layers.frames" :key="frame.id">
          <span>{{ frame.title }}</span>
        </li>
      </ul>
    </aside>
    <div id="toolbar">
      <button v-if="isContainerSelected" @click="addRect">Rectangle</button>
      <button v-if="isContainerSelected" @click="removeFrame">Remove Frame</button>
      <button @click="createFrame">Create Frame</button>
      <button v-for="tab in tabs" :key="tab" @click="setActiveTab(tab)" :class="{ active: activeTab === tab }">{{ tab
        }}</button>
    </div>
    <canvas v-show="activeTab === 'Canva'" id="canvas" ref="canvas"></canvas>
    <div v-show="activeTab === 'Code'" id="code">
      <pre>{{ generateCode(tree).html }}</pre>
      <pre>{{ generateCode(tree).css }}</pre>
    </div>
  </div>
</template>

<style scoped>
.app {
  width: 100%;
  height: 100vh;
  position: relative;
}

.sidebar {
  width: 200px;

  position: absolute;
  top: 100px;
  left: 0px;
  bottom: 100px;
  background-color: red;
}

#toolbar {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1000;
  background-color: #f0f0f0;
  padding: 10px;
  border-radius: 4px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}

#toolbar button {
  margin-right: 8px;
  padding: 5px 10px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

#toolbar button:hover {
  background-color: #45a049;
}

#toolbar button.active {
  background-color: #2196F3;
}

#canvas {
  width: 100%;
  height: 100%;
}

#code {
  width: 100%;
  height: 100%;
  background-color: #f0f0f0;
  padding: 20px;
  padding-top: 80px;
}

#code pre {
  background: #f7f9fc;
  padding: 20px;
  border-radius: 6px;
  overflow: auto;
}
</style>