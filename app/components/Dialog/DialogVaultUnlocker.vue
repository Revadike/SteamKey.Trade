<script setup>
  const { user, password } = storeToRefs(useAuthStore());
  const { setPassword } = useAuthStore();
  const { validate } = useVaultSecurity();

  const passwordInput = ref('');
  const validPassword = ref(!!password.value);
  const forget = ref(true);
  const invalidPassword = computed(() => !validPassword.value);

  const emit = defineEmits(['unlocked']);

  const check = async (pwd, persistPassword = true) => {
    const valid = await validate(pwd);
    if (valid) {
      if (persistPassword) {
        setPassword(pwd, forget.value ? 60 * 60 * 1000 : false);
      }
      emit('unlocked');
    }
    validPassword.value = valid;
  };

  if (validPassword.value) {
    check(password.value, false);
  }
</script>

<template>
  <div>
    <dialog-vault-security v-if="!user.publicKey" />

    <v-dialog
      v-else-if="!validPassword"
      v-model="invalidPassword"
      max-width="360"
      persistent
    >
      <v-card>
        <v-card-title>
          Enter your vault password
        </v-card-title>
        <v-card-text>
          <input-password
            v-model="passwordInput"
            hide-details
            @keyup.enter="check(passwordInput, true)"
          />
          <v-checkbox
            v-model="forget"
            hide-details
            label="Forget after 1 hour"
          />
        </v-card-text>
        <v-card-actions>
          <v-btn
            to="/"
            variant="text"
          >
            Cancel
          </v-btn>
          <v-spacer />
          <v-btn
            :disabled="!passwordInput"
            variant="tonal"
            @click="check(passwordInput, true)"
          >
            Submit
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
