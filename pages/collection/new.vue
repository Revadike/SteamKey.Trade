<script setup>
  useSeoMeta({
    title: 'New collection'
  });

  definePageMeta({
    middleware: 'authenticated'
  });
</script>

<template>
  <collection-edit />
</template>

<style>

</style>
