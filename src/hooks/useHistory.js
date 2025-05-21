import { ref, computed } from 'vue'

export function useHistory(initialState) {
  const idx = ref(0)
  const history = ref([initialState])

  const setState = (action, overwrite = false) => {
    const currentState = history.value[idx.value]

    const newState = typeof action === 'function' ? action(currentState) : action

    if (overwrite) {
      const historyCopy = [...history.value]
      historyCopy[idx.value] = newState
      history.value = historyCopy
    } else {
      const updatedState = [...history.value].slice(0, idx.value + 1)
      updatedState.push(newState)
      history.value = updatedState
      idx.value = updatedState.length - 1
    }
  }

  const undo = () => {
    if (idx.value > 0) {
      idx.value--
    }
  }

  const redo = () => {
    if (idx.value < history.value.length - 1) {
      idx.value++
    }
  }

  const state = computed(() => history.value[idx.value])

  return {
    state,
    setState,
    undo,
    redo,
    _history: history,
    _idx: idx,
  }
}
