import { FunctionsHttpError } from '@supabase/supabase-js';
import { Entity } from './BaseEntity.js';

export class VaultEntry extends Entity {
  static get table() {
    return 'vault_entries';
  }

  static get fields() {
    return Object.freeze({
      id: 'id',
      userId: 'user_id',
      appId: 'app_id',
      tradeId: 'trade_id',
      type: 'type',
      revealedAt: 'revealed_at',
      updatedAt: 'updated_at',
      createdAt: 'created_at'
    });
  }

  static get values() {
    return Object.freeze({
      table: 'vault_values',
      fields: Object.freeze({
        vaultEntryId: 'vault_entry_id',
        receiverId: 'receiver_id',
        value: 'value',
        createdAt: 'created_at'
      })
    });
  }

  static get enums() {
    return Object.freeze({
      type: {
        key: 'key',
        gift: 'gift',
        link: 'link',
        curator: 'curator'
      }
    });
  }

  static get schema() {
    return Object.freeze({
      type: 'object',
      required: ['id', 'userId', 'appId', 'type'],
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
          title: 'Vault Entry ID',
          description: 'The unique identifier of the vault entry.'
        },
        userId: {
          type: 'string',
          format: 'uuid',
          title: 'Owner',
          description: 'The ID of the user who owns this vault entry.'
        },
        appId: {
          type: 'integer',
          title: 'AppID',
          description: 'The ID of the associated app.'
        },
        tradeId: {
          type: 'string',
          format: 'uuid',
          nullable: true,
          title: 'Trade',
          description: 'The ID of the trade associated with this entry (if applicable).'
        },
        type: {
          type: 'string',
          enum: Object.values(this.enums.type),
          title: 'Type',
          description: 'The type of vault entry (received or mine).'
        },
        revealedAt: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          title: 'Revealed At',
          description: 'The timestamp when the entry was revealed.'
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          title: 'Modified',
          description: 'The timestamp when the entry was last updated.'
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          title: 'Added',
          description: 'The timestamp when the entry was created.'
        }
      }
    });
  }

  static get icons() {
    return Object.freeze({
      key: 'mdi-key',
      gift: 'mdi-gift',
      link: 'mdi-link',
      curator: 'mdi-account-group'
    });
  }

  static get labels() {
    return {
      ...super.labels,
      value: 'Value',
      from: 'Received From',
      to: 'Sent To',
      key: 'Steam Key',
      gift: 'Steam Gift',
      link: 'Bundle Link',
      curator: 'Curator Connect'
    };
  }

  async addValue(receiverId, value) {
    if (!this.id) {
      throw new Error('Cannot add value to an entry without an ID');
    }

    const { table, fields } = VaultEntry.values;
    const { error } = await this._client
      .from(table)
      .insert({
        [fields.vaultEntryId]: this.id,
        [fields.receiverId]: receiverId,
        [fields.value]: value
      });

    // ignore duplicate key error
    if (error && error.code !== '23505') {
      throw error;
    }

    return true;
  }

  static getValues(supabase, userId, unsent = true, appids = [], receiverId = null) {
    if (!supabase) {
      throw new Error('Missing required parameters');
    }

    return Promise.all(appids.map(async (appid) => {
      let query = supabase
        .from(VaultEntry.table)
        .select(`*,
          values:${VaultEntry.values.table}!${VaultEntry.values.fields.vaultEntryId}(
            ${VaultEntry.values.fields.value}
          )
        `);

      if (unsent) {
        query = query.is(VaultEntry.fields.tradeId, null);
      }

      if (receiverId) {
        query = query.eq(`values.${VaultEntry.values.fields.receiverId}`, userId);
      }

      const { data, error } = await query
        .eq(VaultEntry.fields.appId, appid)
        .eq(VaultEntry.fields.userId, userId)
        .order(VaultEntry.fields.createdAt, { ascending: false });

      if (error) {
        throw error;
      }

      return data.map((entry) => {
        const values = entry.values.map(value => value.value);
        return {
          ...this.fromDB(entry),
          [VaultEntry.values.fields.value]: values[0]
        };
      });
    })).then(results => results.flat());
  }

  /**
   * Add vault entries and values to your vault.
   * @param {import('@supabase/supabase-js').SupabaseClient} supabase - The Supabase client.
   * @param {string} userId - The ID of the user.
   * @param {Array<Object>} items - An array of vault entries which contain the appid, type, and values.
   * @returns {Promise<boolean>} Whether the items were added
   * @throws Will throw an error if the apps cannot be added.
   */
  static async addValues(supabase, userId, items) {
    if (!supabase) {
      throw new Error('Missing required parameters');
    }

    if (items.length === 0) {
      return true;
    }

    const entries = [];
    const values = [];
    for (const item of items) {
      if (!Object.values(this.enums.type).includes(item.type)) {
        throw new Error(`Invalid type: ${item.type}`);
      }

      // Every vault item (key/gift/link) has a vault entry and every vault entry has 1 or more values
      // (1 encrypted value per designated user)
      for (const value of item.values) {
        const entryId = this.generateID();
        entries.push({
          [VaultEntry.fields.id]: entryId,
          [VaultEntry.fields.userId]: userId,
          [VaultEntry.fields.appId]: parseInt(item.appid),
          [VaultEntry.fields.type]: item.type
        });

        values.push({
          [VaultEntry.values.fields.vaultEntryId]: entryId,
          [VaultEntry.values.fields.receiverId]: userId,
          [VaultEntry.values.fields.value]: value
        });
      }
    }

    const { error: entriesError } = await supabase.rpc('bulk_insert', {
      p_table: VaultEntry.table,
      p_records: entries
    });

    if (entriesError) {
      if (entriesError instanceof FunctionsHttpError) {
        const message = await entriesError.context.json();
        throw new Error(message.error);
      }

      throw entriesError;
    }

    const { error: valuesError } = await supabase.rpc('bulk_insert', {
      p_table: VaultEntry.values.table,
      p_records: values
    });

    if (valuesError) {
      if (valuesError instanceof FunctionsHttpError) {
        const message = await valuesError.context.json();
        throw new Error(message.error);
      }

      throw valuesError;
    }

    return true;
  }
}
