<script setup>
  import { encodeForQuery, decodeFromQuery } from '~/assets/js/url';

  const props = defineProps({
    title: {
      type: String,
      default: 'Filters'
    },
    fieldFilters: {
      type: Array,
      default: () => []
    },
    activeFilters: {
      type: Object,
      default: () => ({
        fields: [],
        collections: {
          any: false,
          only: [],
          exclude: []
        }
      })
    },
    collectionFilters: {
      type: [Array, Boolean],
      default: null
    },
    syncWithUrl: {
      type: Boolean,
      default: false
    }
  });

  const emit = defineEmits(['apply', 'clear']);
  const router = useRouter();
  const route = useRoute();

  const internalValue = defineModel({ type: Boolean, default: false });

  const showCollectionFilters = computed(() => {
    return Array.isArray(props.collectionFilters);
  });

  const collectionOptions = computed(() => {
    const options = Array.isArray(props.collectionFilters)
      ? props.collectionFilters
      : [];

    return options
      .filter(option => option?.value)
      .map(option => ({
        title: option.title || option.value,
        value: option.value
      }));
  });

  const localFieldFilters = ref([]);
  const localCollectionFilters = ref([]);
  const collectionMatchAny = ref(false);
  const newCollectionFilter = ref({
    mode: 'only',
    collectionId: null
  });

  const collectionCustomOptionValue = '__custom__';

  const collectionDropdownCustomOption = Object.freeze({
    title: 'Other collection...',
    value: collectionCustomOptionValue
  });

  const collectionPickerVisible = ref(false);
  const collectionPickerSelection = ref([]);
  const collectionPickerTargetIndex = ref(null);

  const getCollectionTitle = (collectionId) => {
    return collectionOptions.value.find(option => option.value === collectionId)?.title || collectionId;
  };

  const getCollectionSelectionOptions = (selectedCollectionId = null) => {
    const usedCollectionIds = new Set(localCollectionFilters.value
      .map(row => row.collectionId)
      .filter(collectionId => collectionId !== selectedCollectionId));

    const options = collectionOptions.value.filter((option) => {
      return option.value === selectedCollectionId || !usedCollectionIds.has(option.value);
    });

    if (selectedCollectionId && !options.some(option => option.value === selectedCollectionId)) {
      options.unshift({
        title: getCollectionTitle(selectedCollectionId),
        value: selectedCollectionId
      });
    }

    return [
      ...options,
      collectionDropdownCustomOption
    ];
  };

  const hydrateFromFilters = (payload) => {
    const fields = payload?.fields || [];
    const collections = payload?.collections || { any: false, only: [], exclude: [] };

    localFieldFilters.value = [...fields];

    if (!showCollectionFilters.value) {
      localCollectionFilters.value = [];
      collectionMatchAny.value = false;
      return;
    }

    collectionMatchAny.value = !!collections.any;
    localCollectionFilters.value = [
      ...((collections.only || []).map(collectionId => ({
        mode: 'only',
        collectionId
      }))),
      ...((collections.exclude || []).map(collectionId => ({
        mode: 'exclude',
        collectionId
      })))
    ];

    newCollectionFilter.value = {
      mode: 'only',
      collectionId: null
    };
  };

  const configuredCollectionRows = computed(() => {
    return localCollectionFilters.value;
  });

  const totalActiveFilters = computed(() => {
    return localFieldFilters.value.length + (showCollectionFilters.value ? configuredCollectionRows.value.length : 0);
  });

  const buildFiltersForEmit = () => {
    const fieldFilters = [...localFieldFilters.value].map((filter) => {
      const filterDef = getFilterDefinition(filter.field);
      if (filterDef && filterDef.type?.name === 'Array' && !Array.isArray(filter.value)) {
        return {
          ...filter,
          value: [filter.value]
        };
      }

      return filter;
    });

    const collectionFilters = {
      any: showCollectionFilters.value ? collectionMatchAny.value : false,
      only: showCollectionFilters.value
        ? configuredCollectionRows.value
          .filter(row => row.mode !== 'exclude')
          .map(row => row.collectionId)
        : [],
      exclude: showCollectionFilters.value
        ? configuredCollectionRows.value
          .filter(row => row.mode === 'exclude')
          .map(row => row.collectionId)
        : []
    };

    return {
      fields: fieldFilters,
      collections: collectionFilters
    };
  };

  // Handle URL synchronization manually for compressed data
  const syncFiltersWithUrl = async (filters) => {
    if (!props.syncWithUrl) {
      return;
    }

    try {
      const encodedData = await encodeForQuery(filters);

      // Update the URL preserving other parameters
      const query = { ...route.query, filters: encodedData };
      router.replace({ query }, { shallow: true });
    } catch (err) {
      console.error('Failed to encode filters for URL:', err);
    }
  };

  // Load filters from URL
  const loadFiltersFromUrl = async () => {
    if (!props.syncWithUrl || !route.query.filters) {
      return;
    }

    try {
      const decoded = await decodeFromQuery(route.query.filters);
      hydrateFromFilters(decoded);
      emit('apply', buildFiltersForEmit());
    } catch (err) {
      console.error('Failed to decode filters from URL:', err);
    }
  };

  // Load filters from URL if syncWithUrl is enabled
  onMounted(() => loadFiltersFromUrl());

  const clearFiltersFromUrl = () => {
    if (!props.syncWithUrl) {
      return;
    }

    const query = { ...route.query };
    delete query.filters;
    router.replace({ query }, { shallow: true });
  };

  watch(() => props.activeFilters, (newVal) => {
    const hasIncoming = (newVal?.fields?.length || 0) > 0
      || (newVal?.collections?.only?.length || 0) > 0
      || (newVal?.collections?.exclude?.length || 0) > 0;
    const hasLocal = localFieldFilters.value.length > 0 || localCollectionFilters.value.length > 0;

    if (!internalValue.value || !hasLocal || hasIncoming) {
      hydrateFromFilters(newVal);
    }
  }, { deep: true, immediate: true });

  watch(showCollectionFilters, (enabled) => {
    if (!enabled) {
      collectionMatchAny.value = false;
      localCollectionFilters.value = [];
      collectionPickerVisible.value = false;
      collectionPickerSelection.value = [];
      collectionPickerTargetIndex.value = null;
      newCollectionFilter.value = {
        mode: 'only',
        collectionId: null
      };
    }
  }, { immediate: true });

  const newFilter = ref({
    field: null,
    operation: null,
    value: null
  });

  const hasFilterValue = (value) => {
    if (value === null || value === undefined) {
      return false;
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === 'string') {
      return value.trim().length > 0;
    }

    return true;
  };

  watch(() => newFilter.value.field, () => {
    if (newFilter.value.field && !newFilter.value.operation) {
      const options = getOperationOptions(newFilter.value.field);
      newFilter.value.operation = options[0].value;
    }
  });

  const activeIndexSet = reactive(new Set());
  const hoveredIndexSet = reactive(new Set());

  const filterOperations = {
    String: [
      { value: 'eq', title: 'equals' },
      { value: 'neq', title: 'not equal' },
      { value: 'ilike', title: 'contains' },
      { value: 'like', title: 'matches pattern' },
      { value: 'is', title: 'is (known/unknown)' },
      { value: 'in', title: 'in (multiple values)' }
    ],
    Number: [
      { value: 'eq', title: 'equals' },
      { value: 'neq', title: 'not equal' },
      { value: 'gt', title: 'greater than' },
      { value: 'gte', title: 'greater than or equal' },
      { value: 'lt', title: 'less than' },
      { value: 'lte', title: 'less than or equal' },
      { value: 'is', title: 'is (known/unknown)' },
      { value: 'in', title: 'in (multiple values)' }
    ],
    Boolean: [
      { value: 'eq', title: 'equals' },
      { value: 'is', title: 'is (known/unknown)' }
    ],
    Array: [
      { value: 'cs', title: 'contains' },
      { value: 'cd', title: 'contained by' },
      { value: 'ov', title: 'overlaps' },
      { value: 'is', title: 'is (known/unknown)' }
    ],
    Object: [
      { value: 'is', title: 'is (known/unknown)' }
    ],
    Date: [
      { value: 'eq', title: 'equals' },
      { value: 'neq', title: 'not equal' },
      { value: 'gt', title: 'greater than' },
      { value: 'gte', title: 'greater than or equal' },
      { value: 'lt', title: 'less than' },
      { value: 'lte', title: 'less than or equal' },
      { value: 'is', title: 'is (known/unknown)' }
    ]
  };

  const nullValueOptions = [
    { value: 'null', title: 'unknown' },
    { value: 'not.null', title: 'known' }
  ];

  // Utility functions for filter operations
  const getFilterDefinition = fieldValue =>
    props.fieldFilters.find(filter => filter.value === fieldValue);

  const getOperationOptions = (fieldValue) => {
    if (!fieldValue) {
      return [];
    }

    const filterDef = getFilterDefinition(fieldValue);
    if (!filterDef) {
      return [];
    }

    const typeName = filterDef.type?.name || 'String';
    return filterOperations[typeName];
  };

  const getValueOptions = (fieldValue) => {
    const filterDef = getFilterDefinition(fieldValue);
    if (!filterDef) {
      return [];
    }

    if (Array.isArray(filterDef.options) && filterDef.options.length > 0) {
      // Already in the correct format with title/value
      if (typeof filterDef.options[0] === 'object' && filterDef.options[0] !== null) {
        return filterDef.options;
      }

      // Simple array values need to be converted to objects with title/value
      return filterDef.options.map(option => ({
        title: option.toString(),
        value: option
      }));
    }

    if (isBooleanType(fieldValue)) {
      return [
        { title: 'Yes', value: true },
        { title: 'No', value: false }
      ];
    }

    return [];
  };

  const isDateType = (fieldValue) => {
    if (!fieldValue) {
      return false;
    }

    const filterDef = getFilterDefinition(fieldValue);
    return filterDef?.type?.name === 'Date';
  };

  const isBooleanType = (fieldValue) => {
    if (!fieldValue) {
      return false;
    }

    const filterDef = getFilterDefinition(fieldValue);
    return filterDef?.type?.name === 'Boolean';
  };

  const isNumberType = (fieldValue) => {
    if (!fieldValue) {
      return false;
    }

    const filterDef = getFilterDefinition(fieldValue);
    return filterDef?.type?.name === 'Number';
  };

  const resetNewFilter = () => {
    newFilter.value = {
      field: null,
      operation: null,
      value: null
    };
  };

  const addFilter = () => {
    if (!newFilter.value.field || !newFilter.value.operation || !hasFilterValue(newFilter.value.value)) {
      return;
    }

    // Don't duplicate filters for the same field and operation
    const existingIndex = localFieldFilters.value.findIndex(f =>
      f.field === newFilter.value.field && f.operation === newFilter.value.operation);

    if (existingIndex !== -1) {
      localFieldFilters.value.splice(existingIndex, 1, { ...newFilter.value });
    } else {
      localFieldFilters.value.push({ ...newFilter.value });
    }

    resetNewFilter();
  };

  const removeFilter = (index) => {
    localFieldFilters.value.splice(index, 1);
  };

  const updateFilter = (index, field, value) => {
    const updatedFilter = { ...localFieldFilters.value[index] };
    updatedFilter[field] = value;

    // If operation is changed to 'in', initialize value as empty array if it's not already an array
    if (field === 'operation' && value === 'in' && !Array.isArray(updatedFilter.value)) {
      updatedFilter.value = [];
    }

    // If operation is changed from 'in' to something else, convert array to single value
    if (field === 'operation' && value !== 'in' && Array.isArray(updatedFilter.value)) {
      updatedFilter.value = updatedFilter.value.length > 0 ? updatedFilter.value[0] : null;
    }

    localFieldFilters.value.splice(index, 1, updatedFilter);

    // If operation changed, reset value to null
    if (field === 'operation') {
      localFieldFilters.value[index].value = null;
    }
  };

  const setCollectionMode = (index, mode) => {
    const row = localCollectionFilters.value[index];
    if (!row) {
      return;
    }

    row.mode = mode;
  };

  const openCollectionPicker = (rowIndex = null) => {
    collectionPickerSelection.value = [];
    collectionPickerTargetIndex.value = rowIndex;
    collectionPickerVisible.value = true;
  };

  const closeCollectionPicker = () => {
    collectionPickerVisible.value = false;
    collectionPickerSelection.value = [];
    collectionPickerTargetIndex.value = null;
  };

  const setCollectionSelection = (index, selectionValue) => {
    if (!localCollectionFilters.value[index]) {
      return;
    }

    if (!selectionValue) {
      removeCollectionRow(index);
      return;
    }

    if (selectionValue === collectionCustomOptionValue) {
      openCollectionPicker(index);
      return;
    }

    const duplicateIndex = localCollectionFilters.value.findIndex((candidate, candidateIndex) => {
      return candidateIndex !== index && candidate.collectionId === selectionValue;
    });

    if (duplicateIndex !== -1) {
      localCollectionFilters.value.splice(duplicateIndex, 1);
      if (duplicateIndex < index) {
        index -= 1;
      }
    }

    localCollectionFilters.value[index].collectionId = selectionValue;
  };

  const removeCollectionRow = (index) => {
    localCollectionFilters.value.splice(index, 1);
  };

  const setNewCollectionMode = (mode) => {
    newCollectionFilter.value.mode = mode;
  };

  const addCollectionFilter = () => {
    if (!newCollectionFilter.value.collectionId) {
      return;
    }

    const existingIndex = localCollectionFilters.value.findIndex((row) => {
      return row.collectionId === newCollectionFilter.value.collectionId;
    });

    if (existingIndex !== -1) {
      localCollectionFilters.value.splice(existingIndex, 1, { ...newCollectionFilter.value });
    } else {
      localCollectionFilters.value.push({ ...newCollectionFilter.value });
    }

    newCollectionFilter.value = {
      mode: 'only',
      collectionId: null
    };
  };

  const setNewCollectionSelection = (selectionValue) => {
    if (selectionValue === collectionCustomOptionValue) {
      openCollectionPicker();
      return;
    }

    newCollectionFilter.value.collectionId = selectionValue;
    addCollectionFilter();
  };

  const applyCollectionPicker = () => {
    const selectedCollectionId = collectionPickerSelection.value?.[0]?.id;

    if (!selectedCollectionId) {
      closeCollectionPicker();
      return;
    }

    if (collectionPickerTargetIndex.value === null) {
      newCollectionFilter.value.collectionId = selectedCollectionId;
      addCollectionFilter();
    } else {
      setCollectionSelection(collectionPickerTargetIndex.value, selectedCollectionId);
    }

    closeCollectionPicker();
  };

  const applyFilters = () => {
    const filters = buildFiltersForEmit();

    emit('apply', filters);
    internalValue.value = false;

    syncFiltersWithUrl(filters);
  };

  const clearFilters = () => {
    localFieldFilters.value = [];
    collectionMatchAny.value = false;
    localCollectionFilters.value = [];
    collectionPickerVisible.value = false;
    collectionPickerSelection.value = [];
    collectionPickerTargetIndex.value = null;
    newCollectionFilter.value = {
      mode: 'only',
      collectionId: null
    };
    internalValue.value = false;
    emit('clear');
    clearFiltersFromUrl();
  };
