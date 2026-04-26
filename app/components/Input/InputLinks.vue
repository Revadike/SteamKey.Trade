<script setup>
  import { formatUrl } from '~/assets/js/format';

  defineProps({
    disabled: {
      type: Boolean,
      default: false
    }
  });

  const model = defineModel({
    type: Array,
    default: () => []
  });

  // Ensure model is initialized as an array
  if (model.value === null || model.value === undefined) {
    model.value = [];
  }

  const input = ref(null);
  const search = ref('');
  const error = ref('');
  const editingIndex = ref(-1);
  const showLinkEditor = ref(false);
  const currentLinkItem = ref({
    url: '',
    title: '',
    icon: 'mdi-link'
  });
  const internalUpdate = ref(false);

  // Array of popular MDI icons for links
  const iconOptions = [
    'mdi-link',
    'mdi-web',
    'mdi-github',
    'mdi-twitter',
    'mdi-facebook',
    'mdi-instagram',
    'mdi-youtube',
    'mdi-linkedin',
    'mdi-steam',
    'mdi-reddit',
    'mdi-twitch',
    'icon-discord',
    'icon-steamdb',
    'icon-ggdeals',
    'mdi-email',
    'mdi-file-document',
    'mdi-home',
    'mdi-star',
    'mdi-information',
    'mdi-google',
    'mdi-microsoft',
    'mdi-apple',
    'mdi-spotify',
    'mdi-nintendo-switch',
    'mdi-sony-playstation',
    'mdi-microsoft-xbox',
    'mdi-wikipedia',
    'mdi-pinterest',
    'mdi-whatsapp',
    'mdi-store'
  ];

  // Convert legacy items to the new format
  const normalizeItems = () => {
    if (!model.value) { return; }

    for (let i = 0; i < model.value.length; i++) {
      const item = model.value[i];
      // If item is a string, convert to object
      if (typeof item === 'string') {
        model.value[i] = {
          url: item,
          title: formatUrl(item),
          icon: 'mdi-link'
        };
      }
    }
  };

  // Run once to normalize any existing strings
  normalizeItems();

  const isValidUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const addLink = async () => {
    if (!search.value) {
      return;
    }

    let url = search.value;
    // Add protocol if missing
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    if (!isValidUrl(url)) {
      error.value = 'Please enter a valid URL';
      return;
    }

    // Check if URL already exists
    if (model.value.some(item => {
      const itemUrl = typeof item === 'string' ? item : item.url;
      return itemUrl === url;
    })) {
      error.value = 'This URL already exists in the list';
      return;
    }

    // Create new link object
    currentLinkItem.value = {
      url,
      title: formatUrl(url),
      icon: 'mdi-link'
    };

    search.value = '';
    showLinkEditor.value = true;
  };

  const saveLink = () => {
    if (!model.value) {
      model.value = [];
    }

    internalUpdate.value = true;

    if (editingIndex.value >= 0) {
      // Update existing link
      model.value[editingIndex.value] = { ...currentLinkItem.value };
    } else {
      // Add new link
      model.value.push({ ...currentLinkItem.value });
    }

    editingIndex.value = -1;
    showLinkEditor.value = false;
    error.value = '';

    nextTick(() => {
      internalUpdate.value = false;
      input.value?.focus();
    });
  };

  const cancelEdit = () => {
    showLinkEditor.value = false;
    editingIndex.value = -1;
    nextTick(() => {
      input.value?.focus();
    });
  };

  const editLink = (item, index) => {
    // Handle both string and object items
    const linkItem = typeof item === 'string'
      ? { url: item, title: formatUrl(item), icon: 'mdi-link' }
      : item;

    editingIndex.value = index;
    currentLinkItem.value = { ...linkItem };
    showLinkEditor.value = true;
  };

  const onKeydown = event => {
    if (showLinkEditor.value) { return; }

    if (['Enter', ' ', 'Tab'].includes(event.key)) {
      event.preventDefault();
      addLink();
    }
  };

  const onUpdate = (val) => {
    if (internalUpdate.value) { return; }

    if (!val) {
      model.value = [];
      return;
    }

    // Ensure we handle removals properly
    normalizeItems();
  };
