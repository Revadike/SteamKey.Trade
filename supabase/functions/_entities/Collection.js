import { FunctionsHttpError } from '@supabase/supabase-js';
import { Entity } from './BaseEntity.js';
import { App } from './App.js';
import { User } from './User.js';

export class Collection extends Entity {
  static get table() {
    return 'collections';
  }

  static get fields() {
    return Object.freeze({
      id: 'id',
      private: 'private',
      userId: 'user_id',
      type: 'type',
      master: 'master',
      title: 'title',
      description: 'description',
      links: 'links',
      startsAt: 'starts_at',
      endsAt: 'ends_at',
      updatedAt: 'updated_at',
      createdAt: 'created_at'
    });
  }

  static get relations() {
    return Object.freeze({
      table: 'collection_relations',
      fields: Object.freeze({
        collectionId: 'collection_id',
        parentId: 'parent_id'
      })
    });
  }

  static get apps() {
    return Object.freeze({
      table: 'collection_apps',
      fields: Object.freeze({
        collectionId: 'collection_id',
        appId: 'app_id',
        source: 'source',
        createdAt: 'created_at'
      })
    });
  }

  static get tags() {
    return Object.freeze({
      table: 'collection_tags',
      fields: Object.freeze({
        collectionId: 'collection_id',
        appId: 'app_id',
        tagId: 'tag_id',
        body: 'body',
        createdAt: 'created_at'
      })
    });
  }

  static get enums() {
    return Object.freeze({
      type: {
        app: 'app',
        blacklist: 'blacklist',
        bundle: 'bundle',
        custom: 'custom',
        giveaway: 'giveaway',
        library: 'library',
        steamBundle: 'steambundle',
        steamPackage: 'steampackage',
        tradelist: 'tradelist',
        wishlist: 'wishlist'
      },
      source: {
        user: 'user',
        sync: 'sync'
      }
    });
  }

  static get labels() {
    return Object.freeze({
      ...super.labels,
      app: 'App',
      blacklist: 'Blacklist',
      bundle: 'Bundle',
      custom: 'Custom',
      giveaway: 'Giveaway',
      library: 'Library',
      steambundle: 'Steam Bundle',
      steamBundle: 'Steam Bundle',
      steampackage: 'Steam Package',
      steamPackage: 'Steam Package',
      tradelist: 'Tradelist',
      wishlist: 'Wishlist',
      apps: 'Apps',
      subcollections: 'Subcollections'
    });
  }

  static get icons() {
    return Object.freeze({
      app: 'mdi-gamepad-variant-outline',
      blacklist: 'mdi-block-helper',
      bundle: 'mdi-package-variant-closed',
      custom: 'mdi-pencil-circle-outline',
      giveaway: 'mdi-gift-outline',
      library: 'mdi-bookshelf',
      steambundle: 'mdi-steam',
      steampackage: 'mdi-steam',
      tradelist: 'mdi-swap-horizontal-circle-outline',
      wishlist: 'mdi-heart-circle-outline'
    });
  }

  static get schema() {
    return Object.freeze({
      type: 'object',
      required: ['id', 'type', 'title'],
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
          title: 'ID',
          description: 'The unique identifier of the collection.'
        },
        private: {
          type: 'boolean',
          default: false,
          title: 'Private',
          description: 'Whether the collection is private.'
        },
        userId: {
          type: 'string',
          format: 'uuid',
          title: 'Created By',
          description: 'The ID of the user who owns this collection.'
        },
        type: {
          type: 'string',
          enum: Object.values(this.enums.type),
          title: 'Type',
          description: 'The type of collection.'
        },
        master: {
          type: 'boolean',
          default: false,
          title: 'Master',
          description: 'Indicates whether this is a master collection.'
        },
        title: {
          type: 'string',
          title: 'Title',
          description: 'The title of the collection.'
        },
        description: {
          type: 'string',
          nullable: true,
          title: 'Description',
          description: 'A description of the collection.'
        },
        links: {
          type: 'object',
          nullable: true,
          title: 'External Links',
          description: 'Additional links related to the collection.'
        },
        startsAt: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          title: 'Starts At',
          description: 'When this collection begins, e.g. for giveaways or bundles.'
        },
        endsAt: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          title: 'Ends At',
          description: 'When this collection ends, e.g. for giveaways or bundles.'
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          title: 'Updated At',
          description: 'Timestamp when the collection was last updated.'
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          title: 'Created At',
          description: 'The date when the collection was created.'
        }
      }
    });
  }

  async syncWithSteam() {
    if (!this.master) {
      throw new Error('Cannot sync non-master collection');
    }

    if (![
      Collection.enums.type.wishlist,
      Collection.enums.type.library
    ].includes(this.type)) {
      throw new Error('Cannot sync collection of this type');
    }

    const { error } = await this._client.functions.invoke('steam-sync', {
      body: { type: this.type, userId: this.userId }
    });

    if (error) {
      if (error instanceof FunctionsHttpError) {
        const message = await error.context.json();
        throw new Error(message.error);
      }

      throw error;
    }
  }

  /**
   * Recursively get all subcollections of this collection.
   * @param {boolean} [deep=false] - Whether to get subcollections recursively.
   * @returns {Promise<Collection[]>} The subcollections. Note these are unloaded, use `load()` to load the data.
   */
  async getSubcollections(deep = false) {
    const { table, fields } = Collection.relations;
    const { data, error } = await this._client
      .from(table)
      .select(fields.collectionId)
      .eq(fields.parentId, this.id);

    if (error) {
      throw error;
    }

    const subcollections = data.map(item => new Collection(this._client, item[fields.collectionId]));
    if (!deep) {
      return subcollections;
    }

    for (const subcollection of subcollections) {
      const subsubcollections = await subcollection.getSubcollections(deep);
      subcollections.push(...subsubcollections);
    }

    return subcollections;
  }

  /**
   * Add a subcollection to this collection.
   * @param {Collection} subcollection - The subcollection to add.
   * @returns {Promise<boolean>} Whether the subcollection was added.
   * @throws Will throw an error if the subcollection cannot be added.
   */
  async addSubcollection(subcollection) {
    if (!(subcollection instanceof Collection)) {
      throw new Error('Invalid subcollection');
    }

    if (subcollection.id === this.id) {
      throw new Error('Cannot add self as subcollection');
    }

    const { error } = await this._client
      .from(Collection.relations.table)
      .insert({
        [Collection.relations.fields.collectionId]: subcollection.id,
        [Collection.relations.fields.parentId]: this.id
      });

    if (error) {
      throw error;
    }

    await this.refreshUpdatedAt();
    return true;
  }

  /**
   * Remove a subcollection from this collection.
   * @param {Collection} subcollection - The subcollection to remove.
   * @returns {Promise<boolean>} Whether the subcollection was removed.
   * @throws Will throw an error if the subcollection cannot be removed.
   */
  async removeSubcollection(subcollection) {
    if (!(subcollection instanceof Collection)) {
      throw new Error('Invalid subcollection');
    }

    const { error } = await this._client
      .from(Collection.relations.table)
      .delete()
      .eq(Collection.relations.fields.collectionId, subcollection.id)
      .eq(Collection.relations.fields.parentId, this.id);

    if (error) {
      throw error;
    }

    return true;
  }

  // TODO: Only returns max 1000 results. Remove this? Make a postgresql view instead?
  /**
   * Get all apps in this collection.
   * @param {Object} [options] - Options for fetching apps.
   * @param {boolean} [options.includeDetails=false] - Whether to include app details.
   * @param {boolean} [options.includeSubcollections=false] - Whether to include apps from subcollections.
   * @param {boolean} [options.includeTags=false] - Whether to include tags.
   * @returns {Promise<Object[]>} The apps in this collection
   */
  async getApps({
    includeDetails = false,
    includeSubcollections = false,
    includeTags = false
  } = {}) {
    const collectionIds = [this.id];
    if (includeSubcollections) {
      const subcollections = await this.getSubcollections(true);
      collectionIds.push(...subcollections.map(subcollection => subcollection.id));
    }

    const { data: apps, error: appsError } = await this._client
      .from(Collection.apps.table)
      .select('*')
      .in(Collection.apps.fields.collectionId, collectionIds);

    if (appsError) {
      throw appsError;
    }

    let appDetails = [];
    if (includeDetails && apps.length > 0) {
      const appIds = apps.map(app => app.app_id);
      appDetails = await App.query(this._client, [{
        filter: 'in',
        params: [App.fields.id, appIds]
      }]);
    }

    let tags = [];
    if (includeTags && apps.length > 0) {
      const { data: tagsData, error: tagsError } = await this._client
        .from(Collection.tags.table)
        .select('*')
        .in(Collection.tags.fields.collectionId, collectionIds);

      if (tagsError) {
        throw tagsError;
      }

      tags = this.constructor.fromDB(tagsData, Collection.tags.fields);
    }

    return apps.map(app => ({
      ...Collection.fromDB(app, Collection.apps.fields),
      ...(includeDetails ? { details: appDetails.find(({ id }) => id === app.app_id) } : {}),
      ...(includeTags ? { tags: tags.filter(tag => tag.appId === app.app_id && tag.collectionId === app.collection_id) } : {})
    }));
  }

  /**
   * Add apps to this collection.
   * @param {Number[]|String[]} appIds - The collection app IDs to add.
   * @param {string} [source='user'] - The source of the apps.
   * @param {boolean} [onlyInsert=false] - Whether to only insert the apps.
   * @returns {Promise<boolean>} Whether the apps were added
   * @throws Will throw an error if the apps cannot be added.
   */
  async addApps(appIds, source = Collection.enums.source.user, onlyInsert = false) {
    if (!appIds || !Array.isArray(appIds)) {
      throw new Error('No apps to add');
    }

    if (appIds.length === 0) {
      return true;
    }

    if (!Object.values(Collection.enums.source).includes(source)) {
      throw new Error('Invalid source');
    }

    const records = appIds.map(appId => (this.constructor.toDB({
      collectionId: this.id,
      appId: Number(appId),
      source
    }, Collection.apps.fields)));

    if (onlyInsert) {
      const { error } = await this._client.rpc('bulk_insert', {
        p_table: Collection.apps.table,
        p_records: records
      });

      if (error) {
        if (error.code === '23505') {
          throw new Error('App already exists in collection');
        }

        throw error;
      }
    } else {
      const batchSize = 1000;

      // Split into batches for better performance
      for (let i = 0; i < records.length; i += batchSize) {
        const batchRecords = records.slice(i, i + batchSize);
        const { error } = await this._client
          .from(Collection.apps.table)
          .upsert(batchRecords, {
            ignoreDuplicates: true
          });

        if (error) {
          throw error;
        }
      }
    }

    await this.refreshUpdatedAt();
    return true;
  }

  /**
   * Remove apps from this collection.
   * @param {string[]|number[]} appIds - The IDs of the apps to remove.
   * @returns {Promise<boolean>} Whether the apps were removed.
   * @throws Will throw an error if the apps cannot be removed.
   */
  async removeApps(appIds) {
    if (!appIds || !Array.isArray(appIds)) {
      throw new Error('No apps to remove');
    }

    if (appIds.length === 0) {
      return true;
    }

    const { error } = await this._client.rpc('bulk_remove_collection_apps', {
      p_collection_id: this.id,
      p_apps: appIds
    });

    if (error) {
      if (error instanceof FunctionsHttpError) {
        const message = await error.context.json();
        throw new Error(message.error);
      }

      throw error;
    }

    await this.refreshUpdatedAt();
    return true;
  }

  /**
   * Empty all apps from this collection.
   * @returns {Promise<boolean>} Whether the apps were emptied.
   * @throws Will throw an error if the apps cannot be emptied.
   */
  async empty() {
    const { error } = await this._client
      .from(Collection.apps.table)
      .delete()
      .eq(Collection.apps.fields.collectionId, this.id);

    if (error) {
      throw error;
    }

    await this.refreshUpdatedAt();
    return true;
  }

  /**
   * Refreshes the `updated_at` timestamp of the collection to the current time.
   * @returns {Promise<boolean>} Whether the timestamp was refreshed.
   * @throws Will throw an error if the timestamp cannot be refreshed.
   */
  async refreshUpdatedAt() {
    const { error } = await this._client
      .from(Collection.table)
      .update({ [Collection.fields.updatedAt]: new Date().toISOString() })
      .eq(Collection.fields.id, this.id);

    if (error) {
      throw error;
    }

    return true;
  }

  /**
   * Get a master collection by type.
   * @param {import('@supabase/supabase-js').SupabaseClient} supabase - The Supabase client.
   * @param {string} userId - The ID of the user.
   * @param {string} type - The type of collection.
   * @returns {Promise<Collection|null>} The master collection, or null if not found.
   */
  static async getMasterCollection(supabase, userId, type) {
    if (!supabase || !userId || !type) {
      throw new Error('Missing required parameters');
    }

    if (![
      this.enums.type.tradelist,
      this.enums.type.wishlist,
      this.enums.type.library,
      this.enums.type.blacklist
    ].includes(type)) {
      throw new Error('Invalid collection type');
    }

    const { data, error } = await supabase
      .from(this.table)
      .select('*')
      .eq(this.fields.userId, userId)
      .eq(this.fields.master, true)
      .eq(this.fields.type, type);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return null;
    }

    return new Collection(supabase, this.fromDB(data[0]));
  }

  static getMasterLibrary(supabase, userId) {
    return this.getMasterCollection(supabase, userId, this.enums.type.library);
  }

  static getMasterTradelist(supabase, userId) {
    return this.getMasterCollection(supabase, userId, this.enums.type.tradelist);
  }

  static getMasterWishlist(supabase, userId) {
    return this.getMasterCollection(supabase, userId, this.enums.type.wishlist);
  }

  static getMasterBlacklist(supabase, userId) {
    return this.getMasterCollection(supabase, userId, this.enums.type.blacklist);
  }

  /**
   * Get all app IDs of the user master collection.
   * @param {import('@supabase/supabase-js').SupabaseClient} supabase - The Supabase client.
   * @param {string} userId - The ID of the user.
   * @param {string} source - The source of the apps.
   * @returns {Promise<Object[]>} The app IDs list per collection type.
   */
  static async getMasterCollectionsApps(supabase, userId, source) {
    if (!supabase || !userId) {
      throw new Error('Missing required parameters');
    }

    if (source && !Object.values(Collection.enums.source).includes(source)) {
      throw new Error('Invalid source');
    }

    const { data, error } = await supabase
      .rpc('get_master_collections_apps', {
        p_user_id: userId,
        p_source: source
      })
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return data;
  }

  /**
   * Get filtered app IDs of the user collections.
   * @param {import('@supabase/supabase-js').SupabaseClient} supabase - The Supabase client.
   * @param {Object} [options] - Options for filtering apps.
   * @param {string[]} [options.onlyCollectionIds] - Only include apps from these collection IDs.
   * @param {string[]} [options.excludeCollectionIds] - Exclude apps from these collection IDs.
   * @param {boolean} [options.anyCollections=false] - Whether to use OR instead of AND when filtering by multiple collection IDs.
   * @param {number[]} [options.includeAppIds] - Include these app IDs in addition to collection filters.
   * @returns {Promise<Object[]>} The filtered app IDs list.
   */
  static getCollectionFilteredApps(supabase, {
    onlyCollectionIds = null,
    excludeCollectionIds = null,
    anyCollections = false,
    includeAppIds = null
  } = {}) {
    if (!supabase) {
      throw new Error('Missing required parameters');
    }

    if ([onlyCollectionIds, excludeCollectionIds, includeAppIds].some(ids => ids && !Array.isArray(ids))) {
      throw new Error('Invalid collection IDs');
    }

    return supabase.rpc('get_collection_filtered_apps', {
      p_only_collection_ids: onlyCollectionIds,
      p_exclude_collection_ids: excludeCollectionIds,
      p_any_collections: Boolean(anyCollections),
      p_include_app_ids: includeAppIds
    });
  }

  /**
   * Create a master collection.
   * @param {import('@supabase/supabase-js').SupabaseClient} supabase - The Supabase client.
   * @param {string} userId - The ID of the user.
   * @param {string} type - The type of collection.
   * @returns {Promise<Collection>} The created master collection.
   * @throws Will throw an error if the master collection cannot be created (e.g. already exists).
   */
  static async createMasterCollection(supabase, userId, type) {
    if (!supabase || !userId || !type) {
      throw new Error('Missing required parameters');
    }

    if (![
      this.enums.type.tradelist,
      this.enums.type.wishlist,
      this.enums.type.library,
      this.enums.type.blacklist
    ].includes(type)) {
      throw new Error('Invalid collection type');
    }

    try {
      const user = new User(supabase, userId);
      await user.load();

      let title, description, links;
      switch (type) {
        case this.enums.type.tradelist:
          title = `${user.displayName || user.steamId}'s tradelist`;
          description = 'Everything I have for trade';
          links = [];
          break;
        case this.enums.type.wishlist:
          title = `${user.displayName || user.steamId}'s wishlist`;
          description = 'Everything I want to have';
          links = [{
            title: 'Steam Wishlist',
            icon: 'mdi-steam',
            url: `https://store.steampowered.com/wishlist/profiles/${user.steamId}`
          }];
          break;
        case this.enums.type.library:
          title = `${user.displayName || user.steamId}'s library`;
          description = 'Everything I own';
          links = [{
            title: 'Steam Library',
            icon: 'mdi-steam',
            url: `https://steamcommunity.com/profiles/${user.steamId}/games/?tab=all`
          }, {
            title: 'SteamDB Calculator',
            icon: 'icon-steamdb',
            url: `https://steamdb.info/calculator/${user.steamId}?all_games`
          }];
          break;
        case this.enums.type.blacklist:
          title = `${user.displayName || user.steamId}'s blacklist`;
          description = 'Everything I don\'t want';
          links = [];
          break;
        default:
          break;
      }

      const collection = new Collection(supabase, {
        private: false,
        userId,
        type,
        master: true,
        title,
        description,
        links
      });

      await collection.save();
      return collection;
    } catch (error) {
      error.error = error.message;
      error.type = type;
      error.userId = userId;
      error.message = 'Failed to create master collection';
      throw error;
    }
  }
}
