/**
 * Store for users.
 *
 * @type {StoreDefinition<"users", {
 *   online: Object
 * }>}
 */
export const useUsersStore = defineStore('users', () => {
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
