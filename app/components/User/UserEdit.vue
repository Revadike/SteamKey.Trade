<script setup>
  import { isSteamID64 } from '~/assets/js/validate';
  import countries from '@@/supabase/functions/_assets/countries.json';

  const { user: authUser, preferences, setPhotoUrl, setPreferences } = useAuthStore();
  const { User } = useORM();
  const supabase = useSupabaseClient();
  const snackbarStore = useSnackbarStore();

  const saving = ref(false);
  const valid = ref(false);
  const avatar = ref(null);
  const background = ref(null);

  // Custom URL validation
  const urlRules = [
    v => /^[a-zA-Z0-9_-]+$/.test(v) || 'Only letters, numbers, underscores and hyphens are allowed',
    v => !v || !isSteamID64(v) || 'Steam ID is not allowed as custom URL'
  ];

  const regions = countries.map(country => ({
    title: country.name,
    value: country.alpha2
  }));

  const enabledNotifications = ref(preferences.enabledNotifications || []);
  const automaticLibrarySync = ref(preferences.automaticLibrarySync ?? true);
  const automaticWishlistSync = ref(preferences.automaticWishlistSync ?? true);
  const trackVaultCopies = ref(preferences.trackVaultCopies ?? false);
  const { data: user, status, error } = useSupabaseData('user', { id: authUser.id });

  // Set avatar and background refs when user data loads
  watch(() => user.value, data => {
    if (data?.avatar) {
      avatar.value = { url: data.avatar };
    }
    if (data?.background) {
      background.value = { url: data.background };
    }
  }, { immediate: true });

  watch(() => error.value, error => {
    if (error) {
      throw error;
    }
  }, { immediate: true });

  const uploadFile = async ({ file, crop }, bucket) => {
    if (!file) { return null; }

    try {
      let processedFile = file;

      // If crop data is provided, crop and resize the image
      if (crop && crop.width && crop.height) {
        // Create a canvas to crop the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size to the cropped dimensions
        canvas.width = crop.width;
        canvas.height = crop.height;

        // Create an image element to load the original file
        const img = new Image();
        img.src = URL.createObjectURL(file);

        // Wait for the image to load
        await new Promise((resolve) => {
          img.onload = resolve;
        });

        // Draw the cropped portion of the image onto the canvas
        ctx.drawImage(
          img,
          crop.x, // source x
          crop.y, // source y
          crop.width, // source width
          crop.height, // source height
          0, // destination x
          0, // destination y
          crop.width, // destination width
          crop.height // destination height
        );

        // Convert canvas to a file
        processedFile = await (await fetch(canvas.toDataURL())).blob();
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${authUser.id}.${fileExt}`;

      const { error } = await supabase.storage
        .from(bucket)
        .upload(fileName, processedFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) { throw error; }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);

      return `${publicUrl}?t=${Date.now()}`;
    } catch (error) {
      snackbarStore.set('error', `Upload failed: ${error.message}`);
      return null;
    }
  };

  const saveProfile = async () => {
    if (!valid.value) {
      snackbarStore.set('warning', 'Please check the form for errors');
      return;
    }

    saving.value = true;

    try {
      const instance = new User(user.value.id);
      Object.assign(instance, user.value);

      // Upload avatar and background
      const [avatarUrl, backgroundUrl] = await Promise.all([
        avatar.value ? uploadFile(avatar.value, 'avatars') : Promise.resolve(null),
        background.value ? uploadFile(background.value, 'backgrounds') : Promise.resolve(null)
      ]);

      if (avatarUrl) {
        instance.avatar = avatarUrl;
      }

      if (backgroundUrl) {
        instance.background = backgroundUrl;
      }

      // Update user in Supabase
      await instance.save();

      // Update auth store
      setPhotoUrl(instance.avatar);

      // Update user preferences
      const savedPreferences = await instance.savePreferences({
        enabledNotifications: enabledNotifications.value,
        trackVaultCopies: trackVaultCopies.value,
        automaticLibrarySync: automaticLibrarySync.value,
        automaticWishlistSync: automaticWishlistSync.value
      });

      // Update auth store preferences
      setPreferences(savedPreferences);

      snackbarStore.set('success', 'Profile saved successfully');
      await navigateTo(`/user/${user.value.customUrl || authUser.steamId}`);
    } catch (error) {
      console.error(error);
      snackbarStore.set('error', 'Something went wrong, please try again.');
    } finally {
      saving.value = false;
    }
  };

  const title = 'Settings';
  const breadcrumbs = computed(() => [
    { title: 'Home', to: '/' },
    { title: 'Users', to: '/users' },
    { title: user.value?.displayName || 'Profile', to: `/user/${user.value?.customUrl || authUser.id}` },
    { title, disabled: true }
  ]);

  useSeoMeta({ title, ogTitle: title });
</script>

<template>
  <s-page-content
    :breadcrumbs="breadcrumbs"
    :loading="status === 'pending'"
  >
    <v-form
      v-model="valid"
      @submit.prevent="saveProfile"
    >
      <!-- Profile Appearance -->
      <v-card class="mb-4">
        <v-card-title>Profile Appearance</v-card-title>
        <v-card-text>
          <div class="d-flex flex-row flex-wrap ga-4">
            <input-image
              v-model="avatar"
              :accepts="['image/jpeg', 'image/png']"
              aspect-ratio="1:1"
              cropped
              cropper-eager
              :hint="User.descriptions.avatar"
              :label="User.labels.avatar"
            />

            <input-image
              v-model="background"
              :accepts="['image/jpeg', 'image/png']"
              aspect-ratio="16:9"
              cropped
              cropper-eager
              :hint="User.descriptions.background"
              :label="User.labels.background"
            />

            <v-row>
              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model="user.displayName"
                  :hint="User.descriptions.displayName"
                  :label="User.labels.displayName"
                  persistent-hint
                  required
                />
              </v-col>

              <v-col
                cols="12"
                md="3"
              >
                <v-text-field
                  v-model="user.customUrl"
                  :hint="User.descriptions.customUrl"
                  :label="User.labels.customUrl"
                  persistent-hint
                  :rules="urlRules"
                />
              </v-col>

              <v-col
                cols="12"
                md="3"
              >
                <v-select
                  v-model="user.region"
                  clearable
                  :hint="User.descriptions.region"
                  :items="regions"
                  :label="User.labels.region"
                  persistent-hint
                />
              </v-col>

              <v-col cols="12">
                <v-textarea
                  v-model="user.bio"
                  :hint="User.descriptions.bio"
                  :label="User.labels.bio"
                  persistent-hint
                  rows="4"
                />
              </v-col>
            </v-row>
          </div>
        </v-card-text>
      </v-card>

      <!-- Account Connections -->
      <v-card class="mb-4">
        <v-card-title>Account Connections</v-card-title>
        <v-card-text>
          <v-row>
            <v-col
              cols="12"
              md="4"
            >
              <v-text-field
                v-model="user.discordId"
                :hint="User.descriptions.discordId"
                :label="User.labels.discordId"
                persistent-hint
                :rules="[v => !v || (/^\d{17,19}$/.test(v)) || 'Invalid Discord ID']"
              />
            </v-col>
            <v-col
              cols="12"
              md="8"
            >
              <v-combobox
                hint="Your connected Steam account"
                :items="[authUser.steamId]"
                label="Steam Connection"
                menu-icon=""
                :model-value="authUser.steamId"
                persistent-hint
                readonly
                variant="plain"
              >
                <template #selection>
                  <v-chip
                    size="small"
                    @click="() => navigateTo(`https://steamcommunity.com/profiles/${authUser.steamId}`, {
                      external: true,
                      open: { target: '_blank' }
                    })"
                  >
                    <v-icon
                      class="mr-1"
                      icon="mdi-steam"
                    />
                    {{ authUser.steamId }}
                  </v-chip>
                </template>
              </v-combobox>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- Preferences -->
      <v-card class="mb-4">
        <v-card-title>Preferences</v-card-title>
        <v-card-text>
          <v-row>
            <!-- Notifications Section -->
            <v-col
              cols="12"
              md="4"
            >
              <div class="text-subtitle-1 mb-2">
                Notifications
              </div>
              <v-checkbox
                v-for="(value, key) in User.enums.notification"
                :key="key"
                v-model="enabledNotifications"
                density="compact"
                hide-details
                :label="User.labels[key]"
                :value="value"
              />
            </v-col>

            <!-- Steam & Vault Settings Section -->
            <v-col
              cols="12"
              md="8"
            >
              <div class="text-subtitle-1 mb-2">
                Collections
              </div>
              <v-switch
                v-model="automaticLibrarySync"
                color="primary"
                density="compact"
                :hint="User.descriptions.automaticLibrarySync"
                :label="User.labels.automaticLibrarySync"
                persistent-hint
              />
              <v-switch
                v-model="automaticWishlistSync"
                color="primary"
                density="compact"
                :hint="User.descriptions.automaticWishlistSync"
                :label="User.labels.automaticWishlistSync"
                persistent-hint
              />

              <div class="text-subtitle-1 mb-2 mt-4">
                Vault
              </div>
              <v-switch
                v-model="trackVaultCopies"
                color="primary"
                density="compact"
                :hint="User.descriptions.trackVaultCopies"
                :label="User.labels.trackVaultCopies"
                persistent-hint
              />
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- Actions -->
      <v-card>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="primary"
            :disabled="!valid"
            :loading="saving"
            type="submit"
            variant="tonal"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-form>
  </s-page-content>
</template>
