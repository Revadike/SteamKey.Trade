<script setup>
  defineProps({
    title: {
      type: String,
      default: 'Select app'
    },
    selectText: {
      type: String,
      default: 'Select'
    }
  });

  const emit = defineEmits(['select:app']);

  const selectedApp = ref(null);
  const internalValue = ref(false);

  const selectApp = () => {
    internalValue.value = false;
    emit('select:app', selectedApp.value);
  };
</script>

<template>
  <v-dialog
    v-model="internalValue"
    width="500"
  >
    <template #activator="attrs">
      <slot
        name="activator"
        v-bind="attrs"
      />
    </template>
    <v-card>
      <v-card-title>
        {{ title }}
      </v-card-title>
      <v-card-text>
        <input-app-search v-model="selectedApp" />
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
          :disabled="!selectedApp"
          variant="tonal"
          @click="selectApp"
        >
          {{ selectText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>