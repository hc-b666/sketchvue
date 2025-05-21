<template>
  <div class="color-picker">
    <label
      for="bgColor"
      style="font-size: 14px"
      >Background Color</label
    >
    <div @click="$refs.bgColorInput.click()">
      <span>{{ canvaBgColor }}</span>
      <input
        id="bgColor"
        type="color"
        :value="canvaBgColor"
        @input="
          (e) => {
            canvaBgColor = e.target.value
          }
        "
        style="background: transparent"
        ref="bgColorInput"
        @click.stop
      />
    </div>
  </div>
</template>

<script setup>
  // todo
</script>

<style lang="scss" scoped>
  .color-picker {
    width: 100%;

    display: flex;
    align-items: center;
    justify-content: space-between;

    & > div {
      padding: 4px 10.5px;
      border-radius: 6px;

      display: flex;
      align-items: center;
      gap: 4px;

      cursor: pointer;

      &:hover {
        background-color: oklch(37% 0.013 285.805);
      }

      input {
        width: 16px;
        height: 16px;
        border: none;
        outline: none;
      }

      span {
        font-size: 12px;
        font-weight: 400;
      }
    }
  }
</style>
