export function generateHTML(componentTree) {
  // Start the HTML element
  let html = `<${componentTree.type}`;

  // Add ID if it exists and isn't 'root'
  if (componentTree.id && componentTree.id !== "root") {
    html += ` id="${componentTree.id}"`;
  }

  // Add class if it exists
  if (componentTree.className) {
    html += ` class="${componentTree.className}"`;
  }

  // Close the opening tag
  html += ">";

  // Add text content if it exists
  if (componentTree.textContent) {
    html += componentTree.textContent;
  }

  // Process children recursively
  if (componentTree.children && componentTree.children.length > 0) {
    componentTree.children.forEach((child) => {
      html += generateHTML(child);
    });
  }

  // Add closing tag
  html += `</${componentTree.type}>`;

  return html;
}

export function generateHTML2(elements) {
  // console.log(elements)
  const frames = elements.value.filter((el) => el.type === "frame");
  const otherElements = elements.value.filter((el) => el.type !== "frame");

  const insideFrameIds = new Set();
  frames.forEach((frame) => {
    frame.children = otherElements.filter((child) =>
      isElementInsideFrame(child, frame)
    );
    frame.children.forEach((child) => insideFrameIds.add(child.id));
  });

  const layers = elements.value.filter(
    (el) => el.type === "frame" || !insideFrameIds.has(el.id)
  );

  let html = "";

  layers.forEach((layer) => {
    html += `<div ${layer.className ? `class=${layer.className}` : ""}>`;

    if (layer.type === "frame" && layer.children.length > 0) {
      layer.children.forEach((child) => {
        html += `<div ${
          child.className ? `class=${child.className}` : ""
        }></div>`;
      });
    }

    html += `</div>`;
  });

  return html;
}
