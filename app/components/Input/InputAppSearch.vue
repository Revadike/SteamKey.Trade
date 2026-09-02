<script setup>
  import debounce from 'lodash/debounce';

  const { search } = useSearchApps();

  const selected = defineModel({
    default: null,
    type: [String, Number]
  });

  const suggestions = ref([]);
  const loading = ref(false);

  const fetchSuggestions = async (query) => {
    if (!query || suggestions.value.find(({ title }) => title === query)) {
      return;
    }

    loading.value = true;
    try {
      const results = await search(query);
      suggestions.value = results.slice(0, 100).map(result => ({
        title: result.item.names[0],
        props: {
          subtitle: result.item.appid.toString()
        },
        value: result.item.appid
      }));
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      loading.value = false;
    }
  };

  // Debounced version of fetchSuggestions
  const debouncedFetchSuggestions = debounce(fetchSuggestions, 300);

  // Handler for search input updates
  const onSearch = (searchTerm) => {
    debouncedFetchSuggestions(searchTerm);
  };
</script>

<template>
  <v-autocomplete
    v-model="selected"
    auto-select-first
    hide-no-data
    :items="suggestions"
    label="Search"
    :loading="loading"
    placeholder="Type to search..."
    v-bind="$attrs"
    @click:clear="suggestions = []"
    @update:model-value="suggestions = []"
    @update:search="onSearch"
  >
    <template #item="{ item: { title, value }, props: itemProps }">
      <v-list-item v-bind="itemProps">
        <template #prepend>
          <v-img
            :alt="title"
            class="mr-4"
            height="45"
            lazy-src="/applogo.svg"
            :src="`https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${value}/header.jpg`"
            width="90"
          />
        </template>
      </v-list-item>
    </template>
  </v-autocomplete>
</template>