</script>

<template>
  <v-dialog
    v-model="internalValue"
    max-width="720"
  >
    <template #activator="attrs">
      <slot
        name="activator"
        v-bind="attrs"
      />
    </template>
    <v-card>
      <v-card-title>
        <v-icon
          icon="mdi-filter"
          size="24"
        />
        {{ title }}
      </v-card-title>
      <v-card-text>
        <template v-if="showCollectionFilters">
          <div class="d-flex align-center justify-space-between">
            <strong>Collections</strong>

            <div
              v-tooltip:top="'By default multiple inclusion filters use AND logic. Check this to use OR logic instead.'"
              class="d-flex align-center cursor-pointer"
              @click="collectionMatchAny = !collectionMatchAny"
            >
              <span>Match any</span>
              <v-switch
                v-model="collectionMatchAny"
                class="mx-4"
                density="compact"
                hide-details
              />
            </div>
          </div>

          <v-list class="mb-8 mt-0">
            <v-list-item
              v-for="(row, index) in localCollectionFilters"
              :key="`${row.mode}-${row.collectionId}-${index}`"
              class="pa-0"
              :class="{ faded: !activeIndexSet.has(`collection-${index}`) && !hoveredIndexSet.has(`collection-${index}`) }"
              @mouseenter="hoveredIndexSet.add(`collection-${index}`)"
              @mouseleave="hoveredIndexSet.delete(`collection-${index}`)"
            >
              <v-row
                align="center"
                dense
              >
                <v-col cols="3">
                  <v-btn-toggle
                    class="border w-100"
                    density="comfortable"
                    mandatory
                    :model-value="row.mode"
                    @update:model-value="value => setCollectionMode(index, value)"
                  >
                    <v-btn
                      v-tooltip:top="'Exclude'"
                      class="w-50"
                      color="error"
                      :value="'exclude'"
                    >
                      <v-icon icon="mdi-close" />
                    </v-btn>
                    <v-btn
                      v-tooltip:top="'Only'"
                      class="w-50"
                      color="success"
                      :value="'only'"
                    >
                      <v-icon icon="mdi-check" />
                    </v-btn>
                  </v-btn-toggle>
                </v-col>
                <v-col cols="8">
                  <v-select
                    density="compact"
                    hide-details
                    item-title="title"
                    item-value="value"
                    :items="getCollectionSelectionOptions(row.collectionId)"
                    label="Collection"
                    :model-value="row.collectionId"
                    @update:model-value="value => setCollectionSelection(index, value)"
                  />
                </v-col>
                <v-col cols="1">
                  <v-btn
                    color="error"
                    density="compact"
                    icon="mdi-close"
                    rounded
                    variant="text"
                    @click="removeCollectionRow(index)"
                  />
                </v-col>
              </v-row>
            </v-list-item>

            <v-list-item class="pa-0">
              <v-row
                align="center"
                dense
              >
                <v-col cols="3">
                  <v-btn-toggle
                    class="border w-100"
                    density="comfortable"
                    mandatory
                    :model-value="newCollectionFilter.mode"
                    @update:model-value="setNewCollectionMode"
                  >
                    <v-btn
                      v-tooltip:top="'Exclude'"
                      class="w-50"
                      color="error"
                      :value="'exclude'"
                    >
                      <v-icon icon="mdi-close" />
                    </v-btn>
                    <v-btn
                      v-tooltip:top="'Only'"
                      class="w-50"
                      color="success"
                      :value="'only'"
                    >
                      <v-icon icon="mdi-check" />
                    </v-btn>
                  </v-btn-toggle>
                </v-col>
                <v-col cols="8">
                  <v-select
                    density="compact"
                    hide-details
                    item-title="title"
                    item-value="value"
                    :items="getCollectionSelectionOptions()"
                    label="Collection"
                    :model-value="newCollectionFilter.collectionId"
                    @update:model-value="setNewCollectionSelection"
                  />
                </v-col>
              </v-row>
            </v-list-item>
          </v-list>

          <v-dialog
            v-model="collectionPickerVisible"
            max-width="760"
          >
            <v-card>
              <v-card-title>Select collection</v-card-title>
              <v-card-text>
                <table-collections
                  v-model="collectionPickerSelection"
                  :max-selection="1"
                  show-select
                />
              </v-card-text>
              <v-divider />
              <v-card-actions>
                <v-btn
                  variant="text"
                  @click="closeCollectionPicker"
                >
                  Cancel
                </v-btn>
                <v-spacer />
                <v-btn
                  :disabled="!collectionPickerSelection.length"
                  variant="tonal"
                  @click="applyCollectionPicker"
                >
                  Select
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>

          <strong>Fields</strong>
        </template>

        <v-list>
          <v-list-item
            v-for="(filter, index) in localFieldFilters"
            :key="index"
            class="pa-0"
            :class="{ faded: !activeIndexSet.has(index) && !hoveredIndexSet.has(index) }"
            @mouseenter="hoveredIndexSet.add(index)"
            @mouseleave="hoveredIndexSet.delete(index)"
          >
            <v-row
              align="center"
              dense
            >
              <v-col cols="3">
                <v-select
                  density="compact"
                  hide-details
                  item-title="title"
                  item-value="value"
                  :items="fieldFilters"
                  label="Field"
                  :model-value="filter.field"
                  @update:model-value="value => updateFilter(index, 'field', value)"
                />
              </v-col>
              <v-col cols="3">
                <v-select
                  density="compact"
                  hide-details
                  item-title="title"
                  item-value="value"
                  :items="getOperationOptions(filter.field)"
                  label="Operation"
                  :model-value="filter.operation"
                  @update:model-value="value => updateFilter(index, 'operation', value)"
                />
              </v-col>
              <v-col cols="5">
                <v-select
                  v-if="filter.operation === 'is'"
                  density="compact"
                  hide-details
                  item-title="title"
                  item-value="value"
                  :items="nullValueOptions"
                  label="Value"
                  :model-value="filter.value"
                  @update:model-value="value => updateFilter(index, 'value', value)"
                />
                <v-select
                  v-else-if="['in', 'cs', 'cd', 'ov'].includes(filter.operation)"
                  chips
                  closable-chips
                  density="compact"
                  hide-details
                  item-title="title"
                  item-value="value"
                  :items="getValueOptions(filter.field)"
                  label="Values"
                  :model-value="filter.value"
                  multiple
                  @update:model-value="value => updateFilter(index, 'value', value)"
                />
                <v-select
                  v-else-if="getFilterDefinition(filter.field)?.options?.length"
                  density="compact"
                  hide-details
                  item-title="title"
                  item-value="value"
                  :items="getValueOptions(filter.field)"
                  label="Value"
                  :model-value="filter.value"
                  @update:model-value="value => updateFilter(index, 'value', value)"
                />
                <v-select
                  v-else-if="isBooleanType(filter.field)"
                  density="compact"
                  hide-details
                  item-title="title"
                  item-value="value"
                  :items="getValueOptions(filter.field)"
                  label="Value"
                  :model-value="filter.value"
                  @update:model-value="value => updateFilter(index, 'value', value)"
                />
                <input-date
                  v-else-if="isDateType(filter.field)"
                  density="compact"
                  hide-details
                  label="Value"
                  :model-value="filter.value"
                  @update:model-value="value => updateFilter(index, 'value', value)"
                />
                <v-number-input
                  v-else-if="isNumberType(filter.field)"
                  density="compact"
                  hide-details
                  label="Value"
                  :model-value="filter.value"
                  @update:model-value="value => updateFilter(index, 'value', value)"
                />
                <v-text-field
                  v-else
                  density="compact"
                  hide-details
                  label="Value"
                  :model-value="filter.value"
                  @update:model-value="value => updateFilter(index, 'value', value)"
                />
              </v-col>
              <v-col
                align-self="center"
                cols="1"
              >
                <v-btn
                  color="error"
                  density="compact"
                  icon="mdi-close"
                  rounded
                  size="large"
                  variant="text"
                  @click="removeFilter(index)"
                />
              </v-col>
            </v-row>
          </v-list-item>
          <v-list-item class="pa-0">
            <v-row
              align="center"
              dense
            >
              <v-col cols="3">
                <v-select
                  v-model="newFilter.field"
                  density="compact"
                  hide-details
                  item-title="title"
                  item-value="value"
                  :items="fieldFilters"
                  label="Field"
                />
              </v-col>
              <v-col cols="3">
                <v-select
                  v-model="newFilter.operation"
                  density="compact"
                  :disabled="!newFilter.field"
                  hide-details
                  item-title="title"
                  item-value="value"
                  :items="getOperationOptions(newFilter.field)"
                  label="Operation"
                  @update:model-value="newFilter.value = null"
                />
              </v-col>
              <v-col cols="5">
                <v-select
                  v-if="newFilter.operation === 'is'"
                  v-model="newFilter.value"
                  density="compact"
                  hide-details
                  item-title="title"
                  item-value="value"
                  :items="nullValueOptions"
                  label="Value"
                  @update:model-value="addFilter"
                />
                <v-select
                  v-else-if="['in', 'cs', 'cd', 'ov'].includes(newFilter.operation)"
                  v-model="newFilter.value"
                  chips
                  closable-chips
                  density="compact"
                  :disabled="!newFilter.operation"
                  hide-details
                  item-title="title"
                  item-value="value"
                  :items="getValueOptions(newFilter.field)"
                  label="Values"
                  multiple
                  @update:model-value="addFilter"
                />
                <v-select
                  v-else-if="getFilterDefinition(newFilter.field)?.options?.length"
                  v-model="newFilter.value"
                  density="compact"
                  :disabled="!newFilter.operation"
                  hide-details
                  item-title="title"
                  item-value="value"
                  :items="getValueOptions(newFilter.field)"
                  label="Value"
                  @update:model-value="addFilter"
                />
                <v-select
                  v-else-if="isBooleanType(newFilter.field)"
                  v-model="newFilter.value"
                  density="compact"
                  :disabled="!newFilter.operation"
                  hide-details
                  item-title="title"
                  item-value="value"
                  :items="getValueOptions(newFilter.field)"
                  label="Value"
                  @update:model-value="addFilter"
                />
                <input-date
                  v-else-if="isDateType(newFilter.field)"
                  v-model="newFilter.value"
                  density="compact"
                  hide-details
                  label="Value"
                  @update:model-value="addFilter"
                />
                <v-number-input
                  v-else-if="isNumberType(newFilter.field)"
                  v-model="newFilter.value"
                  density="compact"
                  :disabled="!newFilter.operation"
                  hide-details
                  label="Value"
                  @blur="addFilter"
                  @keyup.enter="addFilter"
                />
                <v-text-field
                  v-else
                  v-model="newFilter.value"
                  density="compact"
                  :disabled="!newFilter.operation"
                  hide-details
                  label="Value"
                  @blur="addFilter"
                  @keyup.enter="addFilter"
                />
              </v-col>
            </v-row>
          </v-list-item>
        </v-list>
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-btn
          color="error"
          variant="text"
          @click="clearFilters"
        >
          Clear Filters
        </v-btn>
        <v-spacer />
        <v-btn
          color="disabled"
          variant="text"
          @click="internalValue = false"
        >
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          :disabled="totalActiveFilters === 0"
          variant="tonal"
          @click="applyFilters"
        >
          Apply {{ totalActiveFilters }} filter{{ totalActiveFilters > 1 ? 's' : '' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style lang="scss" scoped>
  .faded {
    opacity: 0.5;
    transition: opacity 0.2s ease;
  }
</style>
