/**
 * Store your personal app collections.
 *
 * @type {StoreDefinition<"collections", {
 *   library: Array,
 *   wishlist: Array,
 *   tradelist: Array,
 *   blacklist: Array,
 * }>}
 */
export const useCollectionsStore = defineStore('collections', () => {
  const library = ref([]);
  const wishlist = ref([]);
  const tradelist = ref([]);
  const blacklist = ref([]);

  const inCollection = computed(() => (type, appid) => {
    if (typeof type !== 'string' || isNaN(appid)) {
      return false;
    }

    const collection = { library, wishlist, tradelist, blacklist }[type];
    if (!collection) {
      return false;
    }

    return collection.value.includes(Number(appid));
  });

  const inLibrary = computed(() => (appid) => {
    return inCollection.value('library', appid);
  });

  const inWishlist = computed(() => (appid) => {
    return inCollection.value('wishlist', appid);
  });

  const inTradelist = computed(() => (appid) => {
    return inCollection.value('tradelist', appid);
  });

  const inBlacklist = computed(() => (appid) => {
    return inCollection.value('blacklist', appid);
  });

  function setCollection(type, appids) {
    if (typeof type !== 'string' || !Array.isArray(appids)) {
      return;
    }

    const collection = { library, wishlist, tradelist, blacklist }[type];
    if (!collection) {
      return;
    }

    collection.value = [...new Set(markRaw(appids).map(Number).filter(Boolean))];
  }

  function setLibrary(appids) {
    return setCollection('library', appids);
  }

  function setWishlist(appids) {
    return setCollection('wishlist', appids);
  }

  function setTradelist(appids) {
    return setCollection('tradelist', appids);
  }

  function setBlacklist(appids) {
    return setCollection('blacklist', appids);
  }

  function reset() {
    library.value = [];
    wishlist.value = [];
    tradelist.value = [];
    blacklist.value = [];
  }

  return {
    library,
    wishlist,
    tradelist,
    blacklist,
    inCollection,
    inLibrary,
    inWishlist,
    inTradelist,
    inBlacklist,
    setCollection,
    setLibrary,
    setWishlist,
    setTradelist,
    setBlacklist,
    reset
  };
}, {
  persist: true
});
