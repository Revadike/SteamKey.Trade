import { Entity } from './BaseEntity.js';
import { User } from './User.js';

export class Trade extends Entity {
  static get table() {
    return 'trades';
  }

  static get fields() {
    return Object.freeze({
      id: 'id',
      originalId: 'original_id',
      status: 'status',
      senderId: 'sender_id',
      senderDisputed: 'sender_disputed',
      senderVaultless: 'sender_vaultless',
      senderTotal: 'sender_total',
      receiverId: 'receiver_id',
      receiverDisputed: 'receiver_disputed',
      receiverVaultless: 'receiver_vaultless',
      receiverTotal: 'receiver_total',
      criteria: 'criteria',
      updatedAt: 'updated_at',
      createdAt: 'created_at'
    });
  }

  static get activity() {
    return Object.freeze({
      table: 'trade_activity',
      fields: Object.freeze({
        id: 'id',
        tradeId: 'trade_id',
        userId: 'user_id',
        type: 'type',
        createdAt: 'created_at'
      })
    });
  }

  static get apps() {
    return Object.freeze({
      table: 'trade_apps',
      fields: Object.freeze({
        tradeId: 'trade_id',
        appId: 'app_id',
        collectionId: 'collection_id',
        vaultEntries: 'vault_entries',
        userId: 'user_id',
        mandatory: 'mandatory',
        selected: 'selected',
        total: 'total',
        snapshot: 'snapshot',
        updatedAt: 'updated_at',
        createdAt: 'created_at'
      })
    });
  }

  static get views() {
    return Object.freeze({
      table: 'trade_views',
      fields: Object.freeze({
        tradeId: 'trade_id',
        userId: 'user_id',
        updatedAt: 'updated_at',
        createdAt: 'created_at'
      })
    });
  }

  static get enums() {
    return Object.freeze({
      status: {
        pending: 'pending',
        accepted: 'accepted',
        declined: 'declined',
        aborted: 'aborted',
        completed: 'completed'
      },
      activity: {
        aborted: 'aborted',
        accepted: 'accepted',
        completed: 'completed',
        countered: 'countered',
        created: 'created',
        declined: 'declined',
        disputed: 'disputed',
        edited: 'edited',
        resolved: 'resolved'
      }
    });
  }

  static get schema() {
    return Object.freeze({
      type: 'object',
      required: ['id', 'status'],
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
          title: 'ID',
          description: 'The unique identifier of the trade.'
        },
        originalId: {
          type: 'string',
          format: 'uuid',
          nullable: true,
          title: 'Original Trade',
          description: 'If this trade is a counteroffer, this links to the original trade.'
        },
        status: {
          type: 'string',
          enum: Object.values(this.enums.status),
          title: 'Status',
          description: 'The current status of the trade.'
        },
        senderId: {
          type: 'string',
          format: 'uuid',
          nullable: true,
          title: 'Sender',
          description: 'The user ID of the sender.'
        },
        senderDisputed: {
          type: 'boolean',
          default: false,
          title: 'Sender Disputed',
          description: 'Indicates if the sender has disputed the trade.'
        },
        senderVaultless: {
          type: 'boolean',
          default: false,
          title: 'Sender Vaultless',
          description: 'Indicates if the sender wishes to exchange keys outside the platform.'
        },
        senderTotal: {
          type: 'integer',
          minimum: 0,
          default: 0,
          title: 'Sender Total',
          description: 'Total items from the sender.'
        },
        receiverId: {
          type: 'string',
          format: 'uuid',
          nullable: true,
          title: 'Receiver',
          description: 'The user ID of the receiver.'
        },
        receiverDisputed: {
          type: 'boolean',
          default: false,
          title: 'Receiver Disputed',
          description: 'Indicates if the receiver has disputed the trade.'
        },
        receiverVaultless: {
          type: 'boolean',
          default: false,
          title: 'Receiver Vaultless',
          description: 'Indicates if the receiver wishes to exchange keys outside the platform.'
        },
        receiverTotal: {
          type: 'integer',
          minimum: 0,
          default: 0,
          title: 'Receiver Total',
          description: 'Total items from the receiver.'
        },
        criteria: {
          type: 'object',
          nullable: true,
          title: 'Criteria',
          description: 'Trade was created based on these criteria.'
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          title: 'Updated At',
          description: 'The timestamp when the trade was last updated.'
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          title: 'Created At',
          description: 'The timestamp when the trade was created.'
        }
      }
    });
  }

  static get icons() {
    return Object.freeze({
      accepted: 'mdi-check',
      aborted: 'mdi-close',
      completed: 'mdi-check-all',
      countered: 'mdi-repeat',
      created: 'mdi-plus',
      declined: 'mdi-cancel',
      disputed: 'mdi-exclamation-thick',
      edited: 'mdi-pencil',
      error: 'mdi-exclamation-thick',
      pending: 'mdi-clock-outline',
      resolved: 'mdi-emoticon-happy-outline'
    });
  }

  static get colors() {
    return Object.freeze({
      accepted: 'yellow',
      aborted: 'grey',
      completed: 'success',
      countered: 'warning',
      created: 'warning',
      declined: 'error',
      disputed: 'error',
      edited: 'grey',
      error: 'error',
      pending: 'warning',
      resolved: 'success'
    });
  }

  static get labels() {
    return {
      ...super.labels,
      aborted: 'Aborted',
      accepted: 'Accepted',
      completed: 'Completed',
      declined: 'Declined',
      disputed: 'Disputed',
      pending: 'Pending',
      countered: 'Countered',
      created: 'Created',
      edited: 'Edited',
      error: 'Error',
      resolved: 'Resolved',
      receiver: 'Receiver',
      sender: 'Sender'
    };
  }

  static get descriptions() {
    return {
      ...super.descriptions,
      aborted: 'aborted the trade',
      accepted: 'accepted the trade',
      completed: 'completed the trade',
      countered: 'countered the trade',
      created: 'proposed a new trade',
      declined: 'declined the trade',
      disputed: 'disputed the trade',
      edited: 'edited the trade',
      error: 'is unable to complete the trade',
      resolved: 'resolved the dispute'
    };
  }

  abort() {
    this.status = this.constructor.enums.status.aborted;
    return this.save();
  }

  accept() {
    this.status = this.constructor.enums.status.accepted;
    return this.save();
  }

  complete() {
    this.status = this.constructor.enums.status.completed;
    return this.save();
  }

  decline() {
    this.status = this.constructor.enums.status.declined;
    return this.save();
  }

  /**
   * Records a new view for the current trade.
   *
   * @param {string} userId - Your user ID.
   * @returns {Promise<Object>} A promise that resolves to the trade view object.
   * @throws Will throw an error if the Supabase query fails.
   */
  async view(userId) {
    const { table, fields } = this.constructor.views;
    const { error, data } = await this._client
      .from(table)
      .upsert({
        [fields.tradeId]: this.id,
        [fields.userId]: userId
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return this.constructor.fromDB(data, fields);
  }

  /**
   * Retrieves a list of views of the current trade.
   *
   * @returns {Promise<Array<Object>>} A promise that resolves to an array of trade view objects.
   * @param {boolean} [withUser=false] - If true, includes user information in the result.
   * @throws Will throw an error if the Supabase query fails.
   */
  async getViews(withUser = false) {
    const { table, fields } = this.constructor.views;
    const { data, error } = await this._client
      .from(table)
      .select(withUser ? `*, user:${User.table}!inner(*)` : '*')
      .eq(fields.tradeId, this.id)
      .order(fields.createdAt, { ascending: false });

    if (error) {
      throw error;
    }

    return data
      .map(view => ({
        ...this.constructor.fromDB(view, fields),
        ...(withUser ? { user: User.fromDB(view.user) } : {})
      }))
      .sort((a, b) => {
        return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
      });
  }

  /**
   * Retrieves a list of activities related to the current trade.
   *
   * @param {number} [limit=10] - The maximum number of activities to retrieve.
   * @returns {Promise<Array<Object>>} A promise that resolves to an array of activity objects.
   * @throws Will throw an error if the Supabase query fails.
   */
  async getActivities(limit = 10) {
    const { table, fields } = this.constructor.activity;
    const { data, error } = await this._client
      .from(table)
      .select('*')
      .eq(fields.tradeId, this.id)
      .order(fields.createdAt, { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data.map(activity => this.constructor.fromDB(activity, fields)).reverse();
  }

  /**
   * Retrieves a list of apps related to the current trade.
   *
   * @param {boolean} [withTrade=false] - If true, includes trade information in the result.
   * @returns {Promise<Array<Object>>} A promise that resolves to an array of trade app objects.
   * @throws Will throw an error if the Supabase query fails.
   */
  async getApps(withTrade = false) {
    const { table, fields } = this.constructor.apps;
    const { data, error } = await this._client
      .from(table)
      .select(withTrade ? `*, trade:${this.constructor.table}!inner(*)` : '*')
      .eq(fields.tradeId, this.id);

    if (error) {
      throw error;
    }

    return data.map(app => ({
      ...this.constructor.fromDB(app, fields),
      ...(withTrade ? { trade: this.constructor.fromDB(app.trade) } : {})
    }));
  }

  /**
   * Sets the apps for the current trade.
   *
   * @param {Array<Object>} apps - An array of app objects to set for the trade.
   * @param {boolean} [onlyUpdate=false] - If true, only updates existing apps without inserting new ones. Useful to bypass insert RLS.
   * @param {boolean} [replace=false] - If true, deletes all existing apps before inserting new ones.
   * @returns {Promise<boolean>} A promise that resolves to true if the apps were set successfully.
   * @throws Will throw an error if the Supabase query fails.
   */
  async setApps(apps, onlyUpdate = false, replace = false) {
    const { table, fields } = this.constructor.apps;
    const records = apps.map(app => this.constructor.toDB({
      ...app,
      tradeId: this.id
    }, fields));

    if (onlyUpdate) {
      await Promise.all(records.map(async (record) => {
        const { error } = await this._client
          .from(table)
          .update(record)
          .eq(fields.tradeId, this.id)
          .eq(fields.userId, record[fields.userId])
          .eq(fields.appId, record[fields.appId]);

        if (error) {
          throw error;
        }
      }));
    } else {
      if (replace) {
        const { error } = await this._client
          .from(table)
          .delete()
          .eq(fields.tradeId, this.id);

        if (error) {
          throw error;
        }
      }

      const { error } = await this._client
        .from(table)
        .upsert(records);

      if (error) {
        throw error;
      }
    }

    return true;
  }

  /**
   * Retrieves a list of activities from the database.
   *
   * @param {import('@supabase/supabase-js').SupabaseClient} supabase - The Supabase client.
   * @param {Array<string>} [trades] - An array of trade IDs to filter the activities.
   * @param {number} [limit=10] - The maximum number of activities to retrieve.
   * @returns {Promise<Array<Object>>} A promise that resolves to an array of activity objects.
   * @throws Will throw an error if the database query fails.
   */
  static async getActivities(supabase, trades, limit = 10) {
    if (!supabase) {
      throw new Error('Missing required parameters');
    }

    const { table, fields } = this.activity;
    let query = supabase
      .from(table)
      .select('*');

    if (trades?.length) {
      query = query.in(fields.tradeId, trades);
    }

    query = query
      .order(fields.createdAt, { ascending: false })
      .limit(limit);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data.map(activity => this.fromDB(activity, fields)).reverse();
  }
}
