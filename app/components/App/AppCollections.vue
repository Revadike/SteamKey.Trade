<script setup>
  const { Collection } = useORM();

  defineProps({
    appid: {
      type: [String, Number],
      required: true
    }
  });
</script>

<template>
  <table-collections
    class="h-100"
    :default-sort-by="[{
      key: Collection.fields.updatedAt,
      order: 'desc'
    }]"
    :only-apps="[appid]"
    :row-link="(item) => `/collection/${item.id}`"
  />
</template>
