/**
 * Store for apps
 *
 * @type {StoreDefinition<"apps", {
 *   facets: null | Array,
 *   facetsRefreshedAt: null | Date
 * }>}
 */
export const useAppsStore = defineStore('apps', () => {
  const facets = ref(null);
  const facetsRefreshedAt = ref(null);

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
    facets.value = null;
    facetsRefreshedAt.value = null;
  }

  return {
    facets,
    facetsRefreshedAt,
    refreshFacets,
    reset
  };
}, {
  persist: true
});
