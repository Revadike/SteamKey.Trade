 <script setup>
  const selected = defineModel({
    type: Array,
    default: () => []
  });
</script>

<template>
  <table-collections
    v-bind="$attrs"
    v-model="selected"
    show-select
  />
</template>
