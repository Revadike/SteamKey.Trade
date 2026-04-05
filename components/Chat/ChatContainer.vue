<script setup>
  const props = defineProps({
    tradeId: {
      type: String,
      required: true
    }
  });

  const { user, isLoggedIn } = storeToRefs(useAuthStore());
  const { TradeMessage, Trade } = useORM();
  const supabase = useSupabaseClient();

  const isSending = ref(false);
  const messageInput = ref(null);
  const editingMessage = ref(null);
  const body = ref('');

  const { data: messages, status, error } = useSupabaseData('messages', { tradeId: props.tradeId });

  const scrollToBottom = () => {
    const chatMessages = document.querySelector('.chat-messages');
    if (chatMessages) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  };

  watch(() => status.value, (newStatus) => {
    if (newStatus === 'success') {
      nextTick(() => scrollToBottom());
    }
  });

  const handleRealtimeMessage = payload => {
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
    } else if (payload.eventType === 'DELETE') {
      // Does not work.... @see https://supabase.com/docs/guides/realtime/postgres-changes#delete-events-are-not-filterable
      // messages.value.splice(messages.value.findIndex(msg => msg.id === payload.old.id), 1);
    }

    if (isLoggedIn.value) {
      const instance = new Trade(props.tradeId);
      instance.view(user.value.id); // Mark the trade as viewed
    }

    nextTick(() => {
      scrollToBottom();
      messageInput.value?.focus();
    });
  };

  watch(() => props.tradeId, async (tradeId, _, onCleanup) => {
    if (!tradeId) {
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

    onCleanup(() => supabase.removeChannel(channel));
  }, { immediate: true });

  const snackbarStore = useSnackbarStore();
  const sendMessage = async () => {
    if (body.value.trim() === '') {
      if (editingMessage.value) {
        editingMessage.value = null;
      }
      return;
    }

    isSending.value = true;

    try {
      if (editingMessage.value) {
        if (editingMessage.value.body !== body.value) {
          const instance = new TradeMessage(editingMessage.value.id);
          instance.body = body.value;
          await instance.save();
        }

        editingMessage.value = null;
      } else {
        const instance = new TradeMessage();
        instance.tradeId = props.tradeId;
        instance.userId = user.value.id;
        instance.body = body.value;
        await instance.save();
      }
      body.value = '';
    } catch (error) {
      console.error(error);
      snackbarStore.set('error', 'Unable to send message');
    } finally {
      isSending.value = false;
    }
  };

  const editMessage = async message => {
    if (message.id === editingMessage.value?.id) {
      cancelEdit();
      return;
    }

    body.value = message.body;
    editingMessage.value = message;
    await nextTick();
    messageInput.value?.focus();
    messageInput.value?.select();
  };

  const cancelEdit = () => {
    body.value = '';
    editingMessage.value = null;
  };

  const deleteMessage = async message => {
    try {
      const instance = new TradeMessage(message);
      await instance.delete();
      messages.value.splice(messages.value.findIndex(msg => msg.id === message.id), 1);
    } catch (error) {
      console.error(error);
      snackbarStore.set('error', 'Unable to delete message');
    }
  };
</script>

<template>
  <v-card
    class="chat-window"
    :loading="status === 'pending'"
  >
    <v-card-title class="text-button">
      <v-icon
        icon="mdi-chat"
        start
      /> Messages
    </v-card-title>

    <v-divider />

    <v-card-text
      v-if="error"
      class="d-flex justify-center align-center"
    >
      <span class="text-disabled font-italic">
        Unable to load messages
      </span>
    </v-card-text>

    <v-card-text
      v-else
      class="chat-messages"
    >
      <chat-message
        v-for="(message, index) in messages"
        :key="index"
        :message="message"
        @delete="deleteMessage"
        @edit="editMessage"
      />
    </v-card-text>

    <v-divider />

    <v-card-actions v-if="isLoggedIn">
      <v-text-field
        ref="messageInput"
        v-model="body"
        :disabled="isSending"
        hide-details
        placeholder="Type your message..."
        @keydown.enter.prevent="sendMessage"
        @keydown.escape="cancelEdit"
        @keydown.up="editMessage(messages[messages.length - 1])"
      >
        <template #append>
          <v-btn
            :disabled="isSending || !body.trim()"
            icon
            @click="sendMessage"
          >
            <v-icon :icon="editingMessage ? 'mdi-pencil' : 'mdi-send'" />
          </v-btn>
        </template>
      </v-text-field>
    </v-card-actions>
  </v-card>
</template>

<style scoped>
  .chat-window {
    min-height: 200px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .chat-messages {
    /* height: 400px; */
      flex: 1 1 auto;
      overflow-y: auto;
      height: 0px;
  }
</style>
