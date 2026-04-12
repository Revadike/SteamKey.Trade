<script setup>
  const emit = defineEmits(['import']);

  const internalValue = ref(false);
  const isLoading = ref(false);
  const topics = ref([]);
  const selectedTopics = ref([]);

  const supabase = useSupabaseClient();
  const snackbarStore = useSnackbarStore();

  watch(() => internalValue.value, async value => {
    if (value && !topics.value.length) {
      isLoading.value = true;
      const { data, error } = await supabase.functions.invoke('thirdparty-import', {
        body: {
          source: 'steamtrades'
        }
      });

      if (error) {
        snackbarStore.set('error', 'Error loading SteamTrades trade topics');
      } else {
        topics.value = data;
      }

      isLoading.value = false;
    }
  });

  const { searchMany } = useSearchApps();
  const queried = ref(0);
  const importToVault = async () => {
    isLoading.value = true;

    const imports = [];
    for (const { appids = [], queries = [] } of selectedTopics.value) {
      appids.forEach(appid => {
        imports.push({
          query: appid,
          values: [''],
          suggestions: [],
          appid,
          name: null,
          score: 0
        });
      });

      for (let i = 0; i < queries.length; i += 20) {
        if (internalValue.value === false) {
          break;
        }

        const batch = queries.slice(i, i + 20);
        const batchResults = await searchMany(batch);

        for (const { query, results } of batchResults) {
          if (internalValue.value === false) {
            break;
          }

          queried.value++;
          imports.push({
            query,
            values: [''],
            suggestions: results.slice(0, 100),
            appid: results[0]?.item?.appid ?? null,
            name: results[0]?.item?.names?.[0] ?? query,
            score: results[0]?.score ?? 1
          });
        }
      }
    }

    emit('import', imports);

    selectedTopics.value = [];
    queried.value = 0;
    internalValue.value = false;
    isLoading.value = false;
  };
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
          SteamTrades import
          <template v-if="isLoading && selectedTopics.length">
            ({{ queried }}/{{ selectedTopics.map(({ queries }) => queries.length).reduce((a, b) => a + b, 0) }})
          </template>
        </v-card-title>
        <v-card-text>
          <p v-if="isLoading && topics.length === 0">
            Loading SteamTrades trade topics...
          </p>
          <p v-else-if="!isLoading && topics.length === 0">
            No SteamTrades trade topics found.
          </p>
          <p
            v-else
            class="mb-4"
          >
            Select your SteamTrades trade topics to import:
          </p>

          <v-checkbox
            v-for="topic in topics"
            :key="topic.url"
            v-model="selectedTopics"
            :disabled="isLoading"
            hide-details
            multiple
            :value="topic"
          >
            <template #label>
              <span>
                <a
                  :href="topic.url"
                  rel="noopener"
                  target="_blank"
                >
                  {{ topic.title }}
                </a>
                {{ ' ' }}
                (found
                {{ (topic.appids?.length ?? 0) + (topic.queries?.length ?? 0) }}
                apps)
              </span>
            </template>
          </v-checkbox>
        </v-card-text>
        <v-card-actions>
          <v-btn
            :color="isLoading ? 'error' : 'disabled'"
            @click="internalValue = false"
          >
            {{ isLoading ? 'Abort' : 'Close' }}
          </v-btn>

          <v-spacer />

          <v-btn
            :disabled="isLoading"
            variant="tonal"
            @click="importToVault"
          >
            Import
          </v-btn>
        </v-card-actions>
      </v-card>
    </template>
  </v-dialog>
</template>
