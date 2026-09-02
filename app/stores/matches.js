/**
 * Store for user matches (have/want combos)
 *
 * Structure:
 * matches: {
 *   users: {
 *     [userId]: { have: Array, want: Array, refreshedAt: number }
 *   }
 * }
 */

export const useMatchesStore = defineStore('matches', () => {
  const users = ref({}); // { [userId]: { have, want, refreshedAt } }

  /**
   * Set matches for a user
   * @param {string|number} userId
   * @param {Array} have
   * @param {Array} want
   */
  const setUserMatches = (userId, have, want) => {
    users.value[userId] = markRaw({
      have,
      want,
      refreshedAt: Date.now()
    });
  };

  /**
   * Get matches for a user if cache is fresh (<24h)
   * @param {string|number} userId
   * @returns {null|{have:Array, want:Array}}
   */
  const getUserMatches = (userId) => {
    const entry = users.value[userId];
    if (!entry) {
      return null;
    }
    if (Date.now() - entry.refreshedAt > 24 * 60 * 60 * 1000) {
      return null;
    }

    return entry;
  };

  /**
   * Set multiple users' matches at once
   * @param {Object} userMatches - { [userId]: { have, want } }
   */
  const setFromRecords = (userMatches) => {
    Object.entries(userMatches).forEach(([userId, value]) => {
      setUserMatches(userId, value.have, value.want);
    });
  };

  /**
   * Reset all cached matches
   */
  const reset = () => {
    users.value = {};
  };

  return {
    users,
    setUserMatches,
    getUserMatches,
    setFromRecords,
    reset
  };
}, {
  persist: true
});
