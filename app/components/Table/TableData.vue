<script setup>
  import { parseDate } from '~/assets/js/date';
  import { decodeFromQuery } from '~/assets/js/url';

  const snackbarStore = useSnackbarStore();
  const tablesStore = useTablesStore();
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
    quickFilters: {
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
    },
    collectionFilters: {
      type: [Array, Boolean],
      default: null
    },
    rowLink: {
      type: [String, Object, Function],
      default: null
    },
    tableId: {
      type: String,
      default: null
    }
  });

  const selectedOnly = ref(false);
  const selected = defineModel({
    type: Array,
    default: () => []
  });

  const activeFilters = ref({
    fields: [],
    collections: {
      any: false,
      only: [],
      exclude: []
    }
  });
  const activeFilterCount = computed(() => {
    return activeFilters.value.fields.length
      + activeFilters.value.collections.only.length
      + activeFilters.value.collections.exclude.length;
  });
  const activeHeaders = computed(() => {
    if (props.filtersInHeader) {
      return [
        ...props.headers,
        { value: 'table-data-filters-slot', sortable: false, align: 'end' }
      ];
    }

    return props.headers;
  });

  const filtersSyncedWithUrl = computed(() => {
    return props.filtersInUrl || props.quickFilters.length > 0;
  });

  const hasDialogFilters = computed(() => {
    return props.filters.length > 0 || Array.isArray(props.collectionFilters);
  });

  const waitingForUrlFilters = ref(filtersSyncedWithUrl.value && route.query.filters);
  const waitingForUrlSort = ref(props.sortInUrl && route.query.sort && route.query.order);

  watch([
    () => props.queryGetter,
    // () => props.headers,
    // () => props.mapItem,
    // () => props.rowProps,
    () => selectedOnly.value,
    () => activeFilters.value
  ], () => nextTick(refresh), { deep: true });

  watch(() => selected.value, (newValue) => {
    if (props.maxSelection > 0 && newValue.length > props.maxSelection) {
      selected.value = newValue.slice(0, props.maxSelection);
      snackbarStore.set('warning', `You can only select up to ${props.maxSelection} items.`);
    }
  });

  const resolvedTableId = computed(() => {
    if (props.tableId) {
      return props.tableId;
    }

    const headerSignature = (props.headers || []).map(header => header?.value).filter(Boolean)
      .join('|');
    return `${route.path}::${headerSignature}`;
  });

  // Load sort from store if available, otherwise use default
  const storedSort = computed(() => tablesStore.getPreferences(resolvedTableId.value)?.sortBy || null);
  const sortBy = ref(storedSort.value?.length ? [...storedSort.value] : [...props.defaultSortBy]);

  const syncSortWithUrl = () => {
    if (!props.sortInUrl) {
      return;
    }
    if (!sortBy.value.length) {
      // Remove sort/order from URL if no sort is active

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
    if (!filtersSyncedWithUrl.value) {
      waitingForUrlFilters.value = false;
      return;
    }

    if (!route.query.filters) {
      activeFilters.value = {
        fields: [],
        collections: {
          any: false,
          only: [],
          exclude: []
        }
      };
      waitingForUrlFilters.value = false;
      return;
    }

    try {
      const filters = await decodeFromQuery(route.query.filters);
      activeFilters.value = {
        fields: filters.fields || [],
        collections: {
          any: filters.collections?.any || false,
          only: filters.collections?.only || [],
          exclude: filters.collections?.exclude || []
        }
      };
    } catch (error) {
      console.error(error);
      activeFilters.value = {
        fields: [],
        collections: {
          any: false,
          only: [],
          exclude: []
        }
      };
    } finally {
      waitingForUrlFilters.value = false;
    }
  };

  onMounted(() => loadSortFromUrl());
  watch(() => route.query, () => {
    loadSortFromUrl();
    waitingForUrlFilters.value = !!(filtersSyncedWithUrl.value && route.query.filters);
    loadFiltersFromUrl();
  }, { immediate: true });
  watch(filtersSyncedWithUrl, (enabled) => {
    if (!enabled) {
      waitingForUrlFilters.value = false;
      return;
    }

    if (!route.query.filters) {
      waitingForUrlFilters.value = false;
      return;
    }

    waitingForUrlFilters.value = true;
    loadFiltersFromUrl();
  });
  watch(sortBy, () => {
    currentPage.value = 1;
    tablesStore.setSortBy(resolvedTableId.value, sortBy.value);
    syncSortWithUrl();
  }, { deep: true });

  const storedItemsPerPage = computed(() => tablesStore.getPreferences(resolvedTableId.value)?.itemsPerPage);
  const itemsPerPage = ref(storedItemsPerPage.value ?? Number(props.defaultItemsPerPage));
  const loading = ref(false);
  const currentPage = ref(1);
  const search = useDebouncedRef('', 600);
  const totalItems = ref(0);
  const serverItems = ref([]);
  let queryResults = [];
  let abortController = null;
  let activeRequestId = 0;

  // Watch itemsPerPage to save to store
  watch(itemsPerPage, (newValue) => {
    tablesStore.setItemsPerPage(resolvedTableId.value, newValue);
  });

  onBeforeUnmount(() => {
    if (abortController) {
      abortController.abort();
    }
  });

  const applyFilters = (filters) => {
    activeFilters.value = {
      fields: filters.fields || [],
      collections: {
        any: filters.collections?.any || false,
        only: filters.collections?.only || [],
        exclude: filters.collections?.exclude || []
      }
    };
    waitingForUrlFilters.value = false;
    loadItems({ itemsPerPage: itemsPerPage.value, page: 1, search: search.value, sortBy: sortBy.value });
  };

  const clearFilters = () => {
    activeFilters.value = {
      fields: [],
      collections: {
        any: false,
        only: [],
        exclude: []
      }
    };
    waitingForUrlFilters.value = false;
    loadItems({ itemsPerPage: itemsPerPage.value, page: 1, search: search.value, sortBy: sortBy.value });
  };

  const itemsPerPageOptions = computed(() => {
    return [1, 5, 10, 25, 50, 100, 250, 500, 1000].filter(item => item <= totalItems.value).concat(
      totalItems.value > 1000 ? [] : [{ title: 'All', value: totalItems.value }]
    );
  });

  const mapper = (result) => {
    return props.mapItem(result);
  };

  const isQueryBuilder = (value) => {
    return !!value
      && typeof value === 'object'
      && typeof value.range === 'function';
  };

  const resolveQueryBuilder = async (queryResult) => {
    let resolved = queryResult;

    // Supabase builders are thenable; awaiting them executes the query.
    if (resolved && typeof resolved.then === 'function' && !isQueryBuilder(resolved)) {
      resolved = await resolved;
    }

    if (resolved?.query) {
      resolved = resolved.query;
    }

    if (!isQueryBuilder(resolved)) {
      throw new Error('queryGetter must return a Supabase query builder.');
    }

    return { query: resolved };
  };

  const applyQueryMethod = (query, method, ...args) => {
    if (typeof query?.[method] !== 'function') {
      return query;
    }

    const nextQuery = query[method](...args);
    return nextQuery ?? query;
  };

  const remap = async () => {
    serverItems.value = await Promise.all(queryResults.map(mapper));
  };

  const loadItems = async ({ itemsPerPage, page, search, sortBy }) => {
    // Skip initial data loading if we're waiting for URL filters or sort
    if (waitingForUrlFilters.value || waitingForUrlSort.value) {
      return;
    }

    // Abort previous request if it's still running
    if (abortController) {
      abortController.abort();
    }

    // Create new abort controller for this request
    abortController = new AbortController();
    const signal = abortController.signal;
    const requestId = ++activeRequestId;

    loading.value = true;
    currentPage.value = page;

    try {
      let { query } = await resolveQueryBuilder(props.queryGetter(selectedOnly.value && selected.value.length, activeFilters.value));

      if (search && props.searchField) {
        query = applyQueryMethod(query, 'ilike', props.searchField, `%${search}%`);

        // // This only matches whole words, not partials
        // query = query.textSearch(props.searchField, search, {
        //   type: 'websearch',
        //   config: 'english'
        // });
      }

      if (activeFilters.value.fields.length) {
        activeFilters.value.fields.forEach((filter) => {
          const { field, operation, value } = filter;
          if (!field || !operation) {
            return;
          }

          // Format date values for database queries
          let formattedValue = value;
          if (value instanceof Date) {
            formattedValue = parseDate(value)?.toISOString();
          }

          if (operation === 'is') {
            if (value === 'null') {
              query = applyQueryMethod(query, 'is', field, null);
            } else if (value === 'not.null') {
              query = applyQueryMethod(query, 'not', field, 'is', null);
            }
          } else if (operation === 'eq') {
            query = applyQueryMethod(query, 'eq', field, formattedValue);
          } else if (operation === 'neq') {
            query = applyQueryMethod(query, 'neq', field, formattedValue);
          } else if (operation === 'gt') {
            query = applyQueryMethod(query, 'gt', field, formattedValue);
          } else if (operation === 'gte') {
            query = applyQueryMethod(query, 'gte', field, formattedValue);
          } else if (operation === 'lt') {
            query = applyQueryMethod(query, 'lt', field, formattedValue);
          } else if (operation === 'lte') {
            query = applyQueryMethod(query, 'lte', field, formattedValue);
          } else if (operation === 'like') {
            query = applyQueryMethod(query, 'like', field, formattedValue);
          } else if (operation === 'ilike') {
            query = applyQueryMethod(query, 'ilike', field, `%${formattedValue}%`);
          } else if (operation === 'cs') {
            query = applyQueryMethod(query, 'contains', field, formattedValue);
          } else if (operation === 'cd') {
            query = applyQueryMethod(query, 'containedBy', field, formattedValue);
          } else if (operation === 'ov') {
            query = applyQueryMethod(query, 'overlaps', field, formattedValue);
          } else if (operation === 'in') {
            query = applyQueryMethod(query, 'in', field, formattedValue);
          } else if (operation === 'or') {
            query = applyQueryMethod(query, 'or', value);
          }
        });
      }

      if (sortBy?.length) {
        sortBy.forEach(({ key, order }) => {
          query = applyQueryMethod(query, 'order', props.mapKey(key), {
            ascending: order === 'asc',
            nullsFirst: false
          });
        });
      }

      // Force returning count when the query builder exposes mutable headers.
      const isLastPage = page * itemsPerPage >= totalItems.value;
      if (query?.headers && typeof query.headers.append === 'function') {
        query.headers.append('Prefer', isLastPage ? 'count=exact' : 'count=estimated');
      }

      let executableQuery = query;
      if (typeof executableQuery.abortSignal === 'function') {
        executableQuery = applyQueryMethod(executableQuery, 'abortSignal', signal);
      }

      if (typeof executableQuery.range !== 'function') {
        throw new Error('Query builder does not support range pagination.');
      }

      // TODO: Use cursor-based pagination for better performance on large datasets
      const { data, error, count } = await executableQuery.range((page - 1) * itemsPerPage, page * itemsPerPage - 1); // for some reason it adds 1 to the end index

      // Check if request was aborted
      if (signal.aborted || requestId !== activeRequestId) {
        return;
      }

      if (error) {
        throw error;
      }

      queryResults = data;
      await remap();

      if (typeof count === 'number') {
        totalItems.value = count;
      } else {
        // Fallback when count is unavailable from PostgREST response headers.
        const loadedCount = Array.isArray(data) ? data.length : 0;
        const fallbackCount = (page - 1) * itemsPerPage + loadedCount;
        totalItems.value = page === 1
          ? fallbackCount
          : Math.max(totalItems.value, fallbackCount);
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.error(error);
        snackbarStore.set('error', 'Something went wrong while fetching the data');
      }
    } finally {
      if (requestId === activeRequestId) {
        loading.value = false;
      }
    }
  };

  const refresh = () => loadItems({ itemsPerPage: itemsPerPage.value, page: currentPage.value, search: search.value, sortBy: sortBy.value });

  const handleRowClick = (event, item) => {
    if (!props.rowLink) {
      emit('click:row', item);
      return;
    }

    // Get the link URL
    let linkUrl = props.rowLink;
    if (typeof props.rowLink === 'function') {
      linkUrl = props.rowLink(item);
    }

    // Convert object to string if needed
    if (typeof linkUrl === 'object') {
      linkUrl = linkUrl.path || linkUrl.href || String(linkUrl);
    }

    // Handle different click types
    if (event.ctrlKey || event.metaKey || event.button === 1) {
      // Ctrl+click or middle-click: open in new tab
      window.open(linkUrl, '_blank');
    } else if (event.shiftKey) {
      // Shift+click: open in new window
      window.open(linkUrl, '_blank', 'noopener,noreferrer');
    } else {
      // Normal click: use navigateTo
      navigateTo(linkUrl);
    }
  };

  defineExpose({
    loading,
    remap,
    refresh,
    currentPage,
    itemsPerPage,
    totalItems
  });
</script>

<template>
  <!-- TODO: Fix sticky header not working -->
  <v-data-table-server
    v-bind="$attrs"
    v-model="selected"
    v-model:items-per-page="itemsPerPage"
    v-model:page="currentPage"
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
    @click:row="(event, { item }) => handleRowClick(event, toRaw(item))"
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
        v-if="showSelect || searchField || hasDialogFilters || props.quickFilters.length"
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

        <s-quick-filters
          v-if="props.quickFilters.length"
          chip-size="large"
          class="mr-n2"
          :filters="props.quickFilters"
        />

        <dialog-data-filter
          v-if="hasDialogFilters && !filtersInHeader"
          :active-filters="activeFilters"
          :collection-filters="props.collectionFilters"
          :field-filters="props.filters"
          :sync-with-url="filtersSyncedWithUrl"
          @apply="applyFilters"
          @clear="clearFilters"
        >
          <template #activator="{ props: dialogProps }">
            <v-badge
              color="primary"
              :content="activeFilterCount.toString()"
              :model-value="activeFilterCount > 0"
              offset-x="5"
              offset-y="5"
            >
              <v-btn
                v-tooltip:top="activeFilterCount > 0 ? `${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} applied` : 'Apply filters'"
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
        v-if="hasDialogFilters"
        :active-filters="activeFilters"
        :collection-filters="props.collectionFilters"
        :field-filters="props.filters"
        :sync-with-url="filtersSyncedWithUrl"
        @apply="applyFilters"
        @clear="clearFilters"
      >
        <template #activator="{ props: dialogProps }">
          <v-badge
            color="primary"
            :content="activeFilterCount.toString()"
            :model-value="activeFilterCount > 0"
            offset-x="5"
            offset-y="5"
          >
            <v-btn
              v-tooltip:top="activeFilterCount > 0 ? `${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} applied` : 'Apply filters'"
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
