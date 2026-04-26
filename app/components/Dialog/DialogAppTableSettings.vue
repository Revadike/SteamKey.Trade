<script setup>
  const { user, preferences } = storeToRefs(useAuthStore());
  const { setPreferences } = useAuthStore();
  const snackbarStore = useSnackbarStore();
  const { User, App } = useORM();

  const internalValue = ref(false);
  const loading = ref(false);

  const defaults = {
    appColumns: [
      App.fields.title,
      App.fields.type,
      App.fields.retailPrice,
      App.fields.marketPrice,
      App.fields.plusOne,
      App.fields.cards,
      App.fields.achievements,
      App.fields.tradelists,
      App.fields.wishlists
    ],
    appLinks: [
      { title: 'Homepage', url: '{website}' },
      { title: 'Steam Store', url: 'https://store.steampowered.com/app/{appid}' },
      { title: 'Steam Community', url: 'https://steamcommunity.com/app/{appid}' },
      { title: 'SteamDB', url: 'https://steamdb.info/app/{appid}/' },
      { title: 'GG.deals', url: 'https://gg.deals/steam/app/{appid}/' }
    ]
  };

  // Create local copies of preferences that we can modify
  const selectedProperties = ref(defaults.appColumns);
  const customLinks = ref(defaults.appLinks);

  // Load current preferences when dialog opens
  watch(internalValue, val => {
    if (val) {
      selectedProperties.value = [...preferences.value?.appColumns || defaults.appColumns];
      customLinks.value = [...preferences.value?.appLinks || defaults.appLinks];
    }
  });

  const getPropertyLabel = key => {
    const reversed = Object.fromEntries(
      Object.entries(App.fields).map(([k, v]) => [v, k])
    );
    return App.labels[reversed[key]] || App.labels[key] || key;
  };

  const newLink = ref({ title: '', url: '' });
  const activeIndexSet = reactive(new Set());
  const hoveredIndexSet = reactive(new Set());

  const addLinkFromNew = () => {
    if (newLink.value.title || newLink.value.url) {
      customLinks.value.push({ ...newLink.value });
      newLink.value.title = '';
      newLink.value.url = '';
    }
  };

  const removeLink = index => {
    customLinks.value.splice(index, 1);
  };

  const resetToDefaults = () => {
    selectedProperties.value = [...defaults.appColumns];
    customLinks.value = [...defaults.appLinks];
  };

  const submit = async () => {
    loading.value = true;
    try {
      const instance = new User(user.value.id);
      const newPeferences = await instance.savePreferences({
        appColumns: selectedProperties.value,
        appLinks: customLinks.value
      });
      setPreferences(newPeferences);
      snackbarStore.set('success', 'Table preferences updated');
      internalValue.value = false;
    } catch (error) {
      console.error(error);
      snackbarStore.set('error', 'Failed to update preferences');
    }
    loading.value = false;
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

    <v-card :loading="loading">
      <v-card-title>
        <v-icon
          icon="mdi-cog"
          size="24"
        />
        Table Configuration
      </v-card-title>

      <v-card-text>
        <v-row>
          <v-col cols="12">
            <p class="text-subtitle-1 mb-2">
              Visible Columns
            </p>
            <input-draggable-combobox
              v-model="selectedProperties"
              chips
              closable-chips
              :item-title="getPropertyLabel"
              :items="Object.values(App.fields)"
              label="Select columns to display"
              multiple
            />
          </v-col>

          <v-col cols="12">
            <p class="text-subtitle-1 mb-2">
              Custom Links
            </p>
            <v-list>
              <v-list-item
                v-for="(link, index) in customLinks"
                :key="index"
                class="pa-0"
                :class="{ 'faded': !activeIndexSet.has(index) && !hoveredIndexSet.has(index) }"
                @mouseenter="hoveredIndexSet.add(index)"
                @mouseleave="hoveredIndexSet.delete(index)"
              >
                <v-row
                  align="center"
                  dense
                  @focusin="activeIndexSet.add(index)"
                  @focusout="activeIndexSet.delete(index)"
                >
                  <v-col cols="5">
                    <v-text-field
                      v-model="link.title"
                      density="compact"
                      hide-details
                      label="Title"
                    />
                  </v-col>
                  <v-col cols="6">
                    <v-text-field
                      v-model="link.url"
                      density="compact"
                      hide-details
                      label="URL"
                    />
                  </v-col>
                  <v-col
                    align-self="center"
                    cols="1"
                  >
                    <v-btn
                      color="error"
                      density="compact"
                      icon="mdi-close"
                      rounded
                      size="large"
                      variant="text"
                      @click="removeLink(index)"
                    />
                  </v-col>
                </v-row>
              </v-list-item>

              <v-list-item class="pa-0">
                <v-row
                  align="center"
                  dense
                >
                  <v-col cols="5">
                    <v-text-field
                      v-model="newLink.title"
                      density="compact"
                      hide-details
                      label="Title"
                    />
                  </v-col>
                  <v-col cols="6">
                    <v-text-field
                      v-model="newLink.url"
                      density="compact"
                      hide-details
                      label="URL"
                    />
                  </v-col>
                  <v-col
                    align-self="center"
                    cols="1"
                  >
                    <v-btn
                      color="success"
                      density="compact"
                      :disabled="!newLink.title || !newLink.url"
                      icon="mdi-plus"
                      rounded
                      size="large"
                      variant="text"
                      @click="addLinkFromNew"
                    />
                  </v-col>
                </v-row>
              </v-list-item>
            </v-list>
          </v-col>

          <v-col cols="12">
            <v-expansion-panels>
              <v-expansion-panel
                color="secondary"
                title="Variables"
              >
                <template #text>
                  <v-table class="mt-2">
                    <tbody>
                      <tr
                        v-for="field in Object.values(App.fields)"
                        :key="field"
                      >
                        <td class="text-overline">
                          {{ getPropertyLabel(field) }}
                        </td>
                        <td>
                          {{ `{${field}\}` }}
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                </template>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-col>
        </v-row>
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-btn
          color="error"
          variant="text"
          @click="resetToDefaults"
        >
          Reset to Defaults
        </v-btn>
        <v-spacer />
        <v-btn
          color="disabled"
          variant="text"
          @click="internalValue = false"
        >
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          variant="tonal"
          @click="submit"
        >
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style lang="scss" scoped>
  .faded {
    opacity: 0.5;
    transition: opacity 0.2s ease;
  }
</style>
