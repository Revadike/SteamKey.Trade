<script setup>
  import { FunctionsHttpError } from '@supabase/supabase-js';
  import jsonata from 'jsonata';

  const props = defineProps({
    collection: {
      type: Object,
      default: null
    }
  });

  const { Collection } = useORM();
  const { searchMany } = useSearchApps();
  const internalValue = ref(false);
  const inputText = ref('');
  const isLoading = ref(false);
  const preview = ref([]);
  const previewCount = 10;
  const validationError = ref('');

  const selectedValueType = ref('title');
  const valueTypes = [
    { title: 'AppID\'s (fast)', value: 'appid' },
    { title: 'App titles (slow)', value: 'title' },
    { title: 'AppID\'s and titles', value: 'mixed' }
  ];

  const selectedInputType = ref('text');
  const inputTypes = [
    { title: 'Text', value: 'text' },
    { title: 'JSON', value: 'json' }
  ];

  // For text input with delimiter
  const showDelimiterOption = ref(false);
  const delimiter = ref(',');

  // For JSON input with JSONata
  const jsonIsValid = ref(true);
  const jsonataQuery = ref('');
  const jsonataError = ref('');

  const totalItems = ref(0);
  const processedItems = ref(0);
  const emit = defineEmits(['submit']);

  // Process text input into array of items
  const processTextInput = (text) => {
    const lines = text.trim().split('\n').filter(line => line.trim());

    if (lines.length === 1) {
      showDelimiterOption.value = true;
      return lines[0].split(delimiter.value).map(item => item.trim()).filter(Boolean);
    } else {
      showDelimiterOption.value = false;
      return lines;
    }
  };

  // Parse JSON and apply JSONata query if provided
  const processJsonInput = async (text, query) => {
    try {
      const jsonData = JSON.parse(text);
      jsonIsValid.value = true;

      if (query.trim()) {
        try {
          // Use JSONata for query processing
          const expression = jsonata(query);
          const result = await expression.evaluate(jsonData);
          jsonataError.value = '';

          if (Array.isArray(result)) {
            return result;
          } else if (result !== undefined) {
            return [result];
          }
          return [];
        } catch (e) {
          jsonataError.value = e.message;
          return [];
        }
      } else {
        // No query provided, just return the top-level array if it exists
        return Array.isArray(jsonData) ? jsonData : [jsonData];
      }
    } catch {
      jsonIsValid.value = false;
      return [];
    }
  };

  // Process input based on selected type
  const processInput = async () => {
    if (!inputText.value.trim()) {
      return [];
    }

    try {
      if (selectedInputType.value === 'text') {
        return processTextInput(inputText.value);
      } else if (selectedInputType.value === 'json') {
        return await processJsonInput(inputText.value, jsonataQuery.value);
      }
    } catch (e) {
      console.error(e);
    }

    return [];
  };

  // Validate app IDs
  const validateAppIds = (items) => {
    const validAppIds = items
      .map(item => Number(item))
      .filter(appId => !isNaN(appId) && appId > 0 && appId === Math.floor(appId));

    if (validAppIds.length !== items.length) {
      validationError.value = 'Not all items are valid AppIDs (positive integers)';
    }

    return validAppIds;
  };

  // Update preview based on current selections and input
  const updatePreview = async () => {
    preview.value = [];
    validationError.value = '';

    const items = await processInput();

    // Validate if all items are valid AppIDs if value type is appid
    if (selectedValueType.value === 'appid' && items.length > 0) {
      validateAppIds(items);
    }

    // Limit preview to first n items
    preview.value = items.slice(0, previewCount);
  };

  // Watch for input changes to update preview
  watch([inputText, selectedInputType, selectedValueType, delimiter, jsonataQuery], () => {
    updatePreview();
  }, { immediate: true });

  const submit = async () => {
    isLoading.value = true;
    validationError.value = '';

    try {
      const inputItems = await processInput();
      let finalAppIds = [];

      // If appids are already selected, just validate them
      if (selectedValueType.value === 'appid') {
        finalAppIds = validateAppIds(inputItems);
      // If app titles are selected, search for each title and extract the appids
      } else if (selectedValueType.value === 'title' || selectedValueType.value === 'mixed') {
        totalItems.value = inputItems.length;
        processedItems.value = 0;

        const batchSize = 20;
        for (let i = 0; i < inputItems.length; i += batchSize) {
          if (internalValue.value === false) {
            break; // Abort if dialog is closed
          }

          const batch = inputItems.slice(i, i + batchSize);
          const titlesToSearch = batch.filter(title => {
            return !(selectedValueType.value === 'mixed' && !isNaN(Number(title)));
          });

          const batchResults = await searchMany(titlesToSearch);
          const resultsByQuery = Object.fromEntries(batchResults.map(({ query, results }) => [query, results]));

          const resolvedAppIds = batch.map((title) => {
            if (selectedValueType.value === 'mixed' && !isNaN(Number(title))) {
              return Number(title); // It's an appid
            }

            processedItems.value++;
            const results = resultsByQuery[title] || [];

            if (results.length > 0) {
              // Get the appid from the best match
              return results[0]?.item?.appid;
            }
            return null;
          });
          finalAppIds.push(...resolvedAppIds.filter(id => id !== null && !isNaN(id)));
        }

        if (finalAppIds.length !== inputItems.length) {
          validationError.value = 'Some app titles could not be found';
        }
      }

      let instance = new Collection(props.collection.id);
      Object.assign(instance, props.collection);

      const isNew = !!instance.isNew;
      if (isNew) {
        instance = await instance.save();
      }

      await instance.addApps(finalAppIds);

      if (isNew) {
        useSnackbarStore().set('success', 'Collection created');
        await navigateTo(`/collection/${instance.id}/edit`);
      } else {
        emit('submit', finalAppIds);
      }

      internalValue.value = false;
      resetForm();
    } catch (error) {
      console.error(error);
      validationError.value = `Error: ${error.message}`;
    } finally {
      isLoading.value = false;
    }
  };

  const resetForm = () => {
    inputText.value = '';
    showDelimiterOption.value = false;
    jsonIsValid.value = true;
    jsonataQuery.value = '';
    jsonataError.value = '';
    validationError.value = '';
    preview.value = [];
    totalItems.value = 0;
    processedItems.value = 0;
  };

  const snackbarStore = useSnackbarStore();
  const supabase = useSupabaseClient();
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

          const { appids = [] } = data;

          if (appids.length === 0) {
            snackbarStore.set('error', 'No items found in your Barter.vg tradable collection');
            return;
          }

          inputText.value = appids.join(',');
          selectedInputType.value = 'text';
          selectedValueType.value = 'appid';
          delimiter.value = ',';
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

          const { appids = [], queries = [] } = data;

          if (appids.length === 0) {
            snackbarStore.set('error', 'No items found in your Steam Inventory');
            return;
          }

          inputText.value = `${appids.join('\n')}\n${[...new Set(queries)].join('\n')}`;
          selectedInputType.value = 'text';
          selectedValueType.value = appids.length > 0 ? 'mixed' : 'title';
          delimiter.value = '\n';
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

          if (!data || data.length === 0) {
            snackbarStore.set('error', 'No trade topics found in SteamTrades');
            return;
          }

          inputText.value = '';
          for (const topic of data) {
            if (data.length > 1) {
              inputText.value += `(REMOVE THIS) Found in: ${topic.title}\n\n`;
            }
            if (topic.appids && topic.appids.length > 0) {
              inputText.value += `${topic.appids.join(',')}\n`;
            }
            if (topic.queries && topic.queries.length > 0) {
              inputText.value += `${topic.queries.join('\n')}\n`;
            }
            const index = data.indexOf(topic);
            if (index < data.length - 1) {
              inputText.value += '\n\n\n--------------------------------------------------------\n\n\n';
            }
          }
          selectedInputType.value = 'text';
          selectedValueType.value = data.some(topic => topic.appids.length > 0) ? 'mixed' : 'title';
          delimiter.value = '\n';
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
    width="720"
  >
    <template #activator="attrs">
      <slot
        name="activator"
        v-bind="attrs"
      />
    </template>

    <template #default>
      <v-card :loading="isLoading">
        <v-card-title>
          Apps import
          <template v-if="isLoading && (selectedValueType === 'title' || selectedValueType === 'mixed')">
            ({{ processedItems }}/{{ totalItems }})
          </template>
        </v-card-title>
        <v-card-text>
          <v-row>
            <v-col
              class="d-flex align-center"
              cols="12"
            >
              <span class="flex-grow-0 text-no-wrap">
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
              <v-select
                v-model="selectedValueType"
                density="comfortable"
                hide-details
                :items="valueTypes"
                label="Target"
              />
            </v-col>
            <v-col
              cols="12"
              md="6"
            >
              <v-select
                v-model="selectedInputType"
                density="comfortable"
                hide-details
                :items="inputTypes"
                label="Input"
              />
            </v-col>
          </v-row>

          <template v-if="selectedInputType === 'text'">
            <v-textarea
              v-model="inputText"
              class="mt-4"
              :label="`Enter ${selectedValueType === 'appid' ? 'appids' : 'app titles'}`"
              rows="5"
            />

            <v-expand-transition>
              <div v-if="showDelimiterOption">
                <v-text-field
                  v-model="delimiter"
                  density="comfortable"
                  hint="Character that separates values"
                  label="Delimiter"
                />
              </div>
            </v-expand-transition>
          </template>

          <!-- JSON Input Section -->
          <template v-else-if="selectedInputType === 'json'">
            <p class="text-caption mt-4">
              TIP: Import <a
                href="https://store.steampowered.com/dynamicstore/userdata/"
                rel="noopener noreferrer"
                target="_blank"
              >Steam's dynamic store data</a> as JSON.
            </p>
            <v-textarea
              v-model="inputText"
              class="mt-4"
              :error="!jsonIsValid"
              :error-messages="jsonIsValid ? '' : 'Invalid JSON format'"
              label="Enter JSON"
              :placeholder="JSON.stringify({ apps: { 400: { title: 'Portal' }, 620: { title: 'Portal 2' } } }, null, 2)"
              rows="5"
            />

            <v-text-field
              v-model="jsonataQuery"
              density="comfortable"
              :error-messages="jsonataError"
              :hint="selectedValueType === 'title' ? 'e.g. apps.*.title' : 'e.g. $keys(apps)'"
              label="JSON selector"
            />
          </template>

          <!-- Validation Error -->
          <div
            v-if="validationError"
            class="text-error mt-2"
          >
            {{ validationError }}
          </div>

          <!-- Preview Section -->
          <v-card
            v-if="Array.isArray(preview) && preview.length > 0 && !validationError"
            class="mt-4 text-disabled"
            variant="tonal"
          >
            <v-card-title class="text-subtitle-1">
              Parsed preview (first {{ previewCount }} items)
            </v-card-title>
            <v-card-text>
              <p
                v-for="(item, index) in preview"
                :key="index"
              >
                {{ item }}
              </p>
              <div
                v-if="preview.length === previewCount"
                class="text-caption text-center pa-2"
              >
                More items not shown in preview
              </div>
            </v-card-text>
          </v-card>
        </v-card-text>
        <v-card-actions>
          <v-btn @click="internalValue = false">
            {{ isLoading ? 'Abort' : 'Close' }}
          </v-btn>

          <v-spacer />

          <v-btn
            color="primary"
            :disabled="isLoading || preview.length === 0 || !!validationError"
            variant="tonal"
            @click="submit"
          >
            Save apps
          </v-btn>
        </v-card-actions>
      </v-card>
    </template>
  </v-dialog>
</template>

<style lang="scss" scoped>
  .presets {
    padding: 0 8px 0 8px;
    :deep(.v-slide-group__prev--disabled),
    :deep(.v-slide-group__next--disabled) {
      display: none;
    }
  }
</style>
