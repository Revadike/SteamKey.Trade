<script setup>
  defineProps({
    title: {
      type: String,
      default: 'Are you sure?'
    },
    confirmText: {
      type: String,
      default: 'Yes'
    },
    confirmDisabled: {
      type: Boolean,
      default: false
    },
    color: {
      type: String,
      default: ''
    },
    loading: {
      type: Boolean,
      default: false
    }
  });

  const emit = defineEmits(['confirm']);

  const internalValue = defineModel({ type: Boolean, default: false });
  const confirm = () => {
    internalValue.value = false;
    emit('confirm');
  };
</script>

<template>
  <v-dialog
    v-model="internalValue"
    transition="dialog-center-transition"
    width="500"
  >
    <template #activator="attrs">
      <slot
        name="activator"
        v-bind="attrs"
      />
    </template>
    <v-card :loading="loading">
      <v-card-title :class="`${color ? `text-${color}` : ''}`">
        {{ title }}
      </v-card-title>
      <v-card-text class="pa-0">
        <slot name="body" />
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-btn
          variant="text"
          @click="internalValue = false"
        >
          Cancel
        </v-btn>
        <v-spacer />
        <v-btn
          :color="color"
          :disabled="confirmDisabled || loading"
          :loading="loading"
          variant="tonal"
          @click="confirm"
        >
          {{ confirmText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
