<script setup>
  const model = defineModel({
    type: Array,
    required: true,
    default: () => []
  });

  const emit = defineEmits(['update:modelValue']);

  const isDragging = ref(false);
  const draggedIndex = ref(null);

  const handleChange = value => {
    emit('update:modelValue', value);
  };

  const dragStart = (event, index) => {
    isDragging.value = true;
    draggedIndex.value = index;
    event.dataTransfer.effectAllowed = 'move';
  };

  const dragEnd = () => {
    isDragging.value = false;
    draggedIndex.value = null;
  };

  const drop = (event, dropIndex) => {
    event.preventDefault();
    const dragIndex = draggedIndex.value;

    if (dragIndex === dropIndex) {
      return;
    }

    const [removed] = model.value.splice(dragIndex, 1);
    model.value.splice(dropIndex, 0, removed);
    dragEnd();
  };

  const removeItem = index => {
    model.value.splice(index, 1);
  };
</script>

<template>
  <div class="draggable-combobox">
    <v-combobox
      v-model="model"
      v-bind="$attrs"
      :class="{ 'is-dragging': isDragging }"
      @update:model-value="handleChange"
    >
      <template #chip="{ item, index }">
        <v-chip
          :key="index"
          :class="{ 'dragging': draggedIndex === index }"
          draggable
          @click.stop
          @click:close="removeItem(index)"
          @dragend="dragEnd"
          @dragenter.prevent
          @dragover.prevent
          @dragstart="dragStart($event, index)"
          @drop="drop($event, index)"
          @mousedown.stop
        >
          {{ item.title }}
        </v-chip>
      </template>
    </v-combobox>
  </div>
</template>

<style lang="scss" scoped>
  .draggable-combobox {
    .v-chip {
      cursor: move;
      transition: opacity 0.2s;

      &.dragging {
        opacity: 0.5;
      }
    }

    &.is-dragging {
      .v-chip:not(.dragging):hover {
        background-color: rgba(0, 0, 0, 0.1);
      }
    }
  }
</style>