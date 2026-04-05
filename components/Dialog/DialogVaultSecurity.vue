<script setup>
  const dialog = ref(true);
  const isLoading = ref(false);
  const password = ref('');
  const valid = ref(false);
  const showPassword = ref(false);
  const { setup } = useVaultSecurity();

  const submit = async () => {
    isLoading.value = true;
    await setup(password.value);
    isLoading.value = false;
    dialog.value = false;
  };
</script>

<template>
  <v-dialog
    v-model="dialog"
    persistent
    width="720"
  >
    <v-form
      ref="form"
      v-model="valid"
    >
      <v-card>
        <v-card-title>
          Vault Security Setup
        </v-card-title>
        <v-card-text>
          <v-alert
            icon="mdi-information-outline"
            text="It looks like you have not set up your vault security yet. Please enter a secure password for us to generate encryption keys."
            variant="tonal"
          />

          <v-text-field
            v-model="password"
            :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
            autocomplete="new-password"
            class="my-6"
            label="Password"
            prepend-inner-icon="mdi-lock"
            :rules="[
              v => !!v || 'Enter a password',
              v => (!!v && v.length >= 12) || 'Use at least 12 characters',
              v => /[0-9]/.test(v) || 'Use at least one number',
              v => /[a-z]/.test(v) || 'Use at least one lowercase letter',
              v => /[A-Z]/.test(v) || 'Use at least one uppercase letter',
            ]"
            :type="showPassword ? 'text' : 'password'"
            variant="outlined"
            @click:append-inner="showPassword = !showPassword"
          />
          <v-alert
            v-if="password"
            color="warning"
            icon="mdi-alert-outline"
            text="Do not lose this password! If you do, you will lose the ability to decrypt your vault entries. We do not store your password, so we cannot recover it for you."
            variant="tonal"
          />
        </v-card-text>
        <v-card-actions>
          <v-btn
            text
            to="/"
          >
            Cancel
          </v-btn>

          <v-spacer />

          <v-btn
            :disabled="!valid || isLoading"
            :loading="isLoading"
            type="submit"
            @click="submit(isActive)"
          >
            Submit
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-form>
  </v-dialog>
</template>
