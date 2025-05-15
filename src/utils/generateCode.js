import { generateHTML } from "./generateHTML";
import { generateCSS } from "./generateCSS";
import { formatHTML } from "./formatHTML";

export function generateCode(tree) {
  // Generate HTML
  const html = generateHTML(tree);

  // Generate CSS
  const css = generateCSS(tree);

  return {
    html: formatHTML(html),
    css: css,
  };
}
