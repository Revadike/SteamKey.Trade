<script setup>
  const { user, setUser } = useAuthStore();
  const { User } = useORM();
  const snackbarStore = useSnackbarStore();

  const dialog = ref(false);
  const isLoading = ref(false);
  const discordId = ref('');
  const valid = ref(false);

  // Check if dialog should be shown
  const shouldShowDialog = computed(() => {
    if (!user) { return false; }

    // If user already has Discord ID, don't show
    if (user.discordId) { return false; }

    // Check if updatedAt is null or before max(createdAt, 2025-09-16)
    const cutoffDate = new Date('2025-09-16');
    const createdAt = user.createdAt ? new Date(user.createdAt) : null;
    const updatedAt = user.updatedAt ? new Date(user.updatedAt) : null;

    // Use the later of createdAt or cutoff date
    const thresholdDate = createdAt && createdAt > cutoffDate ? createdAt : cutoffDate;

    // Show dialog if updatedAt is null or before threshold
    return !updatedAt || updatedAt < thresholdDate;
  });

  // Watch for changes and show dialog when conditions are met
  watch(() => shouldShowDialog.value, (show) => {
    if (show) {
      dialog.value = true;
    }
  }, { immediate: true });

  const submitDiscordId = async () => {
    if (!valid.value) { return; }

    isLoading.value = true;

    try {
      const userInstance = new User(user.id);
      userInstance.discordId = discordId.value;

      // Save the user with Discord ID
      await userInstance.save();

      // Update auth store
      setUser({ ...user, discordId: discordId.value });

      snackbarStore.set('success', 'Discord ID saved successfully!');
      dialog.value = false;
    } catch (error) {
      console.error(error);
      snackbarStore.set('error', 'Failed to save Discord ID. Please try again.');
    } finally {
      isLoading.value = false;
    }
  };

  const dismiss = async () => {
    isLoading.value = true;

    try {
      const userInstance = new User(user.id);
      // Just save without any changes to update the updatedAt timestamp
      await userInstance.save();

      // Update auth store with current timestamp
      setUser({ ...user, updatedAt: new Date().toISOString() });

      dialog.value = false;
    } catch (error) {
      console.error(error);
      snackbarStore.set('error', 'Something went wrong. Please try again.');
    } finally {
      isLoading.value = false;
    }
  };
</script>

<template>
  <v-dialog
    v-model="dialog"
    max-width="600"
    persistent
  >
    <v-form
      v-model="valid"
      @submit.prevent="submitDiscordId"
    >
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon
            class="mr-2"
            icon="icon-discord"
          />
          Connect Your Discord Account
        </v-card-title>

        <v-card-text>
          <p>
            Connect your Discord account to receive notifications on our <a
              href="https://discord.gg/ngJ7RmePM4"
              target="_blank"
            >
              {{ 'Discord server' }}
            </a> for new and accepted trade offers.
          </p>
          <p class="mt-2 mb-6">
            You can always add or change your Discord ID later in your <nuxt-link to="/settings">
              {{ 'profile settings' }}
            </nuxt-link>.
          </p>

          <v-text-field
            v-model="discordId"
            class="mb-6"
            clearable
            :hint="User.descriptions.discordId"
            :label="User.labels.discordId"
            persistent-hint
            prepend-inner-icon="icon-discord"
            :rules="[
              v => !!v || 'Discord ID is required',
              v => /^\d{17,19}$/.test(v) || 'Invalid Discord ID format'
            ]"
            variant="outlined"
          />

          <v-card
            class="mt-4"
            color="surface-variant"
            variant="tonal"
          >
            <v-card-text>
              <div class="d-flex align-start">
                <div class="flex-grow-1">
                  <h4 class="mb-2">
                    How to find your Discord User ID:
                  </h4>
                  <ol class="pl-4">
                    <li>Open Discord and go to User Settings (gear icon)</li>
                    <li>Navigate to Advanced settings</li>
                    <li>Enable "Developer Mode"</li>
                    <li>Right-click on your username and select "Copy User ID"</li>
                  </ol>
                </div>
                <v-img
                  alt="Discord User ID location"
                  src="/discord.png"
                  width="250"
                />
              </div>
            </v-card-text>
          </v-card>
        </v-card-text>

        <v-card-actions>
          <v-btn
            :disabled="isLoading"
            text
            @click="dismiss"
          >
            Maybe Later
          </v-btn>

          <v-spacer />

          <v-btn
            color="primary"
            :disabled="!valid || isLoading"
            :loading="isLoading"
            type="submit"
            variant="tonal"
          >
            Connect Discord
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-form>
  </v-dialog>
</template>