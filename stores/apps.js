/**
 * Store for apps
 *
 * @type {StoreDefinition<"apps", {
 *   fuse: null | Object,
 *   destroy: null | Function,
 *   defaultOptions: Object,
 *   names: null | Array,
 *   headers: null | Object,
 *   metadataRefreshedAt: null | Date,
 *   facets: null | Array,
 *   facetsRefreshedAt: null | Date
 * }>}
 */
export const useAppsStore = defineStore('apps', () => {
  const fuse = ref(null);
  const destroy = ref(null);
  const defaultOptions = ref(markRaw({
    includeScore: true,
    threshold: 0.175,
    limit: 20,
    keys: ['names']
  }));
  const names = ref(null);
  const headers = ref(null);
  const metadataRefreshedAt = ref(null);
  const facets = ref(null);
  const facetsRefreshedAt = ref(null);

  const isReady = computed(() => !!names.value);

  function setNames(namesList) {
    names.value = markRaw(namesList);
    setSearchOptions(defaultOptions.value);
  }

  function setHeaders(headersList) {
    headers.value = markRaw(headersList);
  }

  function setSearchOptions(options) {
    if (fuse.value) {
      destroy.value();
    }
    const { search, destroy: destroyFn } = useFuse(names.value, options);
    fuse.value = search;
    destroy.value = destroyFn;
  }

  // TODO: Use supabase search instead?
  function search(query) {
    return fuse.value(query);
  }

  /**
   * Refresh app metadata if they are not yet set or if they are older than 24 hours
   *
   * @returns {Promise<void>}
   */
  async function refreshMetadata() {
    // Refresh metadata if they are not set or if they are older than 24 hours
    if (names.value && headers.value && metadataRefreshedAt.value && Date.now() - metadataRefreshedAt.value < 24 * 60 * 60 * 1000) {
      return;
    }

    const supabase = useSupabaseClient();
    try {
      const { data } = supabase.storage.from('assets').getPublicUrl('apps.metadata.json.gz');
      const response = await fetch(data.publicUrl)
        .then(res => {
          const decompressor = new DecompressionStream('gzip');
          const decompressionStream = res.body.pipeThrough(decompressor);
          return new Response(decompressionStream).arrayBuffer();
        })
        .then(buffer => {
          return new TextDecoder('utf-8').decode(buffer);
        });

      const apps = JSON.parse(response);
      setNames(apps.map(({ id, title, altTitles }) => ({
        appid: id,
        names: [title].concat(altTitles || [])
      })));

      setHeaders(Object.fromEntries(apps.map(({ id, header }) => [id, header])));

      metadataRefreshedAt.value = Date.now();
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Refresh app facets if they are not yet set or if they are older than 24 hours
   *
   * @returns {Promise<void>}
   */
  async function refreshFacets() {
    // Refresh facets if they are not set or if they are older than 24 hours
    if (facets.value && facetsRefreshedAt.value && Date.now() - facetsRefreshedAt.value < 24 * 60 * 60 * 1000) {
      return;
    }

    const supabase = useSupabaseClient();
    const { App } = useORM();

    try {
      const facetsData = await App.getFacets(supabase);
      facets.value = facetsData;
      facetsRefreshedAt.value = Date.now();
    } catch (error) {
      console.error(error);
    }
  }

  function reset() {
    setSearchOptions(defaultOptions.value);
  }

  return {
    fuse,
    destroy,
    defaultOptions,
    names,
    headers,
    metadataRefreshedAt,
    facets,
    facetsRefreshedAt,
    isReady,
    setNames,
    setHeaders,
    setSearchOptions,
    search,
    refreshMetadata,
    refreshFacets,
    reset
  };
}, {
  persist: true
});
