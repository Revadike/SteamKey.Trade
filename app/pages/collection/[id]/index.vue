<script setup>
  const { params: { id } } = useRoute();
</script>

<template>
  <collection-view :id="id" />
</template>
