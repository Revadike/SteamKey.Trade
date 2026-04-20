<script setup>
  import { encodeForQuery } from '~/assets/js/url';

  const props = defineProps({
    filters: {
      type: Array,
      required: true
    },
    chipSize: {
      type: String,
      default: 'default'
    }
  });

  const route = useRoute();
  const router = useRouter();

  const encodedFilters = ref([]);

  // Encode all filters when the component is mounted or when filters change
  watchEffect(async () => {
    encodedFilters.value = await Promise.all(
      props.filters.map(async (filter) => ({
        title: filter.title,
        value: await encodeForQuery(filter.value)
      }))
    );
  });

  // Get active filter directly from the URL, matching it against our encoded filters
  const activeFilter = computed(() => {
    if (!route.query.filters) { return null; }

    return encodedFilters.value.find(filter =>
      decodeURIComponent(filter.value) === route.query.filters
    )?.value || null;
  });

  // Handle navigation when a filter is clicked
  const handleFilterClick = (filterValue) => {
    const currentQuery = { ...route.query };

    if (activeFilter.value === filterValue) {
      // If clicking the active filter, remove the filter
      delete currentQuery.filters;
    } else {
      // Apply the new filter
      currentQuery.filters = decodeURIComponent(filterValue);
    }

    router.push({ query: currentQuery });
  };
</script>

<template>
  <v-chip-group
    :model-value="activeFilter"
    show-arrows
  >
    <v-chip
      v-for="filter in encodedFilters"
      :key="filter.title"
      filter
      prepend-icon="mdi-filter"
      :size="chipSize"
      :text="filter.title"
      :value="filter.value"
      variant="tonal"
      @click="handleFilterClick(filter.value)"
    />
  </v-chip-group>
</template>

<style lang="scss" scoped>
  :deep(.v-slide-group__content) {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  :deep(.v-slide-group__prev--disabled),
  :deep(.v-slide-group__next--disabled) {
    display: none;
  }
</style>
