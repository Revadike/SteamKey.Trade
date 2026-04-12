import { Entity } from './BaseEntity.js';

export class App extends Entity {
  static get table() {
    return 'apps';
  }

  static get fields() {
    return Object.freeze({
      id: 'id',
      changeNumber: 'change_number',
      parentId: 'parent_id',
      title: 'title',
      altTitles: 'alt_titles',
      type: 'type',
      description: 'description',
      developers: 'developers',
      publishers: 'publishers',
      tags: 'tags',
      languages: 'languages',
      platforms: 'platforms',
      website: 'website',
      free: 'free',
      plusOne: 'plus_one',
      exfgls: 'exfgls',
      steamdeck: 'steamdeck',
      header: 'header',
      screenshots: 'screenshots',
      videos: 'videos',
      positiveReviews: 'positive_reviews',
      negativeReviews: 'negative_reviews',
      cards: 'cards',
      achievements: 'achievements',
      bundles: 'bundles',
      giveaways: 'giveaways',
      libraries: 'libraries',
      wishlists: 'wishlists',
      tradelists: 'tradelists',
      blacklists: 'blacklists',
      steamPackages: 'steam_packages',
      steamBundles: 'steam_bundles',
      retailPrice: 'retail_price',
      discountedPrice: 'discounted_price',
      marketPrice: 'market_price',
      historicalLow: 'historical_low',
      removedAs: 'removed_as',
      removedAt: 'removed_at',
      releasedAt: 'released_at',
      updatedAt: 'updated_at',
      createdAt: 'created_at',
      searchText: 'search_text',
      wilsonScore: 'wilson_score'
    });
  }

  static get searchFields() {
    return Object.freeze({
      query: 'query',
      id: 'id',
      title: 'title',
      altTitles: 'alt_titles',
      header: 'header',
      type: 'type',
      confidence: 'confidence'
    });
  }

  static get enums() {
    return Object.freeze({
      type: {
        unknown: 'unknown',
        advertising: 'advertising',
        application: 'application',
        beta: 'beta',
        comic: 'comic',
        config: 'config',
        demo: 'demo',
        depotonly: 'depotonly',
        DLC: 'dlc',
        driver: 'driver',
        episode: 'episode',
        franchise: 'franchise',
        game: 'game',
        guide: 'guide',
        hardware: 'hardware',
        media: 'media',
        mod: 'mod',
        movie: 'movie',
        music: 'music',
        plugin: 'plugin',
        series: 'series',
        shortcut: 'shortcut',
        software: 'software',
        tool: 'tool',
        video: 'video'
      }
    });
  }

