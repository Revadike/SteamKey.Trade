<script setup>
  const title = 'Apps';
  const breadcrumbs = [
    { title: 'Home', to: '/' },
    { title, disabled: true }
  ];

  useSeoMeta({ title, ogTitle: title });
</script>

<template>
  <s-page-content :breadcrumbs="breadcrumbs">
    <v-card class="d-flex fill-height">
      <table-apps
        filters-in-url
        initial-sort-order="desc"
        sort-in-url
      />
    </v-card>
  </s-page-content>
</template>
