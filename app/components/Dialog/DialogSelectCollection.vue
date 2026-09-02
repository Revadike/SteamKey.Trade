<script setup>
  const props = defineProps({
    multiple: {
      type: Boolean,
      default: false
    },
    tableProps: {
      type: Object,
      default: () => ({})
    },
    selectText: {
      type: String,
      default: 'Select'
    }
  });

  const emit = defineEmits(['select']);

  const internalValue = ref(false);
  const selected = ref([]);

  const onSelect = () => {
    emit('select', markRaw(props.multiple ? selected.value : selected.value[0]));
    internalValue.value = false;
    selected.value = [];
  };
</script>

<template>
  <v-dialog
    v-model="internalValue"
    width="720"
  >
    <template #activator="attrs">
      <slot
        name="activator"
        v-bind="attrs"
      />
    </template>

    <v-card>
      <v-card-title>Select {{ props.multiple ? 'collections' : 'a collection' }}</v-card-title>
      <v-card-text>
        <table-collections
          v-model="selected"
          v-bind="props.tableProps"
          show-select
        />
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
          :disabled="!selected.length"
          variant="tonal"
          @click="onSelect"
        >
          {{ selectText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
