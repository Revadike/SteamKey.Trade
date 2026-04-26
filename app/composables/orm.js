import { SupabaseClient } from '@supabase/supabase-js';
import * as entity from '@@/supabase/functions/_entities';

/**
 * Wraps an entity class so that the client is pre-bound.
 *
 * @param {typeof Entity} Entity - The original class.
 * @param {*} client - The value to bind as the first argument.
 * @returns {typeof Entity} - A subclass of Entity with client pre-bound and same name.
 */
function wrapEntity(Entity, client) {
  class WrappedEntity extends Entity {
    constructor(...args) {
      // If the first argument is an instance of SupabaseClient,
      // assume the caller wants to supply their own client.
      if (args[0] instanceof SupabaseClient) {
        super(...args);
      } else {
        super(client, ...args);
      }
    }
  }

  // By using 'extends', WrappedEntity automatically inherits all static members.
  // However, we want the name of WrappedEntity to match that of Entity.
  Object.defineProperty(WrappedEntity, 'name', {
    value: Entity.name,
    configurable: true
  });

  return WrappedEntity;
}

export const useORM = () => {
  const supabase = useSupabaseClient();

  /** @type {typeof entity.App} */
  const App = wrapEntity(entity.App, supabase);
  /** @type {typeof entity.Collection} */
  const Collection = wrapEntity(entity.Collection, supabase);
  /** @type {typeof entity.Review} */
  const Review = wrapEntity(entity.Review, supabase);
  /** @type {typeof entity.Trade} */
  const Trade = wrapEntity(entity.Trade, supabase);
  /** @type {typeof entity.TradeMessage} */
  const TradeMessage = wrapEntity(entity.TradeMessage, supabase);
  /** @type {typeof entity.User} */
  const User = wrapEntity(entity.User, supabase);
  /** @type {typeof entity.VaultEntry} */
  const VaultEntry = wrapEntity(entity.VaultEntry, supabase);

  return { App, Collection, Review, Trade, TradeMessage, User, VaultEntry };
};
