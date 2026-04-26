<script setup>
  const props = defineProps({
    titles: {
      type: Array,
      default: () => []
    },
    collection: {
      type: Object,
      default: null
    },
    loading: {
      type: Boolean,
      default: false
    }
  });

  const modelValue = defineModel({
    type: Boolean,
    default: false
  });

  const emit = defineEmits(['save']);

  const { App } = useORM();
  const { searchMany } = useSearchApps();

  const rows = ref([]);
  const isSearching = ref(false);
  const runToken = ref(0);
  const activeFilter = ref('all');
  const frozenRowOrder = ref([]);

  const isProcessedRow = (row) => {
    return ['matched', 'unmatched'].includes(row.status);
  };

  const isMatchedRow = (row) => {
    return Number(row.selectedAppId) > 0;
  };

  const totalTitles = computed(() => rows.value.length);

  const processedTitles = computed(() => {
    return rows.value.filter(isProcessedRow).length;
  });

  const progress = computed(() => {
    if (!totalTitles.value) {
      return 0;
    }

    const value = Math.round((processedTitles.value / totalTitles.value) * 100);
    return Math.max(0, Math.min(100, value));
  });

  const matchedCount = computed(() => {
    return rows.value.filter(isMatchedRow).length;
  });

  const unresolvedCount = computed(() => {
    return rows.value.filter(row => !isMatchedRow(row)).length;
  });

  const sameTitleDetections = computed(() => {
    return rows.value.filter(row => row.exactCollision).length;
  });

  const progressChips = computed(() => {
    return [
      {
        key: 'processed',
        color: 'primary',
        icon: 'mdi-progress-clock',
        value: processedTitles.value,
        label: `of ${totalTitles.value}`,
        visible: true
      },
      {
        key: 'matched',
        color: 'success',
        icon: 'mdi-check-circle-outline',
        value: matchedCount.value,
        label: 'matched',
        visible: true
      },
      {
        key: 'same-title',
        color: 'warning',
        icon: 'mdi-alert-circle-outline',
        value: sameTitleDetections.value,
        label: 'same title',
        visible: sameTitleDetections.value > 0
      },
      {
        key: 'unresolved',
        color: 'warning',
        icon: 'mdi-alert-outline',
        value: unresolvedCount.value,
        label: 'unresolved',
        visible: true
      }
    ];
  });

  const isBusy = computed(() => {
    return isSearching.value || props.loading;
  });

  const canSave = computed(() => {
    return rows.value.length > 0 && unresolvedCount.value === 0 && !isBusy.value;
  });

  const typeLabelsByValue = computed(() => {
    return Object.fromEntries(
      Object.entries(App.enums.type).map(([key, value]) => [value, App.labels[key] || key])
    );
  });

  const filteredRows = computed(() => {
    if (activeFilter.value === 'all') {
      return rows.value;
    }

    return rows.value.filter((row) => {
      if (activeFilter.value === 'processed') {
        return isProcessedRow(row);
      }

      if (activeFilter.value === 'matched') {
        return isMatchedRow(row);
      }

      if (activeFilter.value === 'same-title') {
        return row.exactCollision;
      }

      if (activeFilter.value === 'unresolved') {
        return !isMatchedRow(row);
      }

      return true;
    });
  });

  const sortRowsByMatch = (sourceRows) => {
    return sourceRows
      .slice()
      .sort((a, b) => {
        const aMatched = !!a.selectedOption;
        const bMatched = !!b.selectedOption;

        if (aMatched !== bMatched) {
          return aMatched ? 1 : -1;
        }

        if (!aMatched) {
          return a.title.localeCompare(b.title);
        }

        const confidenceDiff = Number(a.selectedOption?.confidence || 0) - Number(b.selectedOption?.confidence || 0);
        if (confidenceDiff !== 0) {
          return confidenceDiff;
        }

        return a.title.localeCompare(b.title);
      });
  };

  const sortedRows = computed(() => {
    if (!frozenRowOrder.value.length) {
      return sortRowsByMatch(filteredRows.value);
    }

    const orderMap = new Map(frozenRowOrder.value.map((rowId, index) => [rowId, index]));

    return filteredRows.value
      .slice()
      .sort((a, b) => {
        return (orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER);
      });
  });

  const toggleFilter = (filterKey) => {
    activeFilter.value = activeFilter.value === filterKey ? 'all' : filterKey;
  };

  const getTypeLabel = (type) => {
    return typeLabelsByValue.value[type] || App.labels.unknown || 'Unknown';
  };

  const sanitizeSearchTitle = (title) => {
    const originalTitle = `${title ?? ''}`.trim();
    const cleanedTitle = originalTitle
      .replace(/\[[^\]]*]/g, ' ')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\{[^}]*}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return cleanedTitle || originalTitle;
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 90) {
      return 'success';
    }

    if (confidence >= 60) {
      return 'info';
    }

    if (confidence >= 30) {
      return 'warning';
    }

    return 'error';
  };

  const resolveHeader = (appId, header) => {
    if (header) {
      return header;
    }

    if (Number(appId) > 0) {
      return `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
    }

    return '/applogo.svg';
  };

  const hasDuplicateExactTitleMatches = (title, results) => {
    const normalizedInput = `${title ?? ''}`.trim().toLowerCase();
    if (!normalizedInput) {
      return false;
    }

    const exactMatches = results.filter(result => {
      return (result?.item?.names || []).some(name => `${name ?? ''}`.trim().toLowerCase() === normalizedInput);
    });

    return exactMatches.length > 1;
  };

  const mapResultToOption = (result) => {
    const rawScore = Math.max(0, Math.min(1, Number(result?.score || 1)));
    const confidence = Math.round((1 - rawScore) * 1000) / 10;
    const appId = Number(result?.item?.appid || 0);
    const type = result?.item?.type || App.enums.type.unknown;

    return {
      title: result?.item?.names?.[0] || `App ${appId}`,
      value: appId,
      appid: appId,
      score: rawScore,
      confidence,
      confidenceColor: getConfidenceColor(confidence),
      header: resolveHeader(appId, result?.item?.header),
      type,
      typeLabel: getTypeLabel(type),
      subtitle: `Match: ${confidence}% | AppID: ${appId} | Type: ${getTypeLabel(type)}`
    };
  };

  const setSelectedOption = (row, option) => {
    row.selectedOption = option || null;
    row.selectedAppId = option?.value || null;
    row.status = option ? 'matched' : 'unmatched';
  };

  const pulseRow = (row, token) => {
    row.justMatched = true;
    setTimeout(() => {
      if (runToken.value === token) {
        row.justMatched = false;
      }
    }, 450);
  };

  const buildManualOption = async (appId) => {
    try {
      const instance = new App(`${appId}`);
      await instance.load();

      const type = instance.type || App.enums.type.unknown;
      return {
        title: instance.title || `App ${appId}`,
        value: appId,
        appid: appId,
        score: 0,
        confidence: 100,
        confidenceColor: getConfidenceColor(100),
        header: resolveHeader(appId, instance.header),
        type,
        typeLabel: getTypeLabel(type),
        subtitle: `Match: 100% | AppID: ${appId} | Type: ${getTypeLabel(type)}`
      };
    } catch (error) {
      console.error(error);

      return {
        title: `App ${appId}`,
        value: appId,
        appid: appId,
        score: 0,
        confidence: 100,
        confidenceColor: getConfidenceColor(100),
        header: resolveHeader(appId),
        type: App.enums.type.unknown,
        typeLabel: getTypeLabel(App.enums.type.unknown),
        subtitle: `Match: 100% | AppID: ${appId} | Type: ${getTypeLabel(App.enums.type.unknown)}`
      };
    }
  };

  const resetState = () => {
    rows.value = [];
    isSearching.value = false;
    activeFilter.value = 'all';
    frozenRowOrder.value = [];
  };

  const abortMatching = () => {
    runToken.value += 1;
    isSearching.value = false;
  };

  const startMatching = async () => {
    activeFilter.value = 'all';
    frozenRowOrder.value = [];

    const cleanTitles = props.titles
      .map(title => `${title ?? ''}`.trim())
      .filter(Boolean)
      .map((title, index) => ({
        id: `${index}-${title}`,
        title,
        status: 'pending',
        options: [],
        selectedOption: null,
        selectedAppId: null,
        exactCollision: false,
        justMatched: false,
        manualMode: false,
        manualEditing: false
      }));

    rows.value = cleanTitles;

    if (!cleanTitles.length) {
      isSearching.value = false;
      return;
    }

    const currentToken = runToken.value + 1;
    runToken.value = currentToken;
    isSearching.value = true;

    const batchSize = 20;

    try {
      for (let i = 0; i < cleanTitles.length; i += batchSize) {
        if (runToken.value !== currentToken || !modelValue.value) {
          return;
        }

        const batchRows = rows.value.slice(i, i + batchSize);
        batchRows.forEach(row => {
          row.status = 'matching';
        });

        const batchResults = await searchMany(batchRows.map(row => sanitizeSearchTitle(row.title)), 12);

        if (runToken.value !== currentToken || !modelValue.value) {
          return;
        }

        batchRows.forEach((row, index) => {
          const mappedResults = batchResults[index]?.results || [];
          row.options = mappedResults.map(mapResultToOption);
          row.exactCollision = hasDuplicateExactTitleMatches(row.title, mappedResults);
          row.manualMode = row.options.length === 0;
          row.manualEditing = row.manualMode;

          const firstOption = row.options[0] || null;
          setSelectedOption(row, firstOption);

          if (firstOption) {
            pulseRow(row, currentToken);
          }
        });
      }
    } finally {
      if (runToken.value === currentToken) {
        isSearching.value = false;
        frozenRowOrder.value = sortRowsByMatch(rows.value).map(row => row.id);
      }
    }
  };

  const onSelectOption = (row, appId) => {
    const option = row.options.find(entry => Number(entry.value) === Number(appId)) || null;
    setSelectedOption(row, option);

    if (option) {
      pulseRow(row, runToken.value);
    }
  };

  const onManualAppSelected = async (row, appId) => {
    const normalized = Number(appId);
    if (!Number.isInteger(normalized) || normalized <= 0) {
      setSelectedOption(row, null);
      row.manualEditing = true;
      return;
    }

    const option = await buildManualOption(normalized);
    const existingIndex = row.options.findIndex(entry => Number(entry.value) === normalized);

    if (existingIndex >= 0) {
      row.options.splice(existingIndex, 1, option);
    } else {
      row.options.unshift(option);
    }

    row.manualMode = true;
    row.manualEditing = false;
    setSelectedOption(row, option);
    pulseRow(row, runToken.value);
  };

  const editManualMatch = (row) => {
    row.manualEditing = true;
    setSelectedOption(row, null);
  };

  const isManualMatched = (row) => {
    return row.manualMode && !!row.selectedOption && !row.manualEditing;
  };

  const rowActionColor = (row) => {
    return isManualMatched(row) ? 'primary' : 'error';
  };

  const rowActionIcon = (row) => {
    return isManualMatched(row) ? 'mdi-pencil' : 'mdi-close';
  };

  const rowActionTooltip = (row) => {
    return isManualMatched(row) ? 'Edit manual match' : 'Remove from list';
  };

  const removeRow = (rowId) => {
    rows.value = rows.value.filter(row => row.id !== rowId);
    frozenRowOrder.value = frozenRowOrder.value.filter(id => id !== rowId);
  };

  const onRowAction = (row) => {
    if (isManualMatched(row)) {
      editManualMatch(row);
      return;
    }

    removeRow(row.id);
  };

  const closeDialog = () => {
    abortMatching();
    modelValue.value = false;
  };

  const saveMatches = () => {
    const appIds = rows.value
      .map(row => Number(row.selectedAppId))
      .filter(appId => Number.isInteger(appId) && appId > 0);

    emit('save', appIds);
  };

  watch(modelValue, (isOpen) => {
    if (isOpen) {
      startMatching();
      return;
    }

    abortMatching();
    resetState();
  });

  watch(() => props.titles, (titles, previousTitles) => {
    if (modelValue.value && titles !== previousTitles) {
      startMatching();
    }
  });
</script>

<template>
  <v-dialog
    v-model="modelValue"
    max-width="980"
    :persistent="isBusy"
    scrollable
  >
    <v-card>
      <v-card-title class="px-6 pt-5 pb-2">
        <div class="d-flex flex-column flex-md-row align-md-end align-start justify-space-between ga-2 w-100">
          <div>
            <div class="text-overline">
              Step 2 of 2
            </div>
            <div class="text-h6 font-weight-bold">
              Match App Titles
            </div>
            <div class="text-caption text-medium-emphasis">
              Connect each title to the correct Steam app.
            </div>
          </div>
          <div class="d-flex align-center ga-2 flex-wrap">
            <v-chip
              v-for="chip in progressChips.filter(entry => entry.visible)"
              :key="`${chip.key}-${chip.value}-${chip.label}`"
              class="stats-chip"
              :class="{ 'stats-chip-active': activeFilter === chip.key }"
              :color="chip.color"
              :prepend-icon="chip.icon"
              size="small"
              :variant="activeFilter === chip.key ? 'flat' : 'tonal'"
              @click="toggleFilter(chip.key)"
            >
              <strong>{{ chip.value }}</strong>
              <span class="ml-1">{{ chip.label }}</span>
            </v-chip>
          </div>
        </div>
      </v-card-title>

      <v-card-text class="px-6 pt-1 pb-3">
        <v-progress-linear
          color="primary"
          height="8"
          :indeterminate="isSearching && processedTitles === 0"
          :model-value="progress"
          rounded
          stream
        />
      </v-card-text>

      <v-divider />

      <v-card-text class="pa-0">
        <div
          v-if="!rows.length && !isSearching"
          class="text-center py-10 text-medium-emphasis"
        >
          No titles to match.
        </div>

        <div
          v-else-if="!sortedRows.length"
          class="text-center py-10 text-medium-emphasis"
        >
          No titles match this filter.
        </div>

        <v-virtual-scroll
          v-else
          class="match-list"
          height="62vh"
          :item-height="132"
          :items="sortedRows"
        >
          <template #default="{ item }">
            <div
              class="match-row-item px-4 py-2"
              :class="{ 'match-row-item-just-matched': item.justMatched }"
            >
              <v-row
                class="align-center"
                no-gutters
              >
                <v-col
                  class="py-1 pr-md-3"
                  cols="12"
                  md="5"
                >
                  <div class="d-flex align-start ga-3 mb-md-0 mb-2">
                    <v-img
                      class="rounded flex-grow-0"
                      cover
                      height="50"
                      lazy-src="/applogo.svg"
                      :src="resolveHeader(item.selectedAppId, item.selectedOption?.header)"
                      width="100"
                    />

                    <div class="min-w-0 flex-grow-1">
                      <v-btn
                        v-if="!$vuetify.display.mdAndUp"
                        v-tooltip:top="rowActionTooltip(item)"
                        class="rounded float-right mt-n1"
                        :color="rowActionColor(item)"
                        density="compact"
                        :icon="rowActionIcon(item)"
                        size="large"
                        variant="text"
                        @click="onRowAction(item)"
                      />

                      <div
                        class="user-input text-body-2 font-weight-medium"
                        :title="item.title"
                      >
                        <v-chip
                          v-if="item.exactCollision"
                          class="mr-1 mt-n1"
                          color="warning"
                          size="x-small"
                          variant="tonal"
                        >
                          <v-icon
                            color="warning"
                            icon="mdi-alert-circle-outline"
                            start
                          />
                          Same title
                        </v-chip>

                        <v-chip
                          v-if="!item.selectedOption"
                          class="mr-1 mt-n1"
                          color="warning"
                          size="x-small"
                          variant="tonal"
                        >
                          <v-icon
                            color="warning"
                            icon="mdi-alert-circle-outline"
                            start
                          />
                          No match
                        </v-chip>

                        <v-chip
                          v-if="isManualMatched(item)"
                          class="mr-1 mt-n1"
                          color="info"
                          size="x-small"
                          variant="tonal"
                        >
                          <v-icon
                            color="info"
                            icon="mdi-pencil-circle-outline"
                            start
                          />
                          Manual
                        </v-chip>

                        <v-icon
                          icon="mdi-format-quote-open"
                          size="x-small"
                        />
                        {{ item.title }}
                        <v-icon
                          icon="mdi-format-quote-close"
                          size="x-small"
                        />
                      </div>

                      <div
                        v-if="item.status === 'matching'"
                        class="text-caption text-medium-emphasis text-wrap"
                      >
                        Matching...
                      </div>

                      <div
                        v-else-if="item.selectedOption"
                        class="text-caption text-medium-emphasis text-wrap"
                      >
                        Matched <strong>{{ item.selectedOption.title }}</strong> with <strong :class="`text-${item.selectedOption.confidenceColor}`">{{ item.selectedOption.confidence }}%</strong> confidence
                      </div>

                      <div
                        v-else
                        class="text-caption text-medium-emphasis text-wrap"
                      >
                        No automatic match found. Search manually.
                      </div>
                    </div>
                  </div>
                </v-col>

                <v-col
                  v-if="!isManualMatched(item) || $vuetify.display.mdAndUp"
                  class="py-1"
                  cols="12"
                  md="7"
                >
                  <div class="d-flex align-start align-md-center ga-2 row-controls">
                    <template v-if="item.manualMode">
                      <input-app-search
                        v-if="item.manualEditing"
                        v-model="item.selectedAppId"
                        class="flex-grow-1 row-control-input"
                        density="compact"
                        hide-details="auto"
                        label="Search app manually"
                        variant="outlined"
                        @update:model-value="onManualAppSelected(item, $event)"
                      />

                      <div
                        v-else
                        class="row-control-placeholder flex-grow-1"
                      />
                    </template>

                    <v-select
                      v-else
                      v-model="item.selectedAppId"
                      class="flex-grow-1 match-select row-control-input"
                      density="compact"
                      hide-details
                      item-title="title"
                      item-value="value"
                      :items="item.options"
                      label="Select match"
                      :menu-props="{ maxHeight: 460 }"
                      variant="outlined"
                      @update:model-value="onSelectOption(item, $event)"
                    >
                      <template #item="{ item: optionItem, props: itemProps }">
                        <v-list-item v-bind="itemProps">
                          <template #prepend>
                            <v-img
                              class="rounded mr-4"
                              cover
                              height="50"
                              lazy-src="/applogo.svg"
                              :src="optionItem.raw.header"
                              width="100"
                            />
                          </template>

                          <template #title>
                            <v-list-item-title>
                              {{ optionItem.raw.title }}
                            </v-list-item-title>
                          </template>

                          <template #subtitle>
                            <div class="d-flex align-center ga-1 flex-wrap">
                              <v-chip
                                :color="optionItem.raw.confidenceColor"
                                size="x-small"
                                variant="tonal"
                              >
                                {{ optionItem.raw.confidence }}%
                              </v-chip>

                              <v-chip
                                size="x-small"
                                variant="tonal"
                              >
                                {{ optionItem.raw.appid }}
                              </v-chip>

                              <v-chip
                                size="x-small"
                                variant="tonal"
                              >
                                {{ optionItem.raw.typeLabel }}
                              </v-chip>
                            </div>
                          </template>
                        </v-list-item>
                      </template>

                      <template #selection="{ item: optionItem }">
                        <span class="match-selection-text">
                          {{ optionItem.raw.title }} - {{ optionItem.raw.subtitle }}
                        </span>
                      </template>
                    </v-select>

                    <v-btn
                      v-if="$vuetify.display.mdAndUp"
                      v-tooltip:top="rowActionTooltip(item)"
                      class="rounded"
                      :color="rowActionColor(item)"
                      density="compact"
                      :icon="rowActionIcon(item)"
                      size="large"
                      variant="text"
                      @click="onRowAction(item)"
                    />
                  </div>
                </v-col>
              </v-row>
            </div>
          </template>
        </v-virtual-scroll>
      </v-card-text>

      <v-divider />

      <v-card-actions class="px-6 pb-5 pt-3">
        <v-btn
          :disabled="props.loading"
          variant="text"
          @click="closeDialog"
        >
          {{ isSearching ? 'Abort' : 'Close' }}
        </v-btn>

        <v-spacer />

        <v-btn
          color="primary"
          :disabled="!canSave"
          :loading="props.loading"
          variant="tonal"
          @click="saveMatches"
        >
          Save Apps
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style lang="scss" scoped>
  .match-list {
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.06);
  }

  .match-row-item {
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.09);
  }

  .match-row-item-just-matched {
    animation: row-match-flash 0.45s ease;
  }

  .user-input {
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .stats-chip {
    animation: chip-pulse 0.32s ease;
    cursor: pointer;
  }

  .stats-chip-active {
    outline: 1px solid rgba(var(--v-theme-on-surface), 0.16);
  }

  .match-select {
    min-width: 250px;
  }

  .row-controls {
    width: 100%;
  }

  .row-control-input {
    width: 100%;
  }

  .row-control-placeholder {
    min-height: 40px;
  }

  @media (max-width: 959px) {
    .row-controls {
      align-items: flex-start;
    }
  }

  .match-selection-text {
    display: block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .match-select :deep(.v-field__input) {
    min-height: 34px;
  }

  @keyframes row-match-flash {
    0% {
      background-color: rgba(var(--v-theme-success), 0);
    }

    50% {
      background-color: rgba(var(--v-theme-success), 0.1);
    }

    100% {
      background-color: rgba(var(--v-theme-success), 0);
    }
  }

  @keyframes chip-pulse {
    0% {
      transform: scale(1);
    }

    50% {
      transform: scale(1.02);
    }

    100% {
      transform: scale(1);
    }
  }
</style>
