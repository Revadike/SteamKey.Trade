<script setup>
  const { User } = useORM();
  const { user: authUser, preferences } = storeToRefs(useAuthStore());
  const { setPreferences } = useAuthStore();
  const snackbarStore = useSnackbarStore();

  const internalValue = ref(false);
  const loading = ref(false);

  const widgets = [
    { value: User.enums.widget.welcome, title: User.labels.welcome },
    { value: User.enums.widget.usersOnline, title: User.labels.usersOnline },
    { value: User.enums.widget.tradeActivity, title: User.labels.tradeActivity },
    { value: User.enums.widget.stats, title: User.labels.stats },
    { value: User.enums.widget.bundles, title: User.labels.bundles },
    { value: User.enums.widget.changelog, title: User.labels.changelog }
  ];

  // Create local copy of preferences that we can modify
  const selectedWidgets = ref([]);
  const defaultWidgets = Object.values(User.enums.widget);

  // Load current preferences when the dialog opens
  watch(internalValue, val => {
    if (val) {
      selectedWidgets.value = [...(preferences.value?.dashboardWidgets || defaultWidgets)];
    }
  });

  const resetToDefaults = () => {
    selectedWidgets.value = [...defaultWidgets];
  };

  const submit = async () => {
    loading.value = true;
    try {
      const user = new User(authUser.value.id);
      const updatedPreferences = await user.savePreferences({
        dashboardWidgets: selectedWidgets.value
      });

      setPreferences(updatedPreferences);
      snackbarStore.set('success', 'Dashboard preferences saved');
      internalValue.value = false;
    } catch (error) {
      console.error(error);
      snackbarStore.set('error', 'Failed to save preferences');
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
      <v-card-title>Dashboard Configuration</v-card-title>

      <v-card-text>
        <p class="text-subtitle-1 mb-2">
          Visible Widgets
        </p>
        <input-draggable-combobox
          v-model="selectedWidgets"
          closable-chips
          :items="widgets"
          label="Select widgets to display (drag to reorder)"
          multiple
          :return-object="false"
        />
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
