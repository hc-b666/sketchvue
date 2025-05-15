export function formatHTML(html) {
  let formatted = "";
  let indent = 0;

  // Simple parser to add line breaks and indentation
  const tags = html.match(/<\/?[^>]+>/g);
  let textContent = html.split(/<\/?[^>]+>/g);

  if (tags) {
    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];

      // Handle closing tags
      if (tag.startsWith("</")) {
        indent--;
      }

      // Add indent and tag
      formatted += "\n" + "  ".repeat(Math.max(0, indent)) + tag;

      // Add text content if it exists
      if (textContent[i + 1] && textContent[i + 1].trim()) {
        formatted += textContent[i + 1];
      }

      // Handle opening tags (but not self-closing)
      if (!tag.startsWith("</") && !tag.endsWith("/>")) {
        indent++;
      }
    }
  }

  return formatted.trim();
}
