<script setup>
  const { VaultEntry } = useORM();

  const props = defineProps({
    disabled: {
      type: Boolean,
      default: false
    },
    encrypted: {
      type: Boolean,
      required: true
    }
  });

  const model = defineModel({
    type: Object,
    default: () => ({
      appid: null,
      type: 'key',
      values: ['']
    })
  });

  const emit = defineEmits(['update:encrypted']);

  const inputRefs = ref([]);
  const focusedIndex = ref(null);

  const handleClear = (index) => {
    model.value.values.splice(index, 1);
    model.value.values = [...model.value.values.filter(Boolean), ''];
  };

  const handleBackspace = index => {
    if (model.value.values[index] === '') {
      inputRefs.value[index - 1]?.focus();
    }
  };

  const handleEnter = index => {
    inputRefs.value[index + 1]?.focus();
  };

  const handlePaste = event => {
    event.preventDefault();
    const pastedText = event.clipboardData.getData('text');
    const items = pastedText.split('\n').filter(Boolean);
    const currentIndex = focusedIndex.value;
    const newValues = items.map(item => item.trim()).filter(Boolean);
    model.value.values.splice(currentIndex, 1, ...newValues);
    model.value.values = [...model.value.values.filter(Boolean), ''];
    nextTick(() => {
      inputRefs.value[currentIndex + newValues.length]?.focus();
    });
  };

  const handleValueUpdate = () => {
    if (!model.value.values.includes('')) {
      model.value.values.push('');
    }
    emit('update:encrypted', false);
  };

  const getInputIcon = () => {
    if (props.encrypted) {
      return 'mdi-lock';
    }

    switch (model.value.type) {
      case VaultEntry.enums.type.key:
        return 'mdi-key';
      case VaultEntry.enums.type.curator:
        return 'mdi-steam';
      case VaultEntry.enums.type.gift:
        return 'mdi-gift';
      case VaultEntry.enums.type.link:
        return 'mdi-link';
      default:
        return 'mdi-key';
    }
  };

  const getPlaceholder = () => {
    switch (model.value.type) {
      case VaultEntry.enums.type.key:
        return 'XXXXX-XXXXX-XXXXX';
      case VaultEntry.enums.type.curator:
        return 'https://store.steampowered.com/curator/XXXXXXXX/admin/pending';
      case VaultEntry.enums.type.gift:
        return 'https://store.steampowered.com/account/ackgift/XXXXXXXXXXXXXXXX';
      case VaultEntry.enums.type.link:
        return 'https://humblebundle.com/gift?key=XXXXXXXXXXXXXXXX';
      default:
        return '';
    }
  };
</script>

<template>
  <v-select
    v-model="model.type"
    class="flex-0-0"
    density="compact"
    hide-details
    :items="Object.keys(VaultEntry.enums.type).map(type => ({
      title: VaultEntry.labels[type],
      value: VaultEntry.enums.type[type]
    }))"
    label="Type"
    prepend-inner-icon="mdi-tag"
    variant="outlined"
  >
    <template #item="{ item: { title, value }, props: itemProps }">
      <v-list-item
        v-bind="itemProps"
        :prepend-icon="VaultEntry.icons[value]"
        :title="title"
      />
    </template>
  </v-select>

  <v-divider />

  <v-text-field
    v-for="(_, index) in model.values"
    :key="index"
    :ref="el => inputRefs[index] = el?.$el.querySelector('input')"
    v-model="model.values[index]"
    :class="['flex-0-0', { 'text-monospace': disabled }]"
    density="compact"
    :disabled="disabled"
    hide-details
    :placeholder="getPlaceholder()"
    :prepend-inner-icon="getInputIcon()"
    :tabindex="index + 1"
    variant="outlined"
    @blur="focusedIndex = null"
    @focus="focusedIndex = index"
    @keydown.backspace="handleBackspace(index)"
    @keydown.enter="handleEnter(index)"
    @paste="handlePaste"
    @update:model-value="handleValueUpdate"
  >
    <template #append-inner>
      <v-fade-transition>
        <v-icon
          v-if="focusedIndex === index"
          class="fade-icon"
          icon="mdi-close-circle"
          @click="handleClear(index)"
        />
      </v-fade-transition>
    </template>
  </v-text-field>
</template>

<style lang="scss" scoped>
  .text-monospace {
    font-family: 'Fira Code', monospace;

    :deep(input) {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .fade-icon {
    transition: opacity 0.3s ease, transform 0.3s ease;
    opacity: 0.8;

    &:hover {
      opacity: 1;
      transform: scale(1.1);
    }
  }
</style>
