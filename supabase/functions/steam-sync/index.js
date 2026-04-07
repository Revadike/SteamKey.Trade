import { serve } from '../_helpers/edge.js';
import { supabaseAdmin } from '../_helpers/supabase.js';
import { steamApiRequest } from '../_helpers/steamAPI.js';
import { User, Collection } from '../_entities/index.js';

/**
 * Generic function to sync a collection with Steam data
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client
 * @param {User} user - User object
 * @param {string} collectionType - Type of collection to sync (wishlist or library)
 * @param {Function} fetchApps - Function to fetch apps from Steam API
 * @returns {Promise<Collection>} - Updated collection object
 */
const syncCollection = async (supabase, user, collectionType, fetchApps) => {
  // Get the appropriate collection based on type
  let collection;
  if (collectionType === Collection.enums.type.wishlist) {
    collection = await Collection.getMasterWishlist(supabase, user.id);
  } else if (collectionType === Collection.enums.type.library) {
    collection = await Collection.getMasterLibrary(supabase, user.id);
  }

  if (!collection) {
    throw new Error(`Master ${collectionType} collection not found`);
  }

  // Do not sync more than once per hour
  if (Date.now() - new Date(collection.updatedAt) < 1000 * 60 * 60) {
    const name = collectionType.charAt(0).toUpperCase() + collectionType.slice(1);
    const minutesRemaining = Math.ceil((1000 * 60 * 60 - (Date.now() - new Date(collection.updatedAt))) / (1000 * 60));
    throw new Error(`${name} was updated too recently. Please wait ${minutesRemaining} more minutes before syncing again.`);
  }

  const newApps = await fetchApps();
  const newAppIds = newApps.map(({ appId }) => Number(appId));

  const syncedCollectionsApps = await Collection.getMasterCollectionsApps(supabase, user.id, Collection.enums.source.sync);
  const collectionsApps = await Collection.getMasterCollectionsApps(supabase, user.id);
  const existingSyncedApps = syncedCollectionsApps?.[collectionType] || [];
  const existingApps = collectionsApps?.[collectionType] || [];

  const { fields, table } = Collection.apps;
  const appsToRemove = existingSyncedApps.filter(appId => !newAppIds.includes(appId));
  const appsToAdd = newAppIds.filter(appId => !existingApps.includes(appId));

  if (appsToRemove.length > 0) {
    const batchSize = 500;

    // Split into batches for better performance
    for (let i = 0; i < appsToRemove.length; i += batchSize) {
      const batchApps = appsToRemove.slice(i, i + batchSize);
      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq(fields.collectionId, collection.id)
        .in(fields.appId, batchApps)
        // Avoid deleting apps manually added by users (only delete synced apps)
        .eq(fields.source, Collection.enums.source.sync);

      if (deleteError) {
        throw new Error(`Failed to remove apps from collection (batch ${i / batchSize + 1}): ${deleteError.message}`);
      }
    }
  }

  if (appsToAdd.length > 0) {
    const batchSize = 500;

    // Split into batches for better performance
    for (let i = 0; i < appsToAdd.length; i += batchSize) {
      const batchApps = appsToAdd.slice(i, i + batchSize);
      const appsToInsert = batchApps.map(appId => ({
        [fields.collectionId]: collection.id,
        [fields.appId]: appId,
        [fields.source]: Collection.enums.source.sync
      }));

      const { error: insertError } = await supabase
        .from(Collection.apps.table)
        .insert(appsToInsert);

      if (insertError) {
        throw new Error(`Failed to add apps to collection (batch ${i / batchSize + 1}): ${insertError.message}`);
      }
    }
  }

  collection.updatedAt = new Date();
  await collection.save();
  return collection;
};

/**
 * Fetch wishlist items from Steam API
 */
const fetchWishlist = async (steamId) => {
  const { items = [] } = await steamApiRequest('IWishlistService', 'GetWishlist', 'v1', {
    params: { steamid: steamId }
  });

  // TODO: Save date_added and priority as tag
  return items.map(({ appid, date_added }) => ({
    appId: Number(appid),
    createdAt: new Date(date_added * 1000)
  }));
};

/**
 * Fetch library items from Steam API
 */
const fetchLibrary = async (steamId) => {
  const { games = [] } = await steamApiRequest('IPlayerService', 'GetOwnedGames', 'v1', {
    params: {
      steamid: steamId,
      include_appinfo: false,
      include_played_free_games: true,
      include_free_sub: true,
      language: 'english',
      skip_unvetted_apps: false
    }
  });

  // TODO: Save playtime as tag
  return games.map(({ appid }) => ({ appId: Number(appid) }));
};

/**
 * Sync user's wishlist with Steam
 */
const syncMyWishlist = (supabase, user) => {
  return syncCollection(
    supabase,
    user,
    Collection.enums.type.wishlist,
    () => fetchWishlist(user.steamId)
  );
};

/**
 * Sync user's library with Steam
 */
const syncMyLibrary = (supabase, user) => {
  return syncCollection(
    supabase,
    user,
    Collection.enums.type.library,
    () => fetchLibrary(user.steamId)
  );
};

/**
 * Main handler for Steam sync endpoints
 */
const steamSync = async ({ userId, type }) => {
  if (!userId) {
    const { error, data } = await supabaseAdmin.auth.getUser();
    if (error) {
      throw new Error('Either provide a user ID or authenticate the request');
    }
    userId = data.user.id;
  }

  const user = new User(supabaseAdmin, userId);
  await user.load();

  if (!type) {
    const [wishlistCollection, libraryCollection] = await Promise.all([
      syncMyWishlist(supabaseAdmin, user),
      syncMyLibrary(supabaseAdmin, user)
    ]);
    return {
      success: true,
      wishlist: wishlistCollection.id,
      library: libraryCollection.id
    };
  } else if (type === Collection.enums.type.wishlist) {
    const collection = await syncMyWishlist(supabaseAdmin, user);
    return { success: true, wishlist: collection.id };
  } else if (type === Collection.enums.type.library) {
    const collection = await syncMyLibrary(supabaseAdmin, user);
    return { success: true, library: collection.id };
  } else {
    throw new Error(`Invalid collection type: ${type}`);
  }
};

serve(steamSync);
