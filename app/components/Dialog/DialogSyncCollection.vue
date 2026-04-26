<script setup>
  const { Collection, User } = useORM();
  const { user, preferences, setPreferences } = useAuthStore();

  const internalValue = ref(false);

  const { sync: syncWishlist, loading: loadingWishlist } = useSteamSync(Collection.enums.type.wishlist);
  const { sync: syncLibrary, loading: loadingLibrary } = useSteamSync(Collection.enums.type.library);

  const loading = computed(() => loadingWishlist.value || loadingLibrary.value);

  const automaticLibrarySync = ref(preferences.automaticLibrarySync ?? true);
  const automaticWishlistSync = ref(preferences.automaticWishlistSync ?? true);

  const snackbarStore = useSnackbarStore();
  const saveSyncPreferences = async () => {
    try {
      const instance = new User(user.id);
      const savedPreferences = await instance.savePreferences({
        automaticLibrarySync: automaticLibrarySync.value,
        automaticWishlistSync: automaticWishlistSync.value
      });
      setPreferences(savedPreferences);
      snackbarStore.set('success', 'Sync preferences updated');
    } catch (error) {
      console.error(error);
      snackbarStore.set('error', 'Unable to save sync preferences');
    }
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
    <v-card :loading="loading">
      <v-card-title>
        Synchronize Master Collections
      </v-card-title>
      <v-card-text>
        <div class="d-flex flex-row align-center ga-4">
          <v-btn
            class="flex-grow-1"
            :disabled="loadingLibrary"
            :loading="loadingWishlist"
            variant="tonal"
            @click="syncWishlist"
          >
            <v-icon
              class="mr-2"
              icon="mdi-sync"
            />
            Sync with Steam Wishlist
          </v-btn>

          <v-switch
            v-model="automaticWishlistSync"
            color="primary"
            density="compact"
            hide-details
            label="Automatic"
            @update:model-value="saveSyncPreferences"
          />
        </div>

        <div class="d-flex flex-row align-center ga-4 mt-4">
          <v-btn
            class="flex-grow-1"
            :disabled="loadingWishlist"
            :loading="loadingLibrary"
            variant="tonal"
            @click="syncLibrary"
          >
            <v-icon
              class="mr-2"
              icon="mdi-sync"
            />
            Sync with Steam Library
          </v-btn>

          <v-switch
            v-model="automaticLibrarySync"
            color="primary"
            density="compact"
            hide-details
            label="Automatic"
            @update:model-value="saveSyncPreferences"
          />
        </div>
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-btn
          variant="text"
          @click="internalValue = false"
        >
          Cancel
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