  static get schema() {
    return Object.freeze({
      type: 'object',
      required: ['id', 'type'],
      properties: {
        id: {
          type: 'integer',
          title: 'AppID',
          description: 'The unique identifier of the app.'
        },
        changeNumber: {
          type: 'integer',
          nullable: true,
          title: 'Change Number',
          description: 'The latest change number for the app.'
        },
        parentId: {
          type: 'integer',
          nullable: true,
          title: 'Parent App',
          description: 'The ID of the parent app, if applicable.'
        },
        title: {
          type: 'string',
          title: 'Title',
          description: 'The title of the app.'
        },
        altTitles: {
          type: 'array',
          items: { type: 'string' },
          nullable: true,
          title: 'Alternative Titles',
          description: 'Other names the app may be known by.'
        },
        type: {
          type: 'string',
          enum: Object.values(this.enums.type),
          title: 'Type',
          description: 'The type of application.'
        },
        description: {
          type: 'string',
          nullable: true,
          title: 'Description',
          description: 'A description of the app.'
        },
        developers: {
          type: 'array',
          items: { type: 'string' },
          nullable: true,
          title: 'Developers',
          description: 'The developers of the app.'
        },
        publishers: {
          type: 'array',
          items: { type: 'string' },
          nullable: true,
          title: 'Publishers',
          description: 'The publishers of the app.'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          nullable: true,
          title: 'Tags',
          description: 'Tags associated with the app.'
        },
        languages: {
          type: 'array',
          items: { type: 'string' },
          nullable: true,
          title: 'Languages',
          description: 'Languages supported by the app.'
        },
        platforms: {
          type: 'array',
          items: { type: 'string' },
          nullable: true,
          title: 'Platforms',
          description: 'Platforms the app is available on.'
        },
        website: {
          type: 'string',
          nullable: true,
          title: 'Website',
          description: 'The official website of the app.'
        },
        free: {
          type: 'boolean',
          nullable: true,
          title: 'Free',
          description: 'Indicates if the app is free to play.'
        },
        plusOne: {
          type: 'boolean',
          nullable: true,
          title: '+1',
          description: 'Indicates if the app has a "+1" effect in libraries.'
        },
        exfgls: {
          type: 'boolean',
          nullable: true,
          title: 'Family Sharing',
          description: 'Indicates if Family Sharing is enabled.'
        },
        steamdeck: {
          type: 'string',
          nullable: true,
          title: 'Deck Compatibility',
          description: 'Compatibility status for Steam Deck.'
        },
        header: {
          type: 'string',
          nullable: true,
          title: 'Header Image',
          description: 'The header image for the app.'
        },
        screenshots: {
          type: 'array',
          items: { type: 'string' },
          nullable: true,
          title: 'Screenshots',
          description: 'Screenshots related to the app.'
        },
        videos: {
          type: 'array',
          items: { type: 'string' },
          nullable: true,
          title: 'Movies',
          description: 'Videos related to the app.'
        },
        positiveReviews: {
          type: 'integer',
          nullable: true,
          title: 'Positive Reviews',
          description: 'The number of positive reviews.'
        },
        negativeReviews: {
          type: 'integer',
          nullable: true,
          title: 'Negative Reviews',
          description: 'The number of negative reviews.'
        },
        cards: {
          type: 'integer',
          nullable: true,
          title: 'Trading Cards',
          description: 'The number of trading cards available.'
        },
        achievements: {
          type: 'integer',
          nullable: true,
          title: 'Achievements',
          description: 'The number of achievements available.'
        },
        bundles: {
          type: 'integer',
          nullable: true,
          title: 'Bundles',
          description: 'The number of bundles available.'
        },
        giveaways: {
          type: 'integer',
          nullable: true,
          title: 'Giveaways',
          description: 'The number of giveaways available.'
        },
        libraries: {
          type: 'integer',
          nullable: true,
          title: 'Libraries',
          description: 'The number of libraries associated with the app.'
        },
        wishlists: {
          type: 'integer',
          nullable: true,
          title: 'Wishlists',
          description: 'The number of wishlists associated with the app.'
        },
        tradelists: {
          type: 'integer',
          nullable: true,
          title: 'Tradelists',
          description: 'The number of tradelists associated with the app.'
        },
        blacklists: {
          type: 'integer',
          nullable: true,
          title: 'Blacklists',
          description: 'The number of blacklists associated with the app.'
        },
        steamPackages: {
          type: 'integer',
          nullable: true,
          title: 'Steam Packages',
          description: 'The number of Steam packages associated with the app.'
        },
        steamBundles: {
          type: 'integer',
          nullable: true,
          title: 'Steam Bundles',
          description: 'The number of Steam bundles associated with the app.'
        },
        retailPrice: {
          type: 'number',
          nullable: true,
          title: 'Retail Price',
          description: 'The retail price of the app.'
        },
        discountedPrice: {
          type: 'number',
          nullable: true,
          title: 'Discounted Price',
          description: 'The discounted price of the app.'
        },
        marketPrice: {
          type: 'number',
          nullable: true,
          title: 'Market Price',
          description: 'The market price of the app.'
        },
        historicalLow: {
          type: 'number',
          nullable: true,
          title: 'Historical Low',
          description: 'The historical low price of the app.'
        },
        removedAs: {
          type: 'string',
          nullable: true,
          title: 'Delisted Category',
          description: 'The reason why the app was delisted.'
        },
        removedAt: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          title: 'Delisted Date',
          description: 'The date when the app was removed from the store.'
        },
        releasedAt: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          title: 'Release Date',
          description: 'The official release date of the app.'
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          title: 'Updated At',
          description: 'Timestamp when the app was last updated.'
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          title: 'Created At',
          description: 'The date when the app was added to the database.'
        },
        searchText: {
          type: 'string',
          nullable: true,
          title: 'Search Text',
          description: 'The normalized title text used for full-text search.'
        },
        wilsonScore: {
          type: 'number',
          nullable: true,
          title: 'Wilson Score',
          description: 'Confidence-adjusted score derived from positive and negative reviews.'
        }
      }
    });
  }

  static get labels() {
    return Object.freeze({
      ...super.labels,
      language: 'Language',
      platform: 'Platform',
      tag: 'Tag',
      developer: 'Developer',
      publisher: 'Publisher',
      unknown: 'Unknown',
      advertising: 'Advertising',
      application: 'Application',
      beta: 'Beta',
      comic: 'Comic',
      config: 'Config',
      demo: 'Demo',
      depotonly: 'Depot Only',
      DLC: 'DLC',
      driver: 'Driver',
      episode: 'Episode',
      franchise: 'Franchise',
      game: 'Game',
      guide: 'Guide',
      hardware: 'Hardware',
      media: 'Media',
      mod: 'Mod',
      movie: 'Movie',
      music: 'Music',
      plugin: 'Plugin',
      series: 'Series',
      shortcut: 'Shortcut',
      software: 'Software',
      tool: 'Tool',
      video: 'Video'
    });
  }

  async queueUpdate() {
    const { error } = await this._client
      .from('updater_queue')
      .insert({
        type: 'app_update',
        value: this.id.toString()
      });

    if (error) {
      throw error;
    }

    return true;
  }

  static async search(supabase, queries, limit = 20) {
    const queryList = (Array.isArray(queries) ? queries : [queries])
      .map(query => `${query ?? ''}`.trim())
      .filter(Boolean);

    if (queryList.length === 0) {
      return [];
    }

    const isSingle = queryList.length === 1;
    const rpc = isSingle ? 'search_app' : 'search_apps';
    const params = isSingle
      ? { p_query: queryList[0], p_limit: limit }
      : { p_queries: queryList, p_limit: limit };

    const { data, error } = await supabase.rpc(rpc, params);

    if (error) {
      throw error;
    }

    return (data || []).map(row => this.fromDB(row, this.searchFields));
  }

  static async getFacets(supabase, field) {
    const { data, error } = await supabase
      .from('app_facets')
      .select(field)
      .single();

    if (error) {
      throw error;
    }

    return field ? data[field] : App.fromDB(data);
  }
}
