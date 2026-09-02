<script setup>
  // From the trade partner
  const props = defineProps({
    userId: {
      type: String,
      required: true
    },
    onlyApps: {
      type: Array,
      default: () => []
    }
  });

  const emit = defineEmits(['submit', 'vaultless']);

  const model = defineModel({
    type: Array,
    default: () => []
  });

  const { decrypt, encrypt } = useVaultSecurity();
  const { user: authUser, password } = toRefs(useAuthStore());
  const validPassword = ref(!!password.value);
  const snackbarStore = useSnackbarStore();
  const supabase = useSupabaseClient();
  const { VaultEntry } = useORM();
  const loading = ref(false);

  const { data: user, error: userError } = useSupabaseData('user', { id: props.userId });

  watch(() => userError.value, (error) => {
    if (error) {
      snackbarStore.set('error', 'Failed to load user');
    }
  });

  const internalValue = ref(false);
  // Ensure each model item has a vaultEntries array matching its total
  watch(
    () => model.value.map(item => item.total),
    () => {
      model.value.forEach((item) => {
        if (!Array.isArray(item.vaultEntries)) {
          item.vaultEntries = [];
        }

        // Ensure length matches total
        while (item.vaultEntries.length < (item.total || 1)) {
          item.vaultEntries.push(null);
        }
        if (item.vaultEntries.length > (item.total || 1)) {
          item.vaultEntries.splice(item.total || 1);
        }
      });
    },
    { immediate: true, deep: true }
  );

  const isIncomplete = computed(() => !props.onlyApps.every((appid) => {
    const entry = model.value.find(item => item.appId === appid);
    if (!entry) {
      return false;
    }

    for (let idx = 0; idx < (entry.total || 1); idx++) {
      if (!entry.vaultEntries || !entry.vaultEntries[idx]) {
        return false;
      }
    }

    return true;
  }));

  const missingPartnerVault = computed(() => {
    return user.value && !user.value.publicKey;
  });

  const vaultEntries = ref([]);
  watch([
    () => internalValue.value,
    () => model.value,
    () => validPassword.value
  ], async () => {
    if (!internalValue.value) {
      return;
    }

    if (!validPassword.value) {
      return;
    }

    if (!props.onlyApps.length) {
      return;
    }

    vaultEntries.value = await VaultEntry.getValues(supabase, authUser.value.id, true, props.onlyApps, authUser.value.id);
    vaultEntries.value = await Promise.all(vaultEntries.value.map(async entry => ({
      ...entry,
      value: password.value ? await decrypt(entry.value, password.value) : '********'
    })));

    await nextTick();

    for (let i = 0; i < model.value.length; i++) {
      model.value[i].vaultEntries = model.value[i].vaultEntries || (new Array(model.value[i].total || 1)).fill(null);
      for (let j = 0; j < (model.value[i].total || 1); j++) {
        // remove vault entries that are no longer available
        if (model.value[i].vaultEntries[j] && !vaultEntries.value.some(entry => entry.id === model.value[i].vaultEntries[j])) {
          model.value[i].vaultEntries[j] = null;
        }

        // automatically set the first available vault entry if not already set
        if (!model.value[i].vaultEntries[j] && vaultEntries.value.length > 0) {
          const appVaultEntries = vaultEntries.value.filter(entry => entry.appId === model.value[i].appId);
          model.value[i].vaultEntries[j] = appVaultEntries[j] ? appVaultEntries[j].id : null;
        }
      }
    }
  }, { immediate: true });

  const submit = async () => {
    if (isIncomplete.value) {
      snackbarStore.set('error', 'Please select a vault entry for each app');
      return;
    }

    if (!user.value.publicKey || !props.userId) {
      snackbarStore.set('error', 'Something went wrong. Please try again later.');
      return;
    }

    loading.value = true;
    try {
      // encrypt selected vault entries
      await Promise.all(model.value.flatMap(item =>
        (item.vaultEntries || []).map(async (vaultEntryId) => {
          const entry = vaultEntries.value.find(entry => entry.id === vaultEntryId);
          if (!entry) {
            return;
          }

          const encryptedValue = await encrypt(entry.value, user.value.publicKey);
          const instance = new VaultEntry(vaultEntryId);
          await instance.addValue(user.value.id, encryptedValue);
        })
      ));

      internalValue.value = false;
      emit('submit');
    } finally {
      loading.value = false;
    }
  };
</script>

<template>
  <v-dialog
    v-model="internalValue"
    transition="dialog-center-transition"
    width="500"
  >
    <template #activator="attrs">
      <slot
        name="activator"
        v-bind="attrs"
      />
    </template>
    <v-card :loading="loading">
      <v-card-title class="text-primary">
        Select your vault entries
      </v-card-title>
      <v-card-text
        v-if="authUser.publicKey"
        class="pa-0"
      >
        <dialog-vault-unlocker @unlocked="validPassword = true" />
        <v-container v-if="validPassword">
          <template
            v-for="item in model"
            :key="item.appId"
          >
            <template v-if="onlyApps.includes(item.appId)">
              <v-row
                v-for="idx in item.total || 1"
                :key="`${item.appId}-${idx}`"
              >
                <v-col
                  class="d-flex align-center"
                  cols="12"
                  sm="3"
                >
                  <nuxt-link
                    class="w-100 h-100"
                    rel="noopener"
                    target="_blank"
                    :to="`/app/${item.appId}`"
                  >
                    <v-img
                      v-ripple
                      :alt="`App ${item.appId}`"
                      cover
                      height="56"
                      lazy-src="/applogo.svg"
                      :src="`https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${item.appId}/header.jpg`"
                    />
                  </nuxt-link>
                </v-col>
                <v-col
                  cols="12"
                  sm="9"
                >
                  <v-select
                    v-model="item.vaultEntries[idx-1]"
                    clearable
                    :disabled="missingPartnerVault"
                    hide-details
                    item-title="value"
                    item-value="id"
                    :items="vaultEntries.filter(entry => entry.appId === item.appId)"
                    :label="`Vault entry${item.total > 1 ? ' #' + idx : ''}`"
                  >
                    <template #no-data>
                      <v-list-item
                        subtitle="Please add a new vault entry here"
                        target="_blank"
                        title="No vault entries left"
                        :to="`/vault?tab=unsent&appid=${item.appId}&action=add`"
                        @click="internalValue = false"
                      />
                    </template>
                  </v-select>
                </v-col>
              </v-row>
            </template>
          </template>
          <div class="mt-4 text-center">
            <small
              v-if="isIncomplete || missingPartnerVault"
              class="text-warning"
            >
              <v-icon
                icon="mdi-alert-circle-outline"
                start
              />
              {{
                missingPartnerVault
                  ? 'Your partner vault hasn\'t been set up yet. Please ask them to set it up, or choose the off-platform option.'
                  : 'Incomplete! Please select a vault entry for each app.'
              }}
            </small>
          </div>
        </v-container>
      </v-card-text>
      <v-card-text
        v-else
        class="text-center px-10"
      >
        <v-icon
          class="mb-2"
          icon="mdi-shield-alert-outline"
          size="64"
        />

        <h2 class="mb-2">
          Vault not set up
        </h2>

        <p class="mb-6">
          Create your vault to select entries for trades and keep your exchanges secure.
        </p>

        <v-btn
          color="info"
          prepend-icon="mdi-lock-plus-outline"
          to="/vault"
          variant="tonal"
        >
          Set up my vault
        </v-btn>

        <div class="mt-4">
          <small class="text-disabled">
            You can also choose to exchange off-platform if both parties agree.
          </small>
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
        <v-spacer />

        <dialog-confirm
          color="warning"
          confirm-text="Confirm"
          title="Exchange off-platform"
          @confirm="emit('vaultless'); internalValue = false"
        >
          <template #activator="attrs">
            <small
              class="text-decoration-underline cursor-pointer"
              v-bind="attrs.props"
            >
              I prefer to exchange off-platform
            </small>
          </template>

          <template #body>
            <v-alert
              icon="mdi-alert"
              type="warning"
              variant="outlined"
            >
              <p>Are you sure you wish to trade outside of SteamKey.Trade?</p>
              <br>
              <p>Beware that trading off-platform carries a higher risk, as tracking the exchange will not be possible. This can make resolving potential disputes significantly more difficult.</p>
              <br>
              <p>To successfully mark this trade as completed, <b>both parties must acknowledge and agree to do the exchange outside the platform.</b> Communicate this with your trade partner.</p>
            </v-alert>
          </template>
        </dialog-confirm>

        <v-spacer />
        <v-btn
          color="primary"
          :disabled="!validPassword || isIncomplete || loading || missingPartnerVault"
          :loading="loading"
          variant="tonal"
          @click="submit"
        >
          Submit
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
