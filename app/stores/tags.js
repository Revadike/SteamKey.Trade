/**
 * Store for tags
 *
 * @type {StoreDefinition<"tags", {
 *   names: null | Object,
 *   types: null | Object,
 *   refreshedAt: null | Date
 * }>}
 */
export const useTagsStore = defineStore('tags', () => {
  const names = ref(null);
  const types = ref(null);
  const refreshedAt = ref(null);

  const setNames = (namesList) => {
    names.value = markRaw(namesList);
  };

  const setTypes = (typesList) => {
    types.value = markRaw(typesList);
  };

  const setFromRecords = (records) => {
    const namesObj = {};
    const typesObj = {};

    records.forEach((record) => {
      namesObj[record.id] = record.title;
      typesObj[record.id] = record.type;
    });

    setNames(namesObj);
    setTypes(typesObj);
  };

  /**
   * Get all names (of a specific type)
   *
   * @param {string} typeFilter - The type of tags to get (optional)
   * @returns {Object} - An object mapping tag IDs to names
   */
  const getNames = (typeFilter) => {
    return Object.fromEntries(
      Object.entries(names.value).filter(([id]) =>
        !typeFilter || types.value[id] === typeFilter
      )
    );
  };

  /**
   * Refresh tags if they are not yet set or older than 24 hours.
   *
   * @returns {Promise<void>}
   */
  const refreshTags = async () => {
    // Refresh tags if they are not set or if they are older than 24 hours
    if (Object.keys(names.value || {}).length && Object.keys(types.value || {}).length && refreshedAt.value && Date.now() - refreshedAt.value < 24 * 60 * 60 * 1000) {
      return;
    }

    const supabase = useSupabaseClient();
    try {
      const { data } = await supabase
        .from('tags')
        .select('id, title, type');

      if (data) {
        setFromRecords(data);
        refreshedAt.value = Date.now();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const reset = () => {
    names.value = null;
    types.value = null;
  };

  return {
    names,
    types,
    refreshedAt,
    setNames,
    setTypes,
    setFromRecords,
    getNames,
    refreshTags,
    reset
  };
}, {
  persist: true
});
