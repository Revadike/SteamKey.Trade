<script setup>
  const { params: { id } } = useRoute();

  definePageMeta({
    middleware: 'authenticated'
  });
</script>

<template>
  <trade-edit :id="id" />
</template>