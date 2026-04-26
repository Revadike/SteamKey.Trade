<script setup>
  import { formatDate, relativeDate } from '~/assets/js/format';

  defineProps({
    date: {
      type: [String, Date, Number, Object],
      required: true
    },
    icon: {
      type: [String, Boolean],
      default: false
    },
    noTime: {
      type: Boolean,
      default: false
    }
  });
</script>

<template>
  <span
    v-tooltip:top="formatDate(date, !noTime)"
    class="text-no-wrap"
  >
    <v-icon
      v-if="icon !== false"
      :icon="icon || 'mdi-calendar'"
      size="16"
    />
    {{ relativeDate(date) }}
  </span>
</template>