export function generateCSS(componentTree, selector = '') {
  let css = ''

  // Determine the CSS selector
  let currentSelector
  if (componentTree.id && componentTree.id !== 'root') {
    currentSelector = `#${componentTree.id}`
  } else if (componentTree.className) {
    currentSelector = `.${componentTree.className.split(' ')[0]}` // Use first class if multiple
  } else {
    currentSelector = componentTree.type + selector
  }

  // Generate CSS for current component if it has styles
  if (componentTree.style && Object.keys(componentTree.style).length > 0) {
    css += `${currentSelector} {\n`

    // Add each style property
    Object.entries(componentTree.style).forEach(([property, value]) => {
      // Convert camelCase to kebab-case for CSS properties
      if (property === 'zIndex') return
      const cssProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase()
      css += `  ${cssProperty}: ${value};\n`
    })

    css += '}\n\n'
  }

  // Process children recursively
  if (componentTree.children && componentTree.children.length > 0) {
    componentTree.children.forEach((child, index) => {
      // Create a more specific selector for child elements without id/class
      const childSelector = ` > ${child.type}:nth-child(${index + 1})`
      css += generateCSS(child, child.id || child.className ? '' : childSelector)
    })
  }

  return css
}
