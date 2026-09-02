let expirer = null;

/**
 * Store your authentication state data.
 *
 * @type {StoreDefinition<"auth", {
 *   user: null | Object
 *   preferences: null | Object
 *   fromPath: null | string,
 *   password: null | string,
 *   passwordExpiry: null | Number
 * }>}
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const preferences = ref(null);
  const fromPath = ref(null);
  const password = ref(null);
  const passwordExpiry = ref(null);
  const notificationCount = ref(0);

  const isLoggedIn = computed(() => !!user.value);

  const me = computed(() => {
    if (!user.value) {
      return null;
    }

    const { User } = useORM();
    return new User(user.value);
  });

  const setPassword = (pwd, expiresIn) => {
    password.value = pwd || null;
    if (expirer) {
      clearTimeout(expirer);
      expirer = null;
    }

    // Reset persisted expiry metadata unless a new valid timeout is provided.
    passwordExpiry.value = null;

    if (typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0) {
      passwordExpiry.value = Date.now() + expiresIn;
      expirer = setTimeout(() => {
        password.value = null;
        passwordExpiry.value = null;
        expirer = null;
      }, expiresIn);
    }
  };

  const setUser = (userData) => {
    user.value = userData;
  };

  const setPreferences = (preferencesData) => {
    preferences.value = preferencesData;
  };

  const setFromPath = (path) => {
    if (path?.startsWith('/login') || path?.startsWith('/logout')) {
      return;
    }

    fromPath.value = (typeof path === 'string' && path) || null;
  };

  const setPhotoUrl = (url) => {
    if (user.value) {
      user.value.avatar = url;
    }
  };

  const setPublicKey = (publicKey) => {
    if (user.value) {
      user.value.publicKey = publicKey;
    }
  };

  const setNotificationCount = (count) => {
    notificationCount.value = count;
  };

  const updateUserCollections = () => {
    const supabase = useSupabaseClient();
    const { Collection } = useORM();
    const collectionsStore = useCollectionsStore();

    Collection.getMasterCollectionsApps(supabase, user.value.id)
      .then((masterCollections) => {
        for (const type in masterCollections) {
          const appIds = masterCollections[type] || [];
          collectionsStore.setCollection(type, appIds);
        }
      })
      .catch((error) => {
        console.error('Error fetching master collections:', error);
      });
  };

  const onAuthStateChange = (authEvent, session) => {
    const supabase = useSupabaseClient();
    const { User } = useORM();
    const collectionsStore = useCollectionsStore();

    const oldUser = user.value;
    const newUser = session?.user ?? null;
    const gotLoggedIn = !oldUser && !!newUser;
    const gotLoggedOut = !!oldUser && !newUser;

    if (gotLoggedOut) {
      supabase.removeAllChannels();
      setUser(null);
      setPreferences(null);
      setPassword(null);
      setNotificationCount(0);

      collectionsStore.reset();

      clearNuxtData(); // Remove personalized (or anonymous) cached data

      navigateTo(fromPath.value || '/');
    } else if (gotLoggedIn) {
      clearNuxtData(); // Remove personalized (or anonymous) cached data

      const userInstance = new User(newUser.id);
      userInstance.load().then(() => {
        setUser(userInstance.toObject());

        updateUserCollections();
      });

      userInstance.getPreferences().then((prefs) => {
        setPreferences(prefs);
      });

      navigateTo(fromPath.value || '/');
    }

    // Restore the password expiry timer
    if (password.value && passwordExpiry.value) {
      const expiresIn = passwordExpiry.value - Date.now();
      if (expiresIn > 0) {
        setPassword(password.value, expiresIn);
      } else {
        setPassword(null);
      }
    }
  };

  return {
    user,
    preferences,
    fromPath,
    password,
    passwordExpiry,
    notificationCount,
    isLoggedIn,
    me,
    setPassword,
    setUser,
    setPreferences,
    setFromPath,
    setPhotoUrl,
    setPublicKey,
    setNotificationCount,
    updateUserCollections,
    onAuthStateChange
  };
}, {
  persist: true
});
