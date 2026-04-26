<script setup>
  const { params: { id } } = useRoute();

  definePageMeta({
    middleware: 'authenticated'
  });
</script>

<template>
  <collection-edit :id="id" />
</template>