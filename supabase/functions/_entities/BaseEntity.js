import { SupabaseClient } from '@supabase/supabase-js';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import crypto from 'node:crypto';

const ajvInstance = new Ajv({ allErrors: true });
addFormats(ajvInstance);

export class Entity {
  _client;
  _new = false;
  _loaded = false;
  _dirty = new Set();

  /**
   * Create an entity instance.
   * @param {import('@supabase/supabase-js').SupabaseClient} client - The Supabase client. May be omitted if using the useORM composable.
   * @param {Object|string} data - The entity data or a string ID.
   * @throws {Error} When client or data is missing, or when ID is required but missing.
   */
  constructor(client, data = {}) {
    if (!client || !(client instanceof SupabaseClient)) {
      throw new Error('Supabase client is required');
    }

    this._client = client;

    // Set up initial data
    const entityData = typeof data === 'string' ? { id: data } : data === null ? {} : data;

    // If no ID is provided, mark the entity as new
    if (!entityData.id) {
      this._new = true;

      // Mark all fields as dirty for new entities
      for (const key in entityData) {
        if (this.constructor.schema.properties[key] !== undefined) {
          this._dirty.add(key);
        }
      }
    }

    // Setup each property defined in fields with getters/setters
    for (const field of Object.keys(this.constructor.fields)) {
      this.#setupProperty(field, entityData[field] ?? null);
    }
  }

  /**
   * Sets up a property with getter/setter and tracks changes.
   * @param {string} key - The property name.
   * @param {*} initialValue - The initial value for the property.
   * @private
   */
  #setupProperty(key, initialValue) {
    const valueSymbol = Symbol(key);
    this[valueSymbol] = initialValue;

