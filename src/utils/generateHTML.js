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
