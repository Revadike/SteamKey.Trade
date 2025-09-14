import { FunctionsHttpError } from '@supabase/supabase-js';

import { Entity } from './BaseEntity.js';
import countries from '../_assets/countries.json' with { type: 'json' };

export class User extends Entity {
  static get table() {
    return 'users';
  }

  static get fields() {
    return Object.freeze({
      id: 'id',
      steamId: 'steam_id',
      customUrl: 'custom_url',
      displayName: 'display_name',
      avatar: 'avatar',
      background: 'background',
      bio: 'bio',
      region: 'region',
      publicKey: 'public_key',
      updatedAt: 'updated_at',
      createdAt: 'created_at'
    });
  }

  static get credentials() {
    return Object.freeze({
      table: 'credentials',
      fields: Object.freeze({
        userId: 'user_id',
        encryptedData: 'encrypted_data',
        iv: 'iv',
        createdAt: 'created_at'
      })
    });
  }

  static get preferences() {
    return Object.freeze({
      table: 'preferences',
      fields: Object.freeze({
        userId: 'user_id',
        appLinks: 'app_links',
        appColumns: 'app_columns',
        darkMode: 'dark_mode',
        dashboardWidgets: 'dashboard_widgets',
        enabledNotifications: 'enabled_notifications',
        trackVaultCopies: 'track_vault_copies',
        incomingCriteria: 'incoming_criteria',
        updatedAt: 'updated_at',
        createdAt: 'created_at'
      })
    });
  }

  static get notifications() {
    return Object.freeze({
      table: 'notifications',
      fields: Object.freeze({
        id: 'id',
        userId: 'user_id',
        type: 'type',
        link: 'link',
        read: 'read',
        createdAt: 'created_at'
      })
    });
  }

  static get statistics() {
    return Object.freeze({
      table: 'user_statistics',
      fields: Object.freeze({
        userId: 'user_id',
        avgCommunication: 'avg_communication',
        avgFairness: 'avg_fairness',
        avgHelpfulness: 'avg_helpfulness',
        avgSpeed: 'avg_speed',
        lastGivenReview: 'last_given_review_id',
        lastReceivedReview: 'last_received_review_id',
        lastTrade: 'latest_trade_id',
        lastVaultReceived: 'latest_received_app_id',
        totalAbortedTrades: 'trades_aborted',
        totalAcceptedTrades: 'trades_accepted',
        totalBlacklist: 'master_blacklist_apps',
        totalCollections: 'total_collections',
        totalCompletedTrades: 'trades_completed',
        totalCounteredTrades: 'trades_countered',
        totalDeclinedTrades: 'trades_declined',
        totalDisputedTrades: 'trades_disputed',
        totalLibrary: 'master_library_apps',
        totalPendingTrades: 'trades_pending',
        totalReviews: 'total_reviews',
        totalReviewsGiven: 'reviews_given',
        totalReviewsReceived: 'reviews_received',
        totalTradelist: 'master_tradelist_apps',
        totalUniqueTrades: 'completed_trades_distinct_users',
        totalVaultMine: 'vault_entries_mine',
        totalVaultReceived: 'vault_entries_received',
        totalWishlist: 'master_wishlist_apps'
      })
    });
  }

  static get tradePartners() {
    return Object.freeze({
      table: 'trade_partners',
      fields: Object.freeze({
        userId: 'user_id',
        partnerId: 'partner_id',
        totalCompletedTrades: 'total_completed_trades'
      })
    });
  }

  static get enums() {
    return Object.freeze({
      country: countries.reduce((acc, country) => {
        acc[country.alpha2] = country.alpha2;
        return acc;
      }, {}),
      widget: Object.freeze({
        welcome: 'welcome',
        usersOnline: 'users_online',
        stats: 'stats',
        tradeActivity: 'trade_activity'
      }),
      notification: Object.freeze({
        newTrade: 'new_trade',
        acceptedTrade: 'accepted_trade',
        newVaultEntry: 'new_vault_entry',
        unreadMessages: 'unread_messages',
        disputedTrade: 'disputed_trade',
        resolvedTrade: 'resolved_trade'
      })
    });
  }

  static get schema() {
    return Object.freeze({
      type: 'object',
      required: ['id', 'steamId'],
      properties: {
        id: { type: 'string', format: 'uuid', title: 'ID', description: 'The unique identifier of the user.' },
        steamId: { type: 'string', title: 'Steam ID', description: 'The SteamID64 of the linked Steam account.' },
        customUrl: { type: 'string', nullable: true, title: 'Custom URL', description: 'Your unique profile URL.' },
        displayName: { type: 'string', nullable: true, title: 'Display Name', description: 'The name that will be displayed to other users.' },
        avatar: { type: 'string', nullable: true, title: 'Avatar', description: 'Set a custom avatar, or leave blank to use your Steam avatar.' },
        background: { type: 'string', nullable: true, title: 'Background', description: 'Image that will be displayed as the background of your profile.' },
        bio: { type: 'string', nullable: true, title: 'Bio', description: 'A short description of yourself or anything you want to tell other traders.' },
        region: {
          type: 'string',
          enum: Object.values(this.enums.country),
          nullable: true,
          title: 'Region',
          description: 'The Steam account region that will be used to activate product keys on Steam.'
        },
        publicKey: { type: 'string', nullable: true, title: 'Encryption Key', description: 'Public key for vault encryption.' },
        updatedAt: { type: 'string', format: 'date-time', nullable: true, title: 'Modified', description: 'The timestamp when the user was last updated.' },
        createdAt: { type: 'string', format: 'date-time', title: 'Joined', description: 'The date you joined the site.' }
      }
    });
  }

  static get labels() {
    return Object.freeze({
      ...super.labels,
      ...countries.reduce((acc, country) => {
        acc[country.alpha2] = country.name;
        return acc;
      }, {}),

      welcome: 'Welcome',
      stats: 'Statistics',
      tradeActivity: 'Trade Activity',
      usersOnline: 'Users Online',

      newTrade: 'New Trade',
      acceptedTrade: 'Accepted Trade',
      newVaultEntry: 'New Vault Entry',
      unreadMessages: 'Unread Messages',
      disputedTrade: 'Disputed Trade',
      resolvedTrade: 'Resolved Trade',

      avgCommunication: 'Average Communication',
      avgFairness: 'Average Fairness',
      avgHelpfulness: 'Average Helpfulness',
      avgSpeed: 'Average Responsiveness Speed',

      totalAbortedTrades: 'Total Aborted Trades',
      totalAcceptedTrades: 'Total Accepted Trades',
      totalBlacklist: 'Total Apps in Blacklist',
      totalCollections: 'Total Collections',
      totalCompletedTrades: 'Total Completed Trades',
      totalCounteredTrades: 'Total Countered Trades',
      totalDeclinedTrades: 'Total Declined Trades',
      totalDisputedTrades: 'Total Disputed Trades',
      totalLibrary: 'Total Apps in Library',
      totalPendingTrades: 'Total Trades Pending',
      totalReviews: 'Total Reviews',
      totalReviewsGiven: 'Total Reviews Given',
      totalReviewsReceived: 'Total Reviews Received',
      totalTradelist: 'Total Apps in Tradelist',
      totalUniqueTrades: 'Total trades with unique users',
      totalVaultMine: 'My Total Vault Entries',
      totalVaultReceived: 'Total Vault Entries Received',
      totalWishlist: 'Total Apps in Wishlist'
    });
  }

  static get shortLabels() {
    return Object.freeze({
      avgSpeed: 'Speed',
      totalAcceptedTrades: 'Accepted Trades',
      totalCompletedTrades: 'Completed Trades',
      totalDeclinedTrades: 'Declined Trades',
      totalDisputedTrades: 'Disputed Trades',
      totalLibrary: 'Library',
      totalReviewsReceived: 'Reviews Received',
      totalUniqueTrades: 'Unique Trades'
    });
  }

  static get descriptions() {
    return Object.freeze({
      ...super.descriptions,
      newTrade: 'You received a new trade offer',
      acceptedTrade: 'Your trade offer was accepted',
      newVaultEntry: 'You received a new item in your vault',
      unreadMessages: 'You have unread messages',
      disputedTrade: 'Your trade has been disputed',
      resolvedTrade: 'Your trade dispute has been resolved'
    });
  }

  /**
   * Logs in a user with a Steam OpenID login.
   * @param {SupabaseClient} supabase - The Supabase client.
   * @param {string} verify - The OpenID verification URL.
   * @param {string} impersonate - The SteamID64 of the user to impersonate (admin-only).
   * @returns {Promise<User>} The logged-in user.
   * @throws {Error} If the login fails.
   */
  static async login(supabase, verify, impersonate) {
    const { data, error: loginError } = await supabase.functions.invoke('login', {
      body: { verify, impersonate }
    });

    if (loginError) {
      if (loginError instanceof FunctionsHttpError) {
        const message = await loginError.context.json();
        throw new Error(message.error);
      }
      throw loginError;
    }

    const loginToken = data?.loginToken;
    if (!loginToken) {
      throw new Error('Received no login token');
    }

    await supabase.auth.signOut();

    const { data: { user: authUser }, error } = await supabase.auth.verifyOtp({
      token_hash: loginToken,
      type: 'email'
    });

    if (error) {
      throw error;
    }

    return new User(supabase, authUser.id);
  }

  static getNotificationText(type) {
    const normalizedType = Object.entries(this.enums.notification).find(([key, value]) => value === type || key === type);

    if (!normalizedType) {
      throw new Error(`Invalid notification type: ${type}`);
    }

    const [key] = normalizedType;
    return this.descriptions[key];
  }

  /**
   * Gets the user's preferences.
   * @returns {Promise<Object>} The user's preferences.
   * @throws {Error} If the request fails.
   */
  async getPreferences() {
    const { table, fields } = this.constructor.preferences;
    const { data, error } = await this._client
      .from(table)
      .select()
      .eq(fields.userId, this.id)
      .single();

    if (error) {
      throw error;
    }

    return this.constructor.fromDB(data, fields);
  }

  /**
   * Saves the user's preferences.
   * @param {Object} preferences - The user's updated preference values.
   * @returns {Promise<Object>} The updated preferences.
   */
  async savePreferences(preferences) {
    const { table, fields } = this.constructor.preferences;
    const { data, error } = await this._client
      .from(table)
      .upsert({
        ...this.constructor.toDB(preferences, fields),
        [fields.userId]: this.id
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return this.constructor.fromDB(data, fields);
  }

  /**
   * Retrieves user statistics.
   * @returns {Promise<Object>} The user statistics object.
   * @throws {Error} If there is an error retrieving the data from the database.
   */
  async getStatistics() {
    const { table, fields } = this.constructor.statistics;
    const { data, error } = await this._client
      .from(table)
      .select()
      .eq(fields.userId, this.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    const result = this.constructor.fromDB(data, fields);
    delete result.userId;
    return result;
  }

  /**
   * Retrieves the total number of completed trades with a specific user.
   * @param {number} userId - The ID of the trade partner.
   * @returns {Promise<number>} The total number of trades with the specified user.
   * @throws {Error} If there is an error retrieving the data from the database.
   */
  async getTotalTradesWithUser(userId) {
    const { table, fields } = this.constructor.tradePartners;
    const { data, error } = await this._client
      .from(table)
      .select(fields.totalCompletedTrades)
      .or(`${fields.userId}.eq.${this.id},${fields.partnerId}.eq.${this.id}`)
      .or(`${fields.userId}.eq.${userId},${fields.partnerId}.eq.${userId}`)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return { total: data?.[fields.totalCompletedTrades] || 0 };
  }

  /**
   * Retrieves the user's trade partners.
   * @param {number} [top=10] - The number of trade partners to retrieve.
   * @returns {Promise<Array<Object>>} The user's trade partners.
   * @throws {Error} If there is an error retrieving the data from the database.
   */
  async getTradePartners(top = 10) {
    const { table, fields } = this.constructor.tradePartners;
    const { data, error } = await this._client
      .from(table)
      .select()
      .or(`${fields.userId}.eq.${this.id},${fields.partnerId}.eq.${this.id}`)
      .order(fields.totalCompletedTrades, { ascending: false })
      .limit(top);

    if (error) {
      throw error;
    }

    return data.map((row) => {
      const result = this.constructor.fromDB(row, fields);
      result.partnerId = result.userId === this.id ? result.partnerId : result.userId;
      delete result.userId;
      return result;
    });
  }
}
