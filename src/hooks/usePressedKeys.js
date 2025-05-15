import { ref, onMounted, onUnmounted } from "vue";

export function usePressedKeys() {
  const pressedKeys = ref(new Set());

  const handleKeyDown = (event) => {
    pressedKeys.value = new Set(pressedKeys.value).add(event.key);
  };

  const handleKeyUp = (event) => {
    const updated = new Set(pressedKeys.value);
    updated.delete(event.key);
    pressedKeys.value = updated;
  };

  onMounted(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
  });

  onUnmounted(() => {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
  });

  return pressedKeys;
}
