import { FunctionsHttpError } from '@supabase/supabase-js';

export const useSteamSync = (type) => {
  const supabase = useSupabaseClient();
  const snackbarStore = useSnackbarStore();
  const { user, updateUserCollections } = useAuthStore();
  const { Collection } = useORM();

  const loading = ref(false);

  if (type !== Collection.enums.type.library && type !== Collection.enums.type.wishlist) {
    throw new Error('Steam sync is only supported for Library and Wishlist collections.');
  }

  const sync = async () => {
    loading.value = true;
    try {
      const { data, error } = await supabase.functions.invoke('steam-sync', {
        body: { userId: user.id, type }
      });
      if (error) {
        throw error;
      }

      await updateUserCollections();
      const isWishlist = type === Collection.enums.type.wishlist;
      const successMsg = isWishlist ? 'Steam Wishlist synchronized' : 'Steam Library synchronized';
      const collectionId = isWishlist ? data.wishlist : data.library;
      snackbarStore.set('success', successMsg);
      await navigateTo(`/collection/${collectionId}`);
    } catch (error) {
      console.error(error);
      let errorMsg = 'Something went wrong while synchronizing your Steam collection.';
      if (error instanceof FunctionsHttpError) {
        const message = await error.context.json();
        errorMsg = message.error || message;
      } else if (type === Collection.enums.type.wishlist) {
        errorMsg = 'Could not synchronize your Steam Wishlist.';
      } else if (type === Collection.enums.type.library) {
        errorMsg = 'Could not synchronize your Steam Library.';
      }

      snackbarStore.set('error', errorMsg);
    }
    loading.value = false;
  };

  return { sync, loading };
};
