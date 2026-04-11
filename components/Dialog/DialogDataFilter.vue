<script setup>
  import { encodeForQuery, decodeFromQuery } from '~/assets/js/url';

  const props = defineProps({
    title: {
      type: String,
      default: 'Filters'
    },
    filters: {
      type: Array,
      default: () => []
    },
    activeFilters: {
      type: Array,
      default: () => []
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
  const localFilters = ref([...props.activeFilters]);

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
      const param = route.query.filters;
      const filters = await decodeFromQuery(param);

      if (Array.isArray(filters) && filters.length > 0) {
        localFilters.value = filters;
        emit('apply', filters);
      }
    } catch (err) {
      console.error('Failed to decode filters from URL:', err);
    }
  };

  // Load filters from URL if syncWithUrl is enabled
  onMounted(() => loadFiltersFromUrl());

  const clearFiltersFromUrl = () => {
    if (!props.syncWithUrl) { return; }

    const query = { ...route.query };
    delete query.filters;
    router.replace({ query }, { shallow: true });
  };

  watch(() => props.activeFilters, (newVal) => {
    // Only update local filters if they're empty or the new value is not empty
    if (localFilters.value.length === 0 || newVal.length > 0) {
      localFilters.value = [...newVal];
    }
  }, { deep: true });

  const newFilter = ref({
    field: null,
    operation: null,
    value: null
  });

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
  const getFilterDefinition = (fieldValue) =>
    props.filters.find(filter => filter.value === fieldValue);

  const getOperationOptions = (fieldValue) => {
    if (!fieldValue) { return []; }

    const filterDef = getFilterDefinition(fieldValue);
    if (!filterDef) { return []; }

    const typeName = filterDef.type?.name || 'String';
    return filterOperations[typeName];
  };

  const getValueOptions = (fieldValue) => {
    const filterDef = getFilterDefinition(fieldValue);
    if (!filterDef) { return []; }

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
    if (!fieldValue) { return false; }
    const filterDef = getFilterDefinition(fieldValue);
    return filterDef?.type?.name === 'Date';
  };

  const isBooleanType = (fieldValue) => {
    if (!fieldValue) { return false; }
    const filterDef = getFilterDefinition(fieldValue);
    return filterDef?.type?.name === 'Boolean';
  };

  const isNumberType = (fieldValue) => {
    if (!fieldValue) { return false; }
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
    if (!newFilter.value.field || !newFilter.value.operation || !newFilter.value.value) {
      return;
    }

    // Don't duplicate filters for the same field and operation
    const existingIndex = localFilters.value.findIndex(f =>
      f.field === newFilter.value.field && f.operation === newFilter.value.operation);

    if (existingIndex !== -1) {
      localFilters.value.splice(existingIndex, 1, { ...newFilter.value });
    } else {
      localFilters.value.push({ ...newFilter.value });
    }

    resetNewFilter();
  };

  const removeFilter = (index) => {
    localFilters.value.splice(index, 1);
  };

  const updateFilter = (index, field, value) => {
    const updatedFilter = { ...localFilters.value[index] };
    updatedFilter[field] = value;

    // If operation is changed to 'in', initialize value as empty array if it's not already an array
    if (field === 'operation' && value === 'in' && !Array.isArray(updatedFilter.value)) {
      updatedFilter.value = [];
    }

    // If operation is changed from 'in' to something else, convert array to single value
    if (field === 'operation' && value !== 'in' && Array.isArray(updatedFilter.value)) {
      updatedFilter.value = updatedFilter.value.length > 0 ? updatedFilter.value[0] : null;
    }

    localFilters.value.splice(index, 1, updatedFilter);

    // If operation changed, reset value to null
    if (field === 'operation') {
      localFilters.value[index].value = null;
    }
  };

  const applyFilters = () => {
    const filters = [...localFilters.value].map(filter => {
      const filterDef = getFilterDefinition(filter.field);
      if (filterDef && filterDef.type?.name === 'Array' && !Array.isArray(filter.value)) {
        return {
          ...filter,
          value: [filter.value]
        };
      }
      return filter;
    });

    emit('apply', filters);
    internalValue.value = false;

    syncFiltersWithUrl(filters);
  };

  const clearFilters = () => {
    localFilters.value = [];
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
        <v-list>
          <v-list-item
            v-for="(filter, index) in localFilters"
            :key="index"
            class="pa-0"
            :class="{ 'faded': !activeIndexSet.has(index) && !hoveredIndexSet.has(index) }"
            @mouseenter="hoveredIndexSet.add(index)"
            @mouseleave="hoveredIndexSet.delete(index)"
          >
            <v-row
              align="center"
              dense
              @focusin="activeIndexSet.add(index)"
              @focusout="activeIndexSet.delete(index)"
            >
              <v-col cols="3">
                <v-select
                  density="compact"
                  hide-details
                  item-title="title"
                  item-value="value"
                  :items="filters"
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
                  :items="filters"
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
          text
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
          :disabled="localFilters.length === 0"
          text
          variant="tonal"
          @click="applyFilters"
        >
          Apply {{ localFilters.length }} filter{{ localFilters.length > 1 ? 's' : '' }}
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
