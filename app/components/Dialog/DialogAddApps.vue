<script setup>
  import { FunctionsHttpError } from '@supabase/supabase-js';
  import jsonata from 'jsonata';

  const props = defineProps({
    collection: {
      type: Object,
      default: null
    }
  });

  const emit = defineEmits(['submit']);

  const { Collection } = useORM();
  const snackbarStore = useSnackbarStore();
  const supabase = useSupabaseClient();

  const internalValue = ref(false);
  const matchingDialogOpen = ref(false);
  const matchingTitles = ref([]);

  const inputText = ref('');
  const isLoading = ref(false);
  const preview = ref([]);
  const previewCount = 10;
  const validationError = ref('');

  const selectedValueType = ref('title');
  const valueTypes = [
    { title: 'AppIDs', value: 'appid', icon: 'mdi-pound' },
    { title: 'App titles', value: 'title', icon: 'mdi-format-title' }
  ];

  const selectedInputType = ref('text');
  const inputTypes = [
    { title: 'Text', value: 'text', icon: 'mdi-text-box-edit-outline' },
    { title: 'JSON', value: 'json', icon: 'mdi-code-json' }
  ];

  const isAppIdMode = computed(() => selectedValueType.value === 'appid');
  const stepOverline = computed(() => isAppIdMode.value ? '' : 'Step 1 of 2');
  const dialogTitle = computed(() => isAppIdMode.value ? 'Add Apps by AppID' : 'Parse App Titles');
  const dialogSubtitle = computed(() => {
    return isAppIdMode.value
      ? 'Import from text or JSON and save directly to the collection.'
      : 'Import from text or JSON, then continue to title matching.';
  });

  const showDelimiterOption = ref(false);
  const delimiter = ref(',');

  const jsonIsValid = ref(true);
  const jsonataQuery = ref('');
  const jsonataError = ref('');

  const formatPreviewItem = (item) => {
    if (item === null || item === undefined) {
      return '';
    }

    if (typeof item === 'string') {
      return item;
    }

    if (typeof item === 'number' || typeof item === 'boolean') {
      return `${item}`;
    }

    try {
      return JSON.stringify(item);
    } catch {
      return `${item}`;
    }
  };

  const toTextItems = (items) => {
    return items
      .map(item => `${item ?? ''}`.trim())
      .filter(Boolean);
  };

  const dedupeAppIds = (appIds) => {
    return [...new Set(
      appIds
        .map(appId => Number(appId))
        .filter(appId => Number.isInteger(appId) && appId > 0)
    )];
  };

  const processTextInput = (text) => {
    const lines = text
      .trim()
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    if (lines.length <= 1) {
      showDelimiterOption.value = true;
      const separator = delimiter.value || ',';
      return (lines[0] || '').split(separator).map(item => item.trim())
        .filter(Boolean);
    }

    showDelimiterOption.value = false;
    return lines;
  };

  const processJsonInput = async (text, query) => {
    try {
      const jsonData = JSON.parse(text);
      jsonIsValid.value = true;

      if (!query.trim()) {
        return Array.isArray(jsonData) ? jsonData : [jsonData];
      }

      try {
        const expression = jsonata(query);
        const result = await expression.evaluate(jsonData);
        jsonataError.value = '';

        if (Array.isArray(result)) {
          return result;
        }

        if (result !== undefined) {
          return [result];
        }

        return [];
      } catch (error) {
        jsonataError.value = error.message;
        return [];
      }
    } catch {
      jsonIsValid.value = false;
      return [];
    }
  };

  const processInput = async () => {
    if (!inputText.value.trim()) {
      return [];
    }

    try {
      if (selectedInputType.value === 'text') {
        return processTextInput(inputText.value);
      }

      if (selectedInputType.value === 'json') {
        return await processJsonInput(inputText.value, jsonataQuery.value);
      }
    } catch (error) {
      console.error(error);
    }

    return [];
  };

  const validateAppIds = (items) => {
    const normalized = items.map(item => Number(`${item}`.trim()));
    const validAppIds = normalized.filter(appId => Number.isInteger(appId) && appId > 0);

    if (validAppIds.length !== items.length) {
      validationError.value = 'Not all items are valid App IDs (positive integers).';
    }

    return validAppIds;
  };

  const updatePreview = async () => {
    preview.value = [];
    validationError.value = '';

    const items = await processInput();

    if (selectedValueType.value === 'appid' && items.length > 0) {
      validateAppIds(items);
    }

    preview.value = items
      .slice(0, previewCount)
      .map(formatPreviewItem)
      .filter(Boolean);
  };

  const resetForm = () => {
    inputText.value = '';
    showDelimiterOption.value = false;
    jsonIsValid.value = true;
    jsonataQuery.value = '';
    jsonataError.value = '';
    validationError.value = '';
    preview.value = [];
    matchingTitles.value = [];
  };

  const saveAppsToCollection = async (appIds) => {
    const finalAppIds = dedupeAppIds(appIds);
    if (!finalAppIds.length) {
      validationError.value = 'No valid App IDs to add.';
      return;
    }

    isLoading.value = true;
    validationError.value = '';

    try {
      if (!props.collection) {
        throw new Error('Collection is required');
      }

      let instance = new Collection(props.collection.id);
      Object.assign(instance, props.collection);

      const isNew = !!instance.isNew;
      if (isNew) {
        instance = await instance.save();
      }

      await instance.addApps(finalAppIds);

      if (isNew) {
        snackbarStore.set('success', 'Collection created');
        await navigateTo(`/collection/${instance.id}/edit`);
      } else {
        emit('submit', finalAppIds);
      }

      matchingDialogOpen.value = false;
      internalValue.value = false;
      resetForm();
    } catch (error) {
      console.error(error);
      const message = error?.message || 'Failed to add apps';
      validationError.value = `Error: ${message}`;
      snackbarStore.set('error', message);
    } finally {
      isLoading.value = false;
    }
  };

  const submitParsedInput = async () => {
    validationError.value = '';

    const inputItems = await processInput();
    if (!inputItems.length) {
      validationError.value = 'No items found to import.';
      return;
    }

    if (selectedValueType.value === 'appid') {
      const appIds = validateAppIds(inputItems);
      if (validationError.value) {
        return;
      }

      await saveAppsToCollection(appIds);
      return;
    }

    matchingTitles.value = toTextItems(inputItems);
    if (!matchingTitles.value.length) {
      validationError.value = 'No valid titles found to match.';
      return;
    }

    internalValue.value = false;
    matchingDialogOpen.value = true;
  };

  const submitMatchedApps = async (appIds) => {
    await saveAppsToCollection(appIds);
  };

  watch([inputText, selectedInputType, selectedValueType, delimiter, jsonataQuery], () => {
    updatePreview();
  }, { immediate: true });

  const presets = ref([
    {
      title: 'Barter.vg',
      loading: false,
      load: async (preset) => {
        if (preset.loading) {
          return;
        }

        preset.loading = true;
        try {
          const { data, error } = await supabase.functions.invoke('thirdparty-import', {
            body: { source: 'bartervg' }
          });

          if (error) {
            throw error;
          }

          const appIds = dedupeAppIds(data?.appids || []);
          if (!appIds.length) {
            snackbarStore.set('error', 'No items found in your Barter.vg tradable collection');
            return;
          }

          inputText.value = appIds.join('\n');
          selectedInputType.value = 'text';
          selectedValueType.value = 'appid';
          delimiter.value = '\n';
          await updatePreview();
          snackbarStore.set('success', 'Barter.vg items loaded successfully');
        } catch (error) {
          console.error(error);
          if (error instanceof FunctionsHttpError) {
            const message = await error.context.json();
            snackbarStore.set('error', message.error || message);
          } else {
            snackbarStore.set('error', 'An unknown error occurred while importing Barter.vg items');
          }
        } finally {
          preset.loading = false;
        }
      }
    },
    {
      title: 'Steam Inventory',
      loading: false,
      load: async (preset) => {
        if (preset.loading) {
          return;
        }

        preset.loading = true;
        try {
          const { data, error } = await supabase.functions.invoke('thirdparty-import', {
            body: { source: 'steam-inventory' }
          });

          if (error) {
            throw error;
          }

          const appIds = dedupeAppIds(data?.appids || []);
          const queries = [...new Set((data?.queries || []).map(query => `${query ?? ''}`.trim()).filter(Boolean))];

          if (!appIds.length && !queries.length) {
            snackbarStore.set('error', 'No items found in your Steam Inventory');
            return;
          }

          selectedInputType.value = 'text';
          delimiter.value = '\n';

          if (appIds.length > 0) {
            inputText.value = appIds.join('\n');
            selectedValueType.value = 'appid';

            if (queries.length > 0) {
              snackbarStore.set('info', 'Loaded App IDs from Steam Inventory. Import titles separately if needed.');
            }
          } else {
            inputText.value = queries.join('\n');
            selectedValueType.value = 'title';
          }

          await updatePreview();
          snackbarStore.set('success', 'Steam Inventory items loaded successfully');
        } catch (error) {
          console.error(error);
          if (error instanceof FunctionsHttpError) {
            const message = await error.context.json();
            snackbarStore.set('error', message.error || message);
          } else {
            snackbarStore.set('error', 'An unknown error occurred while importing Steam Inventory');
          }
        } finally {
          preset.loading = false;
        }
      }
    },
    {
      title: 'Steamtrades',
      loading: false,
      load: async (preset) => {
        if (preset.loading) {
          return;
        }

        preset.loading = true;
        try {
          const { data, error } = await supabase.functions.invoke('thirdparty-import', {
            body: { source: 'steamtrades' }
          });

          if (error) {
            throw error;
          }

          if (!Array.isArray(data) || data.length === 0) {
            snackbarStore.set('error', 'No trade topics found in SteamTrades');
            return;
          }

          const appIds = dedupeAppIds(data.flatMap(topic => topic?.appids || []));
          const queries = [...new Set(data.flatMap(topic => topic?.queries || []).map(query => `${query ?? ''}`.trim())
            .filter(Boolean))];

          if (!appIds.length && !queries.length) {
            snackbarStore.set('error', 'No importable items found in SteamTrades topics');
            return;
          }

          selectedInputType.value = 'text';
          delimiter.value = '\n';

          if (appIds.length > 0) {
            inputText.value = appIds.join('\n');
            selectedValueType.value = 'appid';

            if (queries.length > 0) {
              snackbarStore.set('info', 'Loaded App IDs from SteamTrades. Import titles separately if needed.');
            }
          } else {
            inputText.value = queries.join('\n');
            selectedValueType.value = 'title';
          }

          await updatePreview();
          snackbarStore.set('success', 'SteamTrades topics loaded successfully');
        } catch (error) {
          console.error(error);
          if (error instanceof FunctionsHttpError) {
            const message = await error.context.json();
            snackbarStore.set('error', message.error || message);
          } else {
            snackbarStore.set('error', 'An unknown error occurred while importing SteamTrades topics');
          }
        } finally {
          preset.loading = false;
        }
      }
    },
    {
      title: 'Steam Dynamic Store',
      loading: false,
      load: async () => {
        selectedInputType.value = 'json';
        selectedValueType.value = 'appid';
        inputText.value = 'Copy and paste content from https://store.steampowered.com/dynamicstore/userdata/ here';
        jsonataQuery.value = 'Pick one: rgWishlist, rgOwnedApps, rgFollowedApps, rgAppsInCart, $keys(rgIgnoredApps)';
        await updatePreview();
      }
    },
    {
      title: 'Lestrade\'s',
      loading: false,
      load: async () => {
        selectedInputType.value = 'text';
        selectedValueType.value = 'title';
        inputText.value = 'Export from https://lestrades.com/tradables/?export=&steamonly=on&nothing=on and paste here';
        await updatePreview();
      }
    }
  ]);
