<script setup>
  import { relativeDate } from '~/assets/js/date';
  import { formatDate } from '~/assets/js/format';

  const emit = defineEmits(['delete', 'edit']);
  const props = defineProps({
    message: {
      type: Object,
      required: true
    }
  });

  const { user, isLoggedIn } = storeToRefs(useAuthStore());

  const isHovering = ref(false);
  const isMine = computed(() => isLoggedIn.value && props.message.userId === user.value.id);
</script>

<template>
  <div
    :class="['chat-message', { mine: isMine }]"
    @mouseleave="isHovering = false"
    @mouseover="isHovering = true"
    @touchstart="isHovering = !isHovering"
  >
    <rich-profile-link
      avatar-size="40"
      hide-reputation
      hide-text
      :user-id="message.userId"
    />
    <div class="message-content">
      <div class="message-body">
        {{ message.body }}
      </div>
      <div
        v-if="message.createdAt"
        class="message-info"
      >
        <span
          v-tooltip:bottom="formatDate(message.createdAt)"
          class="date"
        >
          {{ message.updatedAt
            ? `${relativeDate(message.updatedAt)} (edited)`
            : relativeDate(message.createdAt)
          }}
        </span>
      </div>
    </div>

    <div
      v-if="isMine && Date.now() - new Date(message.createdAt) < 1000 * 60 * 5"
      :class="['message-actions', { 'd-none': !isHovering }]"
    >
      <v-btn
        color="primary"
        icon
        size="small"
        variant="plain"
        @click="emit('edit', message);"
      >
        <v-icon icon="mdi-pencil" />
      </v-btn>
      <dialog-confirm
        color="red"
        confirm-text="Delete"
        @confirm="emit('delete', message);"
      >
        <template #activator="{ props: activatorProps }">
          <v-btn
            color="red"
            icon
            size="small"
            variant="plain"
            v-bind="activatorProps"
          >
            <v-icon icon="mdi-delete" />
          </v-btn>
        </template>
      </dialog-confirm>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .chat-message {
    margin-bottom: 10px;
    display: flex;
    flex-direction: row;
    gap: 8px;
    position: relative;

    &.mine {
      flex-direction: row-reverse;

      &::before {
        left: auto;
        right: 26px;
        border-color: transparent transparent transparent #3c3c3c;
      }
    }

    > .message-content {
      padding: 5px 10px 5px 10px;
      border-radius: 10px;
      background-color: #3c3c3c;
      min-width: 150px;
      max-width: 300px; // TODO: this should match the chat window width

      > .message-info {
        font-size: 0.65rem;
        color: #888;
      }

      > .message-body {
        color: white;
        font-size: 1rem;
        word-wrap: break-word;
      }
    }

    > .message-actions {
      display: flex;
      flex-direction: column;
      width: 20px;
      height: 20px;
      margin-top: 6px;

      > button {
        margin-top: -14px;
      }
    }

    &::before {
      content: '';
      position: absolute;
      width: 0;
      height: 0;
      border-style: solid;
      border-width: 0 16px 16px 16px;
      border-color: transparent #3c3c3c transparent transparent;
      top: 0px;
      left: 26px;
    }
  }
</style>
