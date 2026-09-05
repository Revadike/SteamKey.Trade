/**
 * Unified data fetching composable for Supabase operations.
 * Provides automatic caching and consistent data fetching patterns across the application.
 *
 * @param {string} name - The name of the data definition to use
 * @param {Object} params - Parameters to pass to the data fetcher
 * @param {Object} options - Additional options to override defaults (watch, dedupe, timeout, server, lazy, default, transform, pick)
 * @returns {{ data: Ref, status: Ref, pending: Ref, error: Ref, refresh: Function, execute: Function, clear: Function }}
 *
 * @example
 * const { data: user, error } = useSupabaseData('user', { id: userId });
 * const { data: trades, refresh } = useSupabaseData('my-recent-trades');
 */
export const useSupabaseData = (name, params = {}, options = {}) => {
  const { App, User, Trade, Collection, Review, TradeMessage } = useORM();
  const supabase = useSupabaseClient();
  const { user: authUser, isLoggedIn } = useAuthStore();

  const sources = {
    'user': {
      key: () => params.id ? `user-${params.id}` : 'user-unknown',
      handler: async () => {
        if (!params.id) {
          return null;
        }

        try {
          const user = new User(params.id);
          await user.load();
          return user.toObject();
        } catch (err) {
          if (err.code === 'PGRST116') {
            throw createError({
              statusCode: 404,
              statusMessage: 'User not found',
              message: 'The user you are looking for does not exist',
              fatal: true
            });
          }

          throw err;
        }
      },
      cache: true
    },

    'user-id': {
      key: () => params.steamId ? `user-id-${params.steamId}` : 'user-id-unknown',
      handler: async () => {
        if (!params.steamId) {
          return null;
        }

        const users = await User.query(supabase, [
          { filter: 'eq', params: [User.fields.steamId, params.steamId] },
          { filter: 'limit', params: [1] }
        ]);
        if (users?.length > 0) {
          return users[0].id;
        }

        return null;
      },
      cache: true
    },

    'user-stats': {
      key: () => params.id ? `user-stats-${params.id}` : 'user-stats-unknown',
      handler: async () => {
        if (!params.id) {
          return null;
        }

        const user = new User(params.id);
        return user.getStatistics();
      },
      cache: true
    },

    'user-trades-with-partner': {
      key: () => params.partnerId ? `user-trades-with-${params.partnerId}` : 'user-trades-with-unknown',
      handler: async () => {
        if (!isLoggedIn || !params.partnerId || authUser.id === params.partnerId) {
          return null;
        }

        const user = new User(authUser.id);
        return user.getTotalTradesWithUser(params.partnerId);
      },
      cache: true
    },

    'user-partners': {
      key: () => `user-partners-${params.id}`,
      handler: async () => {
        const user = new User(params.id);
        return user.getTradePartners();
      },
      cache: true
    },

    'user-review': {
      key: () => params.subjectId ? `user-review-${params.subjectId}` : 'user-review-unknown',
      handler: async () => {
        if (!params.subjectId) {
          return null;
        }

        const reviews = await Review.query(supabase, [
          { filter: 'eq', params: [Review.fields.subjectId, params.subjectId] },
          { filter: 'eq', params: [Review.fields.userId, authUser.id] }
        ]);
        if (reviews.length) {
          return reviews[0].toObject();
        }

        return {
          ...new Review().toObject(),
          userId: authUser.id,
          subjectId: params.subjectId
        };
      },
      cache: false
    },

    'trade': {
      key: () => params.id ? `trade-${params.id}` : 'trade-unknown',
      handler: async () => {
        if (!params.id) {
          return null;
        }

        try {
          const instance = new Trade(params.id);
          await instance.load();
          return instance.toObject();
        } catch (err) {
          if (err.code === 'PGRST116') {
            throw createError({
              statusCode: 404,
              statusMessage: 'Trade not found',
              message: 'The trade you are looking for does not exist',
              fatal: true
            });
          }

          throw err;
        }
      },
      cache: false
    },

    'trade-apps': {
      key: () => params.id ? `trade-apps-${params.id}` : 'trade-apps-unknown',
      handler: async () => {
        if (!params.id) {
          return { sender: [], receiver: [] };
        }

        const instance = new Trade(params.id);
        const apps = await instance.getApps(true);
        return {
          sender: apps.filter(app => app.trade.senderId === app.userId),
          receiver: apps.filter(app => app.trade.receiverId === app.userId)
        };
      },
      cache: false
    },

    'trade-views': {
      key: () => params.id ? `trade-views-${params.id}` : 'trade-views-unknown',
      handler: async () => {
        if (!params.id) {
          return [];
        }

        const instance = new Trade(params.id);
        return instance.getViews(true);
      },
      cache: false
    },

    'my-recent-trades': {
      key: () => 'my-recent-trades',
      handler: async () => {
        if (!isLoggedIn) {
          return [];
        }

        return Trade.query(supabase, [
          {
            filter: 'or',
            params: [`${Trade.fields.senderId}.eq.${authUser.id},${Trade.fields.receiverId}.eq.${authUser.id}`]
          },
          { filter: 'order', params: [Trade.fields.createdAt, { ascending: false }] },
          { filter: 'limit', params: [params.limit || 10] }
        ]);
      },
      cache: false
    },

    'vault-counts': {
      key: () => 'vault-counts',
      handler: async () => {
        const { VaultEntry, App } = useORM();
        const baseQuery = () => supabase
          .from(App.table)
          .select(`*,
            ${VaultEntry.table}!inner(
              ${VaultEntry.fields.userId},
              ${VaultEntry.fields.tradeId}
            ),
            ${Trade.apps.table}!inner(
              ${Trade.apps.fields.appId},
              ${Trade.apps.fields.tradeId},
              ${Trade.apps.fields.selected},
              ${Trade.apps.fields.userId}
            )
          `, { count: 'exact', head: true })
          .eq(`${VaultEntry.table}.${VaultEntry.fields.userId}`, authUser.id);

        const [unsent, sent, received] = await Promise.all([
          baseQuery().is(`${VaultEntry.table}.${VaultEntry.fields.tradeId}`, null),
          baseQuery()
            .not(`${VaultEntry.table}.${VaultEntry.fields.tradeId}`, 'is', null)
            .eq(`${Trade.apps.table}.${Trade.apps.fields.selected}`, true)
            .eq(`${Trade.apps.table}.${Trade.apps.fields.userId}`, authUser.id),
          baseQuery()
            .not(`${VaultEntry.table}.${VaultEntry.fields.tradeId}`, 'is', null)
            .eq(`${Trade.apps.table}.${Trade.apps.fields.selected}`, true)
            .neq(`${Trade.apps.table}.${Trade.apps.fields.userId}`, authUser.id)
        ]);

        return {
          unsent: unsent.count || 0,
          sent: sent.count || 0,
          received: received.count || 0
        };
      },
      cache: false
    },

    'collection': {
      key: () => params.id ? `collection-${params.id}` : 'collection-unknown',
      handler: async () => {
        if (!params.id) {
          return null;
        }

        try {
          const instance = new Collection(params.id);
          await instance.load();
          return instance.toObject();
        } catch (err) {
          if (err.code === 'PGRST116') {
            throw createError({
              statusCode: 404,
              statusMessage: 'Collection not found',
              message: 'The collection you are looking for does not exist',
              fatal: true
            });
          }

          throw err;
        }
      },
      cache: false
    },

    'master-collections': {
      key: () => params.userId ? `master-collections-${params.userId}` : 'master-collections-unknown',
      handler: async () => {
        if (!params.userId) {
          return [];
        }

        const masterTypes = [
          Collection.enums.type.library,
          Collection.enums.type.wishlist,
          Collection.enums.type.blacklist,
          Collection.enums.type.tradelist
        ];

        const collections = await Promise.all(masterTypes.map(async (type) => {
          const masterCollection = await Collection.getMasterCollection(supabase, params.userId, type);
          return masterCollection ? masterCollection.toObject() : null;
        }));

        return collections.filter(Boolean);
      },
      cache: false,
      defaultOptions: {
        default: () => []
      }
    },

    'collection-subcollections': {
      key: () => params.id ? `collection-subcollections-${params.id}` : 'collection-subcollections-unknown',
      handler: async () => {
        if (!params.id) {
          return [];
        }

        const instance = new Collection(params.id);
        const subcollections = await instance.getSubcollections();
        // await Promise.all(subcollections.map(async (sub) => sub.load()));
        return subcollections.map(instance => instance.toObject());
      },
      cache: false,
      defaultOptions: {
        default: () => []
      }
    },

    'messages': {
      // TODO: Add pagination
      key: () => params.tradeId ? `messages-${params.tradeId}` : 'messages-unknown',
      handler: async () => {
        if (!params.tradeId) {
          return [];
        }

        return TradeMessage.query(supabase, [
          { filter: 'eq', params: [TradeMessage.fields.tradeId, params.tradeId] },
          { filter: 'order', params: [TradeMessage.fields.createdAt, { ascending: true }] }
        ]);
      },
      cache: false
    },

    'steamdeck-compatibility': {
      key: () => params.appid ? `steamdeck-compatibility-${params.appid}` : 'steamdeck-compatibility-unknown',
      handler: async () => {
        if (!params.appid) {
          return null;
        }

        const { error, data } = await supabase.functions.invoke('steamdeck-compatibility-report', {
          body: { appid: params.appid }
        });
        if (error) {
          throw error;
        }

        return data;
      },
      cache: true,
      defaultOptions: {
        immediate: false
      }
    },

    'app': {
      key: () => params.id ? `app-${params.id}` : 'app-unknown',
      handler: async () => {
        const instance = new App(params.id);
        if (!params.id) {
          return instance.toObject();
        }

        try {
          await instance.load();
          return instance.toObject();
        } catch (err) {
          if (err.code === 'PGRST116') {
            return instance.toObject();
          }

          throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
            message: 'An error occurred while loading the app',
            fatal: true
          });
        }
      },
      cache: true
    },

    'total-users': {
      key: () => 'total-users',
      handler: async () => {
        const { count } = await supabase
          .from(User.table)
          .select('', { count: 'exact', head: true });
        return count;
      },
      cache: true
    },

    'leaderboard-top3': {
      key: () => params.stat ? `leaderboard-top3-${params.stat}` : 'leaderboard-top3-unknown',
      handler: async () => {
        if (!params.stat) {
          return [];
        }

        const { data, error } = await supabase
          .from(User.statistics.table)
          .select(`
            ${User.statistics.fields.userId},
            ${params.stat},
            ${User.statistics.fields.totalUniqueTrades},
            ${User.statistics.fields.totalDeclinedTrades},
            ${User.statistics.fields.totalReviewsReceived},
            ${User.statistics.fields.avgSpeed}
          `)
          .order(params.stat, { ascending: false, nullsFirst: false })
          .order(`${User.statistics.fields.totalUniqueTrades}`, { ascending: false, nullsFirst: false })
          .limit(3);
        if (error) {
          throw error;
        }

        return data.map(record => User.fromDB(record, User.statistics.fields));
      },
      cache: true
    },

    'active-bundles': {
      key: () => 'active-bundles',
      handler: async () => {
        const { data, error } = await supabase
          .from(Collection.table)
          .select(`*,
            parents:${Collection.relations.table}!${Collection.relations.fields.collectionId}(${Collection.relations.fields.parentId}),
            subcollections:${Collection.relations.table}!${Collection.relations.fields.parentId}(
              collection:${Collection.table}!${Collection.relations.fields.collectionId}(*)
            )`)
          .eq(Collection.fields.type, Collection.enums.type.bundle)
          .or(`${Collection.fields.endsAt}.is.null,${Collection.fields.endsAt}.gt.${new Date().toISOString()}`)
          .order(Collection.fields.endsAt, { ascending: true, nullsFirst: false });

        if (error) {
          throw error;
        }

        // Filter to only parent bundles (no parents) and transform
        return (data || [])
          .filter(bundle => !bundle.parents || bundle.parents.length === 0)
          .slice(0, 10)
          .map(bundle => ({
            ...bundle,
            subcollections: bundle.subcollections?.map(s => s.collection).filter(Boolean) || [],
            parents: undefined // Clean up the parents field
          }));
      },
      cache: true,
      defaultOptions: {
        default: () => []
      }
    }
  };

  const source = sources[name];
  if (!source) {
    throw new Error(`Unknown data definition: ${name}`);
  }

  return useAsyncData(source.key(), source.handler, {
    lazy: true,
    server: false,
    deep: true,
    dedupe: 'defer', // reuse in-flight request
    getCachedData: source.cache ? (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key] : undefined,
    ...source.defaultOptions,
    ...options
  });
};