</script>

<template>
  <v-combobox
    ref="input"
    v-bind="$attrs"
    v-model:search="search"
    append-inner-icon="mdi-link"
    chips
    closable-chips
    :disabled="disabled || showLinkEditor"
    :error-messages="error"
    :model-value="model"
    multiple
    @click:append-inner="addLink"
    @keydown="onKeydown"
    @update:model-value="onUpdate"
  >
    <template #chip="{ props, item, index }">
      <v-chip
        v-bind="props"
        :prepend-icon="typeof item.raw === 'string' ? 'mdi-link' : (item.raw?.icon || 'mdi-link')"
        @click.stop="editLink(typeof item.raw === 'string' ? item.raw : item.raw, index)"
      >
        {{ typeof item.raw === 'string' ? formatUrl(item.raw) : (item.raw?.title || formatUrl(item.raw?.url || '')) }}
      </v-chip>
    </template>
    <template #item="{ item }">
      <v-list-item>
        <template #prepend>
          <v-icon :icon="typeof item.raw === 'string' ? 'mdi-link' : (item.raw?.icon || 'mdi-link')" />
        </template>
        <v-list-item-title>
          {{ typeof item.raw === 'string' ? formatUrl(item.raw) : (item.raw?.title || formatUrl(item.raw?.url || '')) }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ typeof item.raw === 'string' ? item.raw : (item.raw?.url || '') }}
        </v-list-item-subtitle>
      </v-list-item>
    </template>
  </v-combobox>

  <v-dialog
    v-model="showLinkEditor"
    max-width="500px"
  >
    <v-card>
      <v-card-title>
        {{ editingIndex >= 0 ? 'Edit Link' : 'Add Link' }}
      </v-card-title>
      <v-card-text>
        <v-form @submit.prevent="saveLink">
          <v-text-field
            v-model="currentLinkItem.url"
            label="URL"
            required
            :rules="[(v) => !!v || 'URL is required']"
          />

          <v-text-field
            v-model="currentLinkItem.title"
            hint="Leave blank to use formatted URL"
            label="Title"
            persistent-hint
          />

          <v-combobox
            v-model="currentLinkItem.icon"
            hint="Choose an icon or enter an MDI icon name"
            :items="iconOptions"
            label="Icon"
            persistent-hint
          >
            <template #selection="{ item }">
              <div class="d-flex align-center">
                <v-icon
                  class="mr-2"
                  :icon="typeof item === 'string' ? item : (item?.value || 'mdi-link')"
                />
                {{ typeof item === 'string' ? item : (item?.value || 'mdi-link') }}
              </div>
            </template>
            <template #item="{ item }">
              <v-list-item>
                <template #prepend>
                  <v-icon :icon="typeof item.value === 'string' ? item.value : (item?.value || 'mdi-link')" />
                </template>
                <v-list-item-title>{{ typeof item.value === 'string' ? item.value : (item?.value || 'mdi-link') }}</v-list-item-title>
              </v-list-item>
            </template>
          </v-combobox>

          <div class="d-flex flex-wrap gap-2 mt-4">
            <v-chip
              v-for="icon in iconOptions"
              :key="icon"
              class="ma-1"
              :color="currentLinkItem.icon === icon ? 'primary' : undefined"
              :prepend-icon="icon"
              :variant="currentLinkItem.icon === icon ? 'elevated' : 'tonal'"
              @click="currentLinkItem.icon = icon"
            >
              {{ icon.replace('mdi-', '') }}
            </v-chip>
          </div>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          color="error"
          variant="text"
          @click="cancelEdit"
        >
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          variant="text"
          @click="saveLink"
        >
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>