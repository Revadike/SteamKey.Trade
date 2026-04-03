<script setup>
  import { parseDate } from '~/assets/js/date';
  import { decodeFromQuery } from '~/assets/js/url';

  const snackbarStore = useSnackbarStore();
  const slots = useSlots();
  const route = useRoute();
  const router = useRouter();

  const emit = defineEmits(['click:row']);
  const props = defineProps({
    queryGetter: {
      type: Function,
      required: true
    },
    headers: {
      type: Array,
      required: true
    },
    defaultSortBy: {
      type: Array,
      default: () => []
    },
    initialSortOrder: {
      type: String,
      default: 'asc',
      validator: value => ['asc', 'desc'].includes(value)
    },
    mustSort: {
      type: Boolean,
      default: false
    },
    sortInUrl: {
      type: Boolean,
      default: false
    },
    searchField: {
      type: [String, Boolean],
      default: false
    },
    simple: {
      type: Boolean,
      default: false
    },
    mapItem: {
      type: Function,
      default: item => item
    },
    mapKey: {
      type: Function,
      default: key => key
    },
    defaultItemsPerPage: {
      type: Number,
      default: 10,
      validator: value => value > 0
    },
    noDataText: {
      type: String,
      default: 'No results'
    },
    showSelect: {
      type: Boolean,
      default: false
    },
    maxSelection: {
      type: Number,
      default: 0
    },
    filters: {
      type: Array,
      default: () => []
    },
    filtersInHeader: {
      type: Boolean,
      default: false
    },
    filtersInUrl: {
      type: Boolean,
      default: false
    }
  });

  const selectedOnly = ref(false);
  const selected = defineModel({
    type: Array,
    default: () => []
  });

  const activeFilters = ref([]);
  const activeHeaders = computed(() => {
    if (props.filtersInHeader) {
      return [
        ...props.headers,
        { value: 'table-data-filters-slot', sortable: false, align: 'end' }
      ];
    }
    return props.headers;
  });

  const waitingForUrlFilters = ref(props.filtersInUrl && route.query.filters);
  const waitingForUrlSort = ref(props.sortInUrl && route.query.sort && route.query.order);

  watch([
    () => props.queryGetter,
    // () => props.headers,
    // () => props.mapItem,
    // () => props.rowProps,
    () => selectedOnly.value,
    () => activeFilters.value.length
  ], () => nextTick(refresh), { deep: true });

  watch(() => selected.value, newValue => {
    if (props.maxSelection > 0 && newValue.length > props.maxSelection) {
      selected.value = newValue.slice(0, props.maxSelection);
      snackbarStore.set('warning', `You can only select up to ${props.maxSelection} items.`);
    }
  });

  const sortBy = ref([...props.defaultSortBy]);

  const syncSortWithUrl = () => {
    if (!props.sortInUrl) {
      return;
    }
    if (!sortBy.value.length) {
      // Remove sort/order from URL if no sort is active
      // eslint-disable-next-line no-unused-vars
      const { sort, order, ...rest } = route.query;
      router.replace({ query: { ...rest } }, { shallow: true });
      return;
    }
    const { key, order } = sortBy.value[0] || {};
    if (!key || !order) {
      return;
    }
    router.replace({ query: { ...route.query, sort: key, order } }, { shallow: true });
  };

  const loadSortFromUrl = () => {
    if (!props.sortInUrl) {
      return;
    }
    const { sort, order } = route.query;
    if (sort && order) {
      sortBy.value = [{ key: sort, order }];
    }
    waitingForUrlSort.value = false;
  };

  const loadFiltersFromUrl = async () => {
    if (!props.filtersInUrl) {
      return;
    }
    const filters = route.query.filters ? await decodeFromQuery(route.query.filters) : [];
    if (filters.length) {
      activeFilters.value = filters;
      waitingForUrlFilters.value = false;
    } else {
      activeFilters.value = [];
    }
  };

  onMounted(() => loadSortFromUrl());
  watch(() => route.query, () => {
    loadSortFromUrl();
    loadFiltersFromUrl();
  }, { immediate: true });
  watch(sortBy, () => syncSortWithUrl(), { deep: true });

  const itemsPerPage = ref(props.defaultItemsPerPage * 1);
  const loading = ref(false);
  const currentPage = ref(1);
  const search = useDebouncedRef('', 600);
  const totalItems = ref(0);
  const serverItems = ref([]);
  let queryResults = [];

  const applyFilters = (filters) => {
    activeFilters.value = filters;
    waitingForUrlFilters.value = false;
    refresh();
  };

  const clearFilters = () => {
    activeFilters.value = [];
    waitingForUrlFilters.value = false;
    refresh();
  };

  const itemsPerPageOptions = computed(() => {
    return [1, 5, 10, 25, 50, 100, 250, 500, 1000].filter(item => item <= totalItems.value).concat(
      totalItems.value > 1000 ? [] : [{ title: 'All', value: totalItems.value }]
    );
  });

  const mapper = result => {
    return props.mapItem(result);
  };

  const remap = async () => {
    serverItems.value = await Promise.all(queryResults.map(mapper));
  };

  const loadItems = async ({ itemsPerPage, page, search, sortBy }) => {
    // Skip initial data loading if we're waiting for URL filters or sort
    if (waitingForUrlFilters.value || waitingForUrlSort.value) {
      return;
    }

    // Skip loading if already loading
    if (loading.value) {
      return;
    }

    loading.value = true;
    currentPage.value = page;

    try {
      let query = props.queryGetter(selectedOnly.value && selected.value.length);

      if (search && props.searchField) {
        query = query.ilike(props.searchField, `%${search}%`);

        // // This only matches whole words, not partials
        // query = query.textSearch(props.searchField, search, {
        //   type: 'websearch',
        //   config: 'english'
        // });
      }

      if (activeFilters.value.length) {
        activeFilters.value.forEach(filter => {
          const { field, operation, value } = filter;

          // Format date values for database queries
          let formattedValue = value;
          if (value instanceof Date) {
            formattedValue = parseDate(value)?.toISOString();
          }

          if (operation === 'is') {
            if (value === 'null') {
              query = query.is(field, null);
            } else if (value === 'not.null') {
              query = query.not(field, 'is', null);
            }
          } else if (operation === 'eq') {
            query = query.eq(field, formattedValue);
          } else if (operation === 'neq') {
            query = query.neq(field, formattedValue);
          } else if (operation === 'gt') {
            query = query.gt(field, formattedValue);
          } else if (operation === 'gte') {
            query = query.gte(field, formattedValue);
          } else if (operation === 'lt') {
            query = query.lt(field, formattedValue);
          } else if (operation === 'lte') {
            query = query.lte(field, formattedValue);
          } else if (operation === 'like') {
            query = query.like(field, formattedValue);
          } else if (operation === 'ilike') {
            query = query.ilike(field, `%${formattedValue}%`);
          } else if (operation === 'cs') {
            query = query.contains(field, formattedValue);
          } else if (operation === 'cd') {
            query = query.containedBy(field, formattedValue);
          } else if (operation === 'ov') {
            query = query.overlaps(field, formattedValue);
          } else if (operation === 'in') {
            query = query.in(field, formattedValue);
          } else if (operation === 'or') {
            query = query.or(value);
          }
        });
      }

      if (sortBy?.length) {
        sortBy.forEach(({ key, order }) => {
          query = query.order(props.mapKey(key), {
            ascending: order === 'asc',
            nullsFirst: false
          });
        });
      }

      // Force returning the count
      const isLastPage = page * itemsPerPage >= totalItems.value;
      query.headers.append('Prefer', isLastPage ? 'count=exact' : 'count=estimated');

      const { data, error, count } = await query.range((page - 1) * itemsPerPage, page * itemsPerPage - 1); // for some reason it adds 1 to the end index
      if (error) {
        throw error;
      }

      queryResults = data;
      await remap();
      totalItems.value = count;
    } catch (error) {
      console.error(error);
      snackbarStore.set('error', 'Something went wrong while fetching the data');
    }

    loading.value = false;
  };

  const refresh = () => loadItems({ itemsPerPage: itemsPerPage.value, page: currentPage.value, search: search.value, sortBy: sortBy.value });

  defineExpose({
    loading,
    remap,
    refresh,
    currentPage,
    itemsPerPage
  });
</script>

<template>
  <!-- TODO: Fix sticky header not working -->
  <v-data-table-server
    v-bind="$attrs"
    v-model="selected"
    v-model:items-per-page="itemsPerPage"
    v-model:sort-by="sortBy"
    class="data-table"
    fixed-header
    :header-props="{ class: 'text-overline', style: { lineHeight: 1.5 } }"
    :headers="activeHeaders"
    :hide-default-footer="totalItems <= itemsPerPage"
    hover
    :initial-sort-order="initialSortOrder"
    :items="serverItems"
    :items-length="totalItems"
    :items-per-page-options="itemsPerPageOptions"
    :loading="loading || waitingForUrlFilters"
    :must-sort="mustSort"
    :search="search"
    :show-select="showSelect"
    @click:row="(_, { item }) => emit('click:row', toRaw(item))"
    @update:options="loadItems"
  >
    <template #no-data>
      <span class="text-disabled font-italic">
        {{ waitingForUrlFilters ? 'Loading filters from URL...' : noDataText }}
      </span>
    </template>

    <template
      v-if="!props.simple"
      #top="attrs"
    >
      <slot
        name="top"
        v-bind="attrs"
      />
      <div
        v-if="showSelect || searchField || props.filters.length"
        class="d-flex justify-end align-center ga-2 px-2 pt-2"
      >
        <v-text-field
          v-if="searchField"
          v-model="search"
          clearable
          density="compact"
          hide-details
          label="Search"
          rounded
          variant="outlined"
        />

        <v-chip
          v-if="showSelect && selected.length > 0"
          :color="selectedOnly ? 'success' : ''"
          size="large"
          @click="selectedOnly = !selectedOnly"
        >
          {{ selected.length }}{{ maxSelection ? `/${maxSelection}` : '' }} selected
        </v-chip>

        <dialog-data-filter
          v-if="props.filters.length && !filtersInHeader"
          :active-filters="activeFilters"
          :filters="props.filters"
          :sync-with-url="filtersInUrl"
          @apply="applyFilters"
          @clear="clearFilters"
        >
          <template #activator="{ props: dialogProps }">
            <v-badge
              color="primary"
              :content="activeFilters.length.toString()"
              :model-value="activeFilters.length > 0"
              offset-x="5"
              offset-y="5"
            >
              <v-btn
                v-tooltip:top="activeFilters.length > 0 ? `${activeFilters.length} filter${activeFilters.length > 1 ? 's' : ''} applied` : 'Apply filters'"
                v-bind="dialogProps"
                icon="mdi-filter"
                variant="text"
              />
            </v-badge>
          </template>
        </dialog-data-filter>
      </div>
    </template>

    <template
      v-if="simple"
      #headers
    >
      <!-- POOF, GONE -->
    </template>

    <template #[`header.table-data-filters-slot`]>
      <dialog-data-filter
        v-if="props.filters.length"
        :active-filters="activeFilters"
        :filters="props.filters"
        :sync-with-url="filtersInUrl"
        @apply="applyFilters"
        @clear="clearFilters"
      >
        <template #activator="{ props: dialogProps }">
          <v-badge
            color="primary"
            :content="activeFilters.length.toString()"
            :model-value="activeFilters.length > 0"
            offset-x="5"
            offset-y="5"
          >
            <v-btn
              v-tooltip:top="activeFilters.length > 0 ? `${activeFilters.length} filter${activeFilters.length > 1 ? 's' : ''} applied` : 'Apply filters'"
              v-bind="dialogProps"
              icon="mdi-filter"
              variant="text"
            />
          </v-badge>
        </template>
      </dialog-data-filter>
    </template>

    <template
      v-for="slot in Object.keys(slots).filter(n => n !== 'top')"
      #[slot]="attrs"
    >
      <slot
        :name="slot"
        v-bind="attrs"
      />
    </template>
  </v-data-table-server>
</template>

<style lang="scss" scoped>
  .data-table {
    min-height: 200px;
    display: flex;
    flex-grow: 1;
    overflow-y: auto;
    overflow-x: hidden;

    ::v-deep(.v-data-table__td) {
      max-width: 300px;
    }
  }
</style>
