<script setup>
  const { params: { id } } = useRoute();
</script>

<template>
  <trade-view :id="id" />
</template>