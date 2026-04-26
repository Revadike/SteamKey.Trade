<script setup>
  const props = defineProps({
    files: {
      type: Object,
      default: () => ({})
    }
  });

  const dialog = computed(() => Object.keys(props.files).length > 0);
</script>

<template>
  <v-dialog
    :model-value="dialog"
    persistent
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
        Uploading...
      </v-card-title>
      <v-card-text class="text-body-1">
        <div
          v-for="(file, key) in files"
          :key="key"
          class="mb-3"
        >
          <div class="d-flex justify-space-between mb-1">
            <span class="text-truncate">
              {{ file.name }}
            </span>
            <span
              v-if="!file.indeterminate && file.progress"
              class="ml-2"
            >
              {{ file.progress }}%
            </span>
          </div>
          <v-progress-linear
            v-model="file.progress"
            color="primary"
            :indeterminate="file.indeterminate"
          />
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
