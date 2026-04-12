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
  const matchedPulse = ref(false);

  const scoreToPercent = (score) => {
    return Math.round((1 - score) * 1000) / 10;
  };

  const totalTitles = computed(() => rows.value.length);

  const processedTitles = computed(() => {
    return rows.value.filter(row => ['matched', 'unmatched'].includes(row.status)).length;
  });

  const progress = computed(() => {
    if (!totalTitles.value) {
      return 0;
    }

    const value = Math.round((processedTitles.value / totalTitles.value) * 100);
    return Math.max(0, Math.min(100, value));
  });

  const matchedCount = computed(() => {
    return rows.value.filter(row => Number(row.selectedAppId) > 0).length;
  });

  const unresolvedCount = computed(() => {
    return rows.value.filter(row => !Number(row.selectedAppId)).length;
  });

  const sameTitleDetections = computed(() => {
    return rows.value.filter(row => row.exactCollision).length;
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

  const sortedRows = computed(() => {
    return rows.value
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
  });

  const getTypeLabel = (type) => {
    return typeLabelsByValue.value[type] || App.labels.unknown || 'Unknown';
  };

  const normalizeTitle = (value) => {
    return `${value ?? ''}`.trim().toLowerCase();
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 85) {
      return 'success';
    }

    if (confidence >= 65) {
      return 'info';
    }

    if (confidence >= 45) {
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
    const normalizedInput = normalizeTitle(title);
    if (!normalizedInput) {
      return false;
    }

    const exactMatches = results.filter(result => {
      return (result?.item?.names || []).some(name => normalizeTitle(name) === normalizedInput);
    });

    return exactMatches.length > 1;
  };

  const mapResultToOption = (result) => {
    const rawScore = Math.max(0, Math.min(1, Number(result?.score || 1)));
    const confidence = scoreToPercent(rawScore);
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

  const getSelectedOption = (row) => {
    if (row.selectedOption) {
      return row.selectedOption;
    }

    return row.options.find(option => Number(option.value) === Number(row.selectedAppId)) || null;
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
  };

  const abortMatching = () => {
    runToken.value += 1;
    isSearching.value = false;
  };

  const startMatching = async () => {
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

        const batchResults = await searchMany(batchRows.map(row => row.title), 12);

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

  const removeRow = (rowId) => {
    rows.value = rows.value.filter(row => row.id !== rowId);
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

  watch(matchedCount, (count, previous = 0) => {
    if (count > previous) {
      matchedPulse.value = true;
      setTimeout(() => {
        matchedPulse.value = false;
      }, 300);
    }
  });

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
    <v-card class="dialog-match-shell">
      <v-card-title class="px-6 pt-5 pb-2">
        <div class="d-flex flex-column flex-md-row align-md-center justify-space-between ga-2 w-100">
          <div>
            <div class="text-overline">Step 2 of 2</div>
            <div class="text-h6 font-weight-bold">Match App Titles</div>
            <div class="text-caption text-medium-emphasis">
              {{ collection?.title ? `Collection: ${collection.title}` : 'Connect each title to the correct Steam app.' }}
            </div>
          </div>
          <div class="d-flex align-center ga-2 flex-wrap justify-end">
            <v-chip
              color="primary"
              prepend-icon="mdi-progress-clock"
              size="small"
              variant="tonal"
            >
              {{ processedTitles }} / {{ totalTitles }}
            </v-chip>

            <v-chip
              :class="{ 'stats-chip-pulse': matchedPulse }"
              color="success"
              prepend-icon="mdi-check-decagram"
              size="small"
              variant="tonal"
            >
              {{ matchedCount }} matched
            </v-chip>

            <v-chip
              v-if="sameTitleDetections > 0"
              color="warning"
              prepend-icon="mdi-alert-circle-outline"
              size="small"
              variant="tonal"
            >
              {{ sameTitleDetections }} same-title
            </v-chip>

            <v-chip
              color="warning"
              prepend-icon="mdi-alert-outline"
              size="small"
              variant="tonal"
            >
              {{ unresolvedCount }} unresolved
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

        <v-virtual-scroll
          v-else
          class="match-list"
          height="62vh"
          :item-height="112"
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
                  <div class="d-flex align-center ga-3 min-w-0">
                    <v-img
                      class="match-header-image rounded"
                      cover
                      height="54"
                      :src="item.selectedOption?.header || resolveHeader(item.selectedAppId)"
                      width="96"
                    />

                    <div class="min-w-0 flex-grow-1">
                      <div
                        class="user-input text-body-2 font-weight-medium text-truncate"
                        :title="item.title"
                      >
                        "{{ item.title }}"
                      </div>

                      <div
                        v-if="item.status === 'matching'"
                        class="text-caption text-medium-emphasis text-truncate"
                      >
                        Matching...
                      </div>

                      <div
                        v-else-if="item.selectedOption"
                        class="text-caption text-medium-emphasis text-truncate"
                      >
                        Matched <strong>{{ item.selectedOption.title }}</strong> with {{ item.selectedOption.confidence }}% <strong>confidence</strong>
                      </div>

                      <div
                        v-else
                        class="text-caption text-medium-emphasis text-truncate"
                      >
                        No automatic match found. Search manually.
                      </div>
                    </div>

                    <div class="d-flex align-center ga-1">
                      <v-chip
                        v-if="item.exactCollision"
                        color="warning"
                        size="x-small"
                        variant="tonal"
                      >
                        Same title
                      </v-chip>

                      <v-btn
                        color="error"
                        density="compact"
                        icon="mdi-close"
                        size="x-small"
                        variant="text"
                        @click="removeRow(item.id)"
                      />
                    </div>
                  </div>
                </v-col>

                <v-col
                  class="py-1"
                  cols="12"
                  md="7"
                >
                  <template v-if="item.manualMode">
                    <div
                      v-if="item.manualEditing"
                      class="d-flex align-center ga-2"
                    >
                      <input-app-search
                        v-model="item.selectedAppId"
                        class="flex-grow-1"
                        density="compact"
                        hide-details="auto"
                        label="Search app manually"
                        variant="outlined"
                        @update:model-value="onManualAppSelected(item, $event)"
                      />

                      <v-chip
                        color="warning"
                        size="small"
                        variant="tonal"
                      >
                        No match
                      </v-chip>
                    </div>

                    <div
                      v-else
                      class="d-flex align-center justify-end ga-2"
                    >
                      <v-chip
                        color="success"
                        size="small"
                        variant="tonal"
                      >
                        100%
                      </v-chip>

                      <v-btn
                        color="primary"
                        density="compact"
                        icon="mdi-pencil"
                        size="small"
                        variant="tonal"
                        @click="editManualMatch(item)"
                      />
                    </div>
                  </template>

                  <template v-else>
                    <div class="d-flex align-center ga-2">
                      <v-select
                        v-model="item.selectedAppId"
                        class="flex-grow-1 match-select"
                        density="compact"
                        hide-details
                        :items="item.options"
                        item-title="title"
                        item-value="value"
                        label="Select match"
                        :menu-props="{ maxHeight: 460 }"
                        variant="outlined"
                        @update:model-value="onSelectOption(item, $event)"
                      >
                        <template #item="{ item: optionItem, props: itemProps }">
                          <v-list-item v-bind="itemProps">
                            <template #prepend>
                              <v-img
                                class="mr-3 rounded"
                                cover
                                height="54"
                                :src="optionItem.raw.header"
                                width="96"
                              />
                            </template>

                            <v-list-item-title>{{ optionItem.raw.title }}</v-list-item-title>
                            <v-list-item-subtitle>{{ optionItem.raw.subtitle }}</v-list-item-subtitle>

                            <template #append>
                              <div class="d-flex ga-1">
                                <v-chip
                                  size="x-small"
                                  variant="tonal"
                                >
                                  {{ optionItem.raw.typeLabel }}
                                </v-chip>

                                <v-chip
                                  :color="optionItem.raw.confidenceColor"
                                  size="x-small"
                                  variant="tonal"
                                >
                                  {{ optionItem.raw.confidence }}%
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

                      <v-chip
                        :color="getSelectedOption(item)?.confidenceColor || 'default'"
                        size="small"
                        variant="tonal"
                      >
                        {{ getSelectedOption(item)?.confidence || 0 }}%
                      </v-chip>
                    </div>
                  </template>
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
  .dialog-match-shell {
    background: rgb(var(--v-theme-surface));
  }

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
    max-width: 100%;
  }

  .match-header-image {
    flex-shrink: 0;
  }

  .stats-chip-pulse {
    animation: chip-pulse 0.3s ease;
  }

  .match-select {
    min-width: 250px;
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
      transform: scale(1.03);
    }

    100% {
      transform: scale(1);
    }
  }
</style>
