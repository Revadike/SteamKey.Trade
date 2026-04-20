<script setup>
  const props = defineProps({
    tradeId: {
      type: String,
      required: true
    }
  });

  const { isLoggedIn } = storeToRefs(useAuthStore());
  const snackbarStore = useSnackbarStore();

  const {
    messages,
    status,
    error,
    isSending,
    sendMessage,
    editMessage,
    deleteMessage
  } = useTradeChat(props.tradeId);

  const messageInput = ref(null);
  const editingMessage = ref(null);
  const body = ref('');

  /**
   * Scrolls the message list to the most recent message.
   */

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

  watch(
    () => messages.value?.length,
    () => nextTick(() => {
      scrollToBottom();
      messageInput.value?.focus();
    })
  );

  /**
   * Enters edit mode for the given message. Calling it again with the same
   * message cancels the edit.
   *
   * @param {{ id: string, body: string }} message
   */
  const startEdit = async (message) => {
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

  /**
   * Clears the edit state and empties the input.
   */
  const cancelEdit = () => {
    body.value = '';
    editingMessage.value = null;
  };

  /**
   * Sends a new message or saves an edit, then resets local state on success.
   * Surfaces errors via the snackbar.
   */
  const handleSubmit = () => {
    if (body.value.trim() === '') {
      cancelEdit();
      return;
    }

    if (editingMessage.value) {
      if (editingMessage.value.body === body.value) {
        cancelEdit();
        return;
      }

      editMessage(editingMessage.value.id, body.value)
        .then(cancelEdit)
        .catch(() => snackbarStore.set('error', 'Unable to edit message'));
    } else {
      sendMessage(body.value)
        .then(() => { body.value = ''; })
        .catch(() => snackbarStore.set('error', 'Unable to send message'));
    }
  };

  /**
   * Deletes a message and surfaces any error via the snackbar.
   *
   * @param {{ id: string }} message
   */
  const handleDelete = (message) => {
    deleteMessage(message)
      .catch(() => snackbarStore.set('error', 'Unable to delete message'));
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
        @delete="handleDelete"
        @edit="startEdit"
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
        @keydown.enter.prevent="handleSubmit"
        @keydown.escape="cancelEdit"
        @keydown.up="startEdit(messages[messages.length - 1])"
      >
        <template #append>
          <v-btn
            :disabled="isSending || !body.trim()"
            icon
            @click="handleSubmit"
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