</script>

<template>
  <v-dialog
    v-model="internalValue"
    :persistent="isLoading"
    width="760"
  >
    <template #activator="attrs">
      <slot
        name="activator"
        v-bind="attrs"
      />
    </template>

    <template #default>
      <v-card
        class="dialog-add-shell"
        :loading="isLoading"
      >
        <v-card-title class="px-6 pt-6 pb-2">
          <div class="d-flex flex-column">
            <span class="text-overline">{{ stepOverline }}</span>
            <span class="text-h5 font-weight-bold">{{ dialogTitle }}</span>
            <span class="text-caption text-medium-emphasis">{{ dialogSubtitle }}</span>
          </div>
        </v-card-title>

        <v-card-text class="px-6 pb-4 add-apps-body">
          <v-row>
            <v-col
              class="d-flex align-center"
              cols="12"
            >
              <span class="flex-grow-0 text-no-wrap mr-2">
                <v-icon
                  class="mr-1 mt-n1"
                  icon="mdi-tune"
                />
                Presets:
              </span>
              <v-chip-group
                class="presets flex-grow-1"
                show-arrows
              >
                <v-chip
                  v-for="preset in presets"
                  :key="preset.title"
                  class="preset-chip"
                  :disabled="preset.loading"
                  :prepend-icon="preset.loading ? 'mdi-loading mdi-spin' : undefined"
                  :text="preset.title"
                  variant="tonal"
                  @click="preset.load(preset)"
                />
              </v-chip-group>
            </v-col>
          </v-row>

          <v-divider class="my-4" />

          <v-row>
            <v-col
              cols="12"
              md="6"
            >
              <v-sheet
                class="option-panel pa-3"
                rounded="lg"
              >
                <div class="text-caption mb-1">
                  Match type
                </div>
                <v-radio-group
                  v-model="selectedValueType"
                  hide-details
                  inline
                >
                  <v-radio
                    v-for="item in valueTypes"
                    :key="item.value"
                    :value="item.value"
                  >
                    <template #label>
                      <span class="d-flex align-center ga-2">
                        <v-icon
                          :icon="item.icon"
                          size="18"
                        />
                        {{ item.title }}
                      </span>
                    </template>
                  </v-radio>
                </v-radio-group>
              </v-sheet>
            </v-col>

            <v-col
              cols="12"
              md="6"
            >
              <v-sheet
                class="option-panel pa-3"
                rounded="lg"
              >
                <div class="text-caption mb-1">
                  Input type
                </div>
                <v-radio-group
                  v-model="selectedInputType"
                  hide-details
                  inline
                >
                  <v-radio
                    v-for="item in inputTypes"
                    :key="item.value"
                    :value="item.value"
                  >
                    <template #label>
                      <span class="d-flex align-center ga-2">
                        <v-icon
                          :icon="item.icon"
                          size="18"
                        />
                        {{ item.title }}
                      </span>
                    </template>
                  </v-radio>
                </v-radio-group>
              </v-sheet>
            </v-col>
          </v-row>

          <template v-if="selectedInputType === 'text'">
            <v-textarea
              v-model="inputText"
              class="mt-4"
              :label="`Enter ${selectedValueType === 'appid' ? 'app IDs' : 'app titles'}`"
              rows="6"
              variant="outlined"
            />

            <v-expand-transition>
              <div v-if="showDelimiterOption">
                <v-text-field
                  v-model="delimiter"
                  density="comfortable"
                  hint="Character that separates values"
                  label="Delimiter"
                  variant="outlined"
                />
              </div>
            </v-expand-transition>
          </template>

          <template v-else-if="selectedInputType === 'json'">
            <p class="text-caption mt-4 mb-2">
              TIP: Import <a
                href="https://store.steampowered.com/dynamicstore/userdata/"
                rel="noopener noreferrer"
                target="_blank"
              >Steam's dynamic store data</a> as JSON.
            </p>
            <v-textarea
              v-model="inputText"
              :error="!jsonIsValid"
              :error-messages="jsonIsValid ? '' : 'Invalid JSON format'"
              label="Enter JSON"
              :placeholder="JSON.stringify({ apps: { 400: { title: 'Portal' }, 620: { title: 'Portal 2' } } }, null, 2)"
              rows="6"
              variant="outlined"
            />

            <v-text-field
              v-model="jsonataQuery"
              density="comfortable"
              :error-messages="jsonataError"
              :hint="selectedValueType === 'title' ? 'e.g. apps.*.title' : 'e.g. $keys(apps)'"
              label="JSON selector"
              variant="outlined"
            />
          </template>

          <v-alert
            v-if="validationError"
            class="mt-3"
            density="comfortable"
            icon="mdi-alert-circle-outline"
            type="error"
            variant="tonal"
          >
            {{ validationError }}
          </v-alert>

          <v-card
            v-if="preview.length > 0 && !validationError"
            class="mt-4 preview-card"
            variant="outlined"
          >
            <v-card-title class="text-subtitle-1 d-flex align-center ga-2">
              <span>Parsed preview</span>
              <v-chip
                color="primary"
                size="small"
                variant="tonal"
              >
                First {{ previewCount }} only
              </v-chip>
            </v-card-title>
            <v-card-text class="preview-content">
              <v-list
                class="py-0"
                density="compact"
              >
                <v-list-item
                  v-for="(item, index) in preview"
                  :key="`${item}-${index}`"
                  rounded="lg"
                >
                  <v-list-item-title class="preview-text">
                    {{ item }}
                  </v-list-item-title>
                </v-list-item>
              </v-list>
              <div
                v-if="preview.length === previewCount"
                class="text-caption text-center pa-2"
              >
                More items not shown in preview
              </div>
            </v-card-text>
          </v-card>
        </v-card-text>

        <v-card-actions class="px-6 pb-6 pt-0">
          <v-btn @click="internalValue = false">
            {{ isLoading ? 'Abort' : 'Close' }}
          </v-btn>

          <v-spacer />

          <v-btn
            color="primary"
            :disabled="isLoading || preview.length === 0 || !!validationError"
            variant="tonal"
            @click="submitParsedInput"
          >
            {{ selectedValueType === 'appid' ? 'Save apps' : 'Match titles' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </template>
  </v-dialog>

  <dialog-match-apps
    v-model="matchingDialogOpen"
    :collection="props.collection"
    :loading="isLoading"
    :titles="matchingTitles"
    @save="submitMatchedApps"
  />
</template>

<style lang="scss" scoped>
  .dialog-add-shell {
    background: rgb(var(--v-theme-surface));
  }

  .add-apps-body {
    max-height: 68vh;
    overflow-y: auto;
  }

  .presets {
    padding: 0 8px 0 8px;

    :deep(.v-slide-group__prev--disabled),
    :deep(.v-slide-group__next--disabled) {
      display: none;
    }
  }

  .preset-chip {
    transition: filter 0.2s ease;
  }

  .option-panel {
    border: 1px solid rgba(var(--v-theme-on-surface), 0.14);
    background: rgb(var(--v-theme-surface));
  }

  .preview-card {
    border-color: rgba(var(--v-theme-on-surface), 0.14);
    background: rgb(var(--v-theme-surface));
  }

  .preview-content {
    .preview-text {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace;
    }
  }
</style>
