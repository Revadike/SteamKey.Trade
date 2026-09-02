/**
 * Store for table preferences (sort order, items per page)
 *
 * @type {StoreDefinition<"tables", {
 *   preferences: Object
 * }>}
 */
export const useTablesStore = defineStore('tables', () => {
  const preferences = ref({});

  /**
   * Get preferences for a specific table
   * @param {string} tableId - Unique identifier for the table
   * @returns {Object|null}
   */
  const getPreferences = (tableId) => {
    return preferences.value[tableId] || null;
  };

  /**
   * Set preferences for a specific table
   * @param {string} tableId - Unique identifier for the table
   * @param {Object} prefs - Preferences object with sortBy and/or itemsPerPage
   */
  const setPreferences = (tableId, prefs) => {
    preferences.value[tableId] = {
      ...preferences.value[tableId],
      ...prefs
    };
  };

  /**
   * Set sort preferences
   * @param {string} tableId - Unique identifier for the table
   * @param {Array} sortBy - Sort configuration array
   */
  const setSortBy = (tableId, sortBy) => {
    if (!preferences.value[tableId]) {
      preferences.value[tableId] = {};
    }

    preferences.value[tableId].sortBy = sortBy;
  };

  /**
   * Set items per page preference
   * @param {string} tableId - Unique identifier for the table
   * @param {number} itemsPerPage - Number of items per page
   */
  const setItemsPerPage = (tableId, itemsPerPage) => {
    if (!preferences.value[tableId]) {
      preferences.value[tableId] = {};
    }

    preferences.value[tableId].itemsPerPage = itemsPerPage;
  };

  return {
    preferences,
    getPreferences,
    setPreferences,
    setSortBy,
    setItemsPerPage
  };
}, {
  persist: true
});
