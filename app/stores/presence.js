/**
 * Store for user presence.
 *
 * @type {StoreDefinition<"presence", {
 *   online: Object
 * }>}
 */
export const usePresenceStore = defineStore('presence', () => {
  const online = ref({});

  function setOnline(presenceState) {
    const items = Object.values(presenceState).flat();
    online.value = items.reduce((acc, item) => {
      const { user_id, online_at } = item;
      acc[user_id] = online_at;
      return acc;
    }, {});
  }

  return {
    online,
    setOnline
  };
});
