<script setup>
  defineProps({
    userId: {
      type: String,
      required: true
    }
  });
</script>

<template>
  <table-collections
    :only-users="[userId]"
    :search-field="false"
  />
</template>