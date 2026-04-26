<script setup>
  defineProps({
    appid: {
      type: [String, Number],
      required: true
    }
  });
</script>

<template>
  <table-apps
    class="h-100"
    :only-parents="[appid]"
    simple
  />
</template>