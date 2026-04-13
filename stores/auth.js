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

  const isLoggedIn = computed(() => !!user.value);

  const me = computed(() => {
    if (!user.value) {
      return null;
    }
    const { User } = useORM();
    return new User(user.value);
  });

  function setPassword(pwd, expiresIn) {
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
  }

  function setUser(userData) {
    user.value = userData;
  }

  function setPreferences(preferencesData) {
    preferences.value = preferencesData;
  }

  function setFromPath(path) {
    if (path?.startsWith('/login') || path?.startsWith('/logout')) {
      return;
    }

    fromPath.value = typeof path === 'string' && path || null;
  }

  function setPhotoUrl(url) {
    if (user.value) {
      user.value.avatar = url;
    }
  }

  function setPublicKey(publicKey) {
    if (user.value) {
      user.value.publicKey = publicKey;
    }
  }

  function updateUserCollections() {
    const supabase = useSupabaseClient();
    const { Collection } = useORM();
    const collectionsStore = useCollectionsStore();

    Collection.getMasterCollectionsApps(supabase, user.value.id)
      .then(masterCollections => {
        for (const type in masterCollections) {
          const appIds = masterCollections[type] || [];
          collectionsStore.setCollection(type, appIds);
        }
      })
      .catch(error => {
        console.error('Error fetching master collections:', error);
      });
  }

  function onAuthStateChange(authEvent, session) {
    const supabase = useSupabaseClient();
    const { User } = useORM();
    const collectionsStore = useCollectionsStore();

    const oldUser = user.value;
    const newUser = session?.user ?? null;
    const gotLoggedIn = !oldUser && !!newUser;
    const gotLoggedOut = !!oldUser && !newUser;

    // console.log({ authEvent, session, gotLoggedIn, gotLoggedOut });
    if (gotLoggedOut) {
      supabase.removeAllChannels();
      setUser(null);
      setPreferences(null);
      setPassword(null);
      setFromPath(null);

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

      userInstance.getPreferences().then(prefs => {
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
  }

  return {
    user,
    preferences,
    fromPath,
    password,
    passwordExpiry,
    isLoggedIn,
    me,
    setPassword,
    setUser,
    setPreferences,
    setFromPath,
    setPhotoUrl,
    setPublicKey,
    updateUserCollections,
    onAuthStateChange
  };
}, {
  persist: true
});