    Object.defineProperty(this, key, {
      get: () => this[valueSymbol],
      set: (value) => {
        if (this.constructor.schema.properties[key] === undefined) {
          throw new Error(`Field "${key}" is not defined in entity.`);
        }

        if (this[valueSymbol] !== value) {
          this._dirty.add(key);
          this[valueSymbol] = value;
        }
      },
      enumerable: true
    });
  }

  /**
   * Gets the database table name for the entity.
   * @returns {string} The database table name.
   * @throws {Error} When not implemented by subclass.
   */
  static get table() {
    throw new Error('Table name not defined in entity');
  }

  /**
   * Gets the mapping between entity properties and database fields.
   * @returns {Object} An object mapping entity property names to database column names.
   */
  static get fields() {
    return Object.freeze({ id: 'id' });
  }

  /**
   * Gets the JSON schema for validating entity objects.
   * @returns {Object} The JSON schema object.
   */
  static get schema() {
    return Object.freeze({
      type: 'object',
      required: ['id'],
      properties: {
        id: {
          type: 'string',
          title: 'ID',
          description: 'The unique identifier of the entity.'
        }
      }
    });
  }

  /**
   * Extracts field descriptions from the schema.
   * @returns {Object} An object mapping field names to their descriptions.
   */
  static get descriptions() {
    const descriptions = {};
    for (const [key, value] of Object.entries(this.schema.properties)) {
      descriptions[key] = value.description;
    }
    return Object.freeze(descriptions);
  }

  /**
   * Extracts field titles from the schema.
   * @returns {Object} An object mapping field names to their titles.
   */
  static get labels() {
    const labels = {};
    for (const [key, value] of Object.entries(this.schema.properties)) {
      // Use title if available, otherwise use the key as fallback
      labels[key] = value.title || key;
    }
    return Object.freeze(labels);
  }

  /**
   * Converts a database record to an entity object.
   * @param {Object} record - The database record.
   * @returns {Object} The entity data object.
   */
  static fromDB(record = {}, fields = this.fields) {
    const data = {};
    for (const [publicKey, dbKey] of Object.entries(fields)) {
      if (record[dbKey] !== undefined) {
        data[publicKey] = record[dbKey];
      } else if (record[publicKey] !== undefined) { // Allows entity data to be passed in
        data[publicKey] = record[publicKey];
      }
    }
    return data;
  }

  /**
   * Converts an entity object to a database record.
   * @param {Object} data - The entity data.
   * @param {Object} [fields=this.fields] - The field mapping to use.
   * @returns {Object} The database record.
   */
  static toDB(data = {}, fields = this.fields) {
    const record = {};
    for (const [publicKey, dbKey] of Object.entries(fields)) {
      if (data[publicKey] !== undefined) {
        record[dbKey] = data[publicKey];
      } else if (data[dbKey] !== undefined) { // Allows a db record to be passed in
        record[dbKey] = data[dbKey];
      }
    }
    return record;
  }

  /**
   * Generates a random RFC 4122 version 4 UUID for the entity.
   * @returns {string} The generated UUID.
   * @see https://tools.ietf.org/html/rfc4122
   */
  static generateID() {
    if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    } else {
      return crypto.webcrypto.randomUUID();
    }
  }

  /**
   * Validates data against the entity schema.
   * @param {Object} input - The data to validate.
   * @returns {boolean} True if validation succeeds.
   * @throws {Error} If validation fails, with details about the errors.
   */
  static validate(input) {
    const validator = ajvInstance.compile(this.schema);
    const valid = validator(input);
    if (!valid) {
      throw new Error(validator.errors.map(e => e.message).join('\n'));
    }

    return true;
  }

  /**
   * Validates the current entity against its schema.
   * @param {Object} [input=this] - The data to validate (defaults to current instance).
   * @returns {boolean} True if validation succeeds.
   * @throws {Error} If validation fails, with details about the errors.
   */
  validate(input = this) {
    return this.constructor.validate(input);
  }

  /**
   * Returns whether the entity is new and not saved to the database.
   * @returns {boolean} True if the entity is new.
   * @readonly
   */
  get isNew() {
    return this._new;
  }

  /**
   * Returns whether the entity has been loaded from the database with load().
   * @returns {boolean} True if the entity is loaded.
   * @readonly
   */
  get isLoaded() {
    return this._loaded;
  }

  /**
   * Returns whether the entity has any modified fields.
   * @returns {boolean} True if the entity has modified fields.
   * @readonly
   */
  get isDirty() {
    return this._dirty.size > 0;
  }

  /**
   * Loads the entity data from the database.
   * @returns {Promise<Entity>} The entity instance with loaded data.
   * @throws {Error} If loading fails.
   */
  async load() {
    if (this._new) {
      throw new Error('Cannot load unsaved entity');
    }

    const { data: record, error } = await this._client
      .from(this.constructor.table)
      .select()
      .eq(this.constructor.fields.id, this.id)
      .single();

    if (error) {
      throw error;
    }

    const data = this.constructor.fromDB(record);
    for (const [key, value] of Object.entries(data)) {
      this[key] = value;
    }

    this._dirty.clear();
    this._loaded = true;

    return this;
  }

  /**
   * Saves any modified fields to the database.
   * @returns {Promise<Entity>} The entity instance.
   * @throws {Error} If saving fails.
   */
  async save() {
    if (this._dirty.size === 0) {
      console.warn('No changes to save');
      return this;
    }

    const record = {};
    for (const field of this._dirty) {
      record[this.constructor.fields[field]] = this[field];
    }

    if (this._new) {
      const { error, data } = await this._client
        .from(this.constructor.table)
        .insert(record)
        .select()
        .single();

      if (error) {
        throw error;
      }

      for (const [key, value] of Object.entries(this.constructor.fromDB(data))) {
        this[key] = value;
      }
    } else {
      const { data, error } = await this._client
        .from(this.constructor.table)
        .update(record)
        .eq(this.constructor.fields.id, this.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      for (const [key, value] of Object.entries(this.constructor.fromDB(data))) {
        this[key] = value;
      }
    }

    this._dirty.clear();
    this._new = false;
    return this;
  }

  /**
   * Deletes the entity from the database.
   * @returns {Promise<Entity>} The deleted entity instance.
   * @throws {Error} If deletion fails.
   */
  async delete() {
    if (this._new) {
      throw new Error('Cannot delete unsaved entity');
    }

    const { error } = await this._client
      .from(this.constructor.table)
      .delete()
      .eq(this.constructor.fields.id, this.id);

    if (error) {
      throw error;
    }

    return this;
  }

  /**
   * Converts the entity to a plain object.
   * @returns {Object} The entity data object.
   */
  toObject() {
    const data = {};
    for (const field of Object.keys(this.constructor.fields)) {
      data[field] = this[field];
    }
    return data;
  }

  /**
   * Returns a string representation of the entity.
   * @returns {string} The string representation.
   * @override
   */
  toString() {
    return `${this.constructor.name}(${this.id})`;
  }

  /**
   * Fetches entities from the database based on filters.
   * @param {Object} client - The Supabase client.
   * @param {Array} [filters=[]] - Query filters to apply.
   * @param {String} filters[].filter - The filter method to use.
   * @param {Array} filters[].params - The parameters to pass to the filter method
   * @returns {Promise<Entity[]>} Array of entity instances.
   * @throws {Error} If the fetch operation fails.
   */
  static async query(client, filters = []) {
    let query = client.from(this.table).select();
    for (const { filter, params } of filters) {
      query = query[filter](...params);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return data.map(record => new this(client, this.fromDB(record)));
  }

  /**
   * Creates a new entity in the database.
   * @param {Object} client - The Supabase client.
   * @param {Object|Array} data - The entity data or an array of data objects.
   * @returns {Promise<Entity>} The newly created entity instance.
   * @throws {Error} If creation fails.
   */
  static async create(client, data) {
    if (!client) {
      throw new Error('Supabase client is required');
    }

    if (!data) {
      throw new Error('Data is required');
    }

    const isSingle = !Array.isArray(data);
    const records = isSingle ? [data] : data;

    records.every(record => this.validate(record));

    const { data: created, error } = await client
      .from(this.table)
      .insert(records.map(record => this.toDB(record)))
      .select();

    if (error) {
      throw error;
    }

    const entities = created.map(record => new this(client, this.fromDB(record)));
    return isSingle ? entities[0] : entities;
  }

  /**
   * Updates an entity in the database.
   * @param {Object} client - The Supabase client.
   * @param {Object} filters - Query filters to apply.
   * @param {Object} data - The entity data to update.
   * @returns {Promise<Entity[]>} Array of updated entity instances.
   * @throws {Error} If update fails.
   */
  static async update(client, filters, data) {
    if (!client) {
      throw new Error('Supabase client is required');
    }

    if (!filters) {
      throw new Error('Filters are required');
    }

    if (!data) {
      throw new Error('Data is required');
    }

    this.validate(data);

    let query = client.from(this.table).update(this.toDB(data));
    for (const [filter, ...args] of Object.entries(filters)) {
      query = query[filter](...args);
    }

    const { data: updated, error } = await query.select();

    if (error) {
      throw error;
    }

    return updated.map(record => new this(client, this.fromDB(record)));
  }

  /**
   * Deletes entities from the database based on filters.
   * @param {Object} client - The Supabase client.
   * @param {Object} filters - Query filters to apply.
   * @returns {Promise<Entity[]>} Array of deleted entity instances.
   * @throws {Error} If deletion fails.
   */
  static async delete(client, filters) {
    if (!client) {
      throw new Error('Supabase client is required');
    }

    if (!filters) {
      throw new Error('Filters are required');
    }

    let query = client.from(this.table).delete();
    for (const [filter, ...args] of Object.entries(filters)) {
      query = query[filter](...args);
    }

    const { data: deleted, error } = await query.select();

    if (error) {
      throw error;
    }

    return deleted.map(record => new this(client, this.fromDB(record)));
  }
}
