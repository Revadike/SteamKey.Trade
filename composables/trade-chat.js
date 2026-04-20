/**
 * @typedef {{ channel: import('@supabase/supabase-js').RealtimeChannel, refs: number }} ChannelEntry
 *
 * Shared registry of active Supabase channels, keyed by tradeId.
 * Kept at module scope so all composable instances share the same map.
 *
 * @type {Map<string, ChannelEntry>}
 */
const channelRegistry = new Map();

/**
 * Composable that provides reactive trade messages and actions backed by a
 * ref-counted Supabase Realtime channel.
 *
 * A single channel is created per tradeId regardless of how many components
 * call this composable. The channel is removed only when the last consumer
 * unmounts.
 *
 * Errors from write operations are re-thrown so callers can handle them in
 * whatever way suits the UI (snackbar, inline error, etc.).
 *
 * @param {string} tradeId
 */
export const useTradeChat = (tradeId) => {
  const { user, isLoggedIn } = storeToRefs(useAuthStore());
  const { TradeMessage, Trade } = useORM();
  const supabase = useSupabaseClient();

  const { data: messages, status, error } = useSupabaseData('messages', { tradeId });

  /**
   * Applies an incoming Realtime payload to the local messages array.
   * DELETE events are not handled because Supabase does not support filtering
   * on them.
   *
   * @see https://supabase.com/docs/guides/realtime/postgres-changes#delete-events-are-not-filterable
   * @param {import('@supabase/supabase-js').RealtimePostgresChangesPayload<Record<string, unknown>>} payload
   */
  const handleRealtimeMessage = (payload) => {
    if (payload.eventType === 'INSERT') {
      const exists = messages.value.some(msg => msg.id === payload.new.id);
      if (!exists) {
        messages.value.push(TradeMessage.fromDB(payload.new));
      }
    } else if (payload.eventType === 'UPDATE') {
      const index = messages.value.findIndex(msg => msg.id === payload.new.id);
      if (index !== -1) {
        messages.value.splice(index, 1, TradeMessage.fromDB(payload.new));
      }
    }

    if (isLoggedIn.value) {
      new Trade(tradeId).view(user.value.id);
    }
  };

  /**
   * Increments the ref-count for this tradeId's channel, creating it if it
   * does not already exist.
   */
  const acquireChannel = () => {
    if (channelRegistry.has(tradeId)) {
      channelRegistry.get(tradeId).refs += 1;
      return;
    }

    const channel = supabase
      .channel(`${TradeMessage.table}_${tradeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TradeMessage.table,
          filter: `${TradeMessage.fields.tradeId}=eq.${tradeId}`
        },
        handleRealtimeMessage
      )
      .subscribe();

    channelRegistry.set(tradeId, { channel, refs: 1 });
  };

  /**
   * Decrements the ref-count and removes the Supabase channel when it reaches
   * zero.
   */
  const releaseChannel = () => {
    const entry = channelRegistry.get(tradeId);
    if (!entry) { return; }

    entry.refs -= 1;

    if (entry.refs === 0) {
      supabase.removeChannel(entry.channel);
      channelRegistry.delete(tradeId);
    }
  };

  const isSending = ref(false);

  /**
   * Sends a new message in this trade. Sets {@link isSending} for the duration
   * of the request. Throws on failure so the caller can surface the error.
   *
   * @param {string} body
   * @returns {Promise<void>}
   */
  const sendMessage = (body) => {
    if (!body.trim()) { return Promise.resolve(); }

    isSending.value = true;

    const instance = new TradeMessage();
    instance.tradeId = tradeId;
    instance.userId = user.value.id;
    instance.body = body;

    return instance.save().finally(() => {
      isSending.value = false;
    });
  };

  /**
   * Updates the body of an existing message. Sets {@link isSending} for the
   * duration of the request. Throws on failure so the caller can surface the
   * error.
   *
   * @param {string} messageId
   * @param {string} newBody
   * @returns {Promise<void>}
   */
  const editMessage = (messageId, newBody) => {
    isSending.value = true;

    const instance = new TradeMessage(messageId);
    instance.body = newBody;

    return instance.save().finally(() => {
      isSending.value = false;
    });
  };

  /**
   * Deletes a message and removes it from the local list. Throws on failure so
   * the caller can surface the error.
   *
   * @param {{ id: string }} message
   * @returns {Promise<void>}
   */
  const deleteMessage = (message) => {
    return new TradeMessage(message).delete().then(() => {
      messages.value.splice(
        messages.value.findIndex(msg => msg.id === message.id),
        1
      );
    });
  };

  onMounted(acquireChannel);
  onUnmounted(releaseChannel);

  return {
    messages,
    status,
    error,
    isSending,
    sendMessage,
    editMessage,
    deleteMessage
  };
};
