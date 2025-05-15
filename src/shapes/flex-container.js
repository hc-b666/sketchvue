/**
 *
 * @param {Object} tree
 * @param {Function} renderTree
 */
export function createFlexContainer(tree, renderTree) {
  const newContainer = {
    id: `container${tree.children.length + 1}`,
    type: "div",
    className: "flex-container",
    style: {
      width: "400px",
      height: "200px",
      position: "absolute",
      top: `${50 + tree.children.length * 20}px`,
      left: `${50 + tree.children.length * 20}px`,
      backgroundColor: "green",
      display: "flex",
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
    },
    children: [],
  };

  tree.children.push(newContainer);

  renderTree();
}
