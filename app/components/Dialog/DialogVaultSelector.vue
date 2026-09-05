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

  const onlyAppIds = computed(() => props.onlyApps.map(app => app.id));
  const getOnlyApp = appId => props.onlyApps.find(app => app.id === appId);
  const getOnlyAppTitle = appId => getOnlyApp(appId)?.title || `App ${appId}`;

  const sortedModel = computed(() => {
    return [...model.value].sort((a, b) => getOnlyAppTitle(a.appId).localeCompare(getOnlyAppTitle(b.appId)));
  });

  const drafts = reactive({});

  const draft = (appId, index) => {
    const key = `${appId}-${index}`;
    if (!drafts[key]) {
      drafts[key] = { value: '', type: VaultEntry.enums.type.key };
    }

    return drafts[key];
  };

  const draftValue = (appId, index) => {
    return drafts[`${appId}-${index}`]?.value?.trim() || '';
  };

  const placeholders = {
    [VaultEntry.enums.type.key]: 'XXXXX-XXXXX-XXXXX',
    [VaultEntry.enums.type.gift]: 'https://store.steampowered.com/account/ackgift/XXXXXXXXXXXXXXXX',
    [VaultEntry.enums.type.link]: 'https://humblebundle.com/gift?key=XXXXXXXXXXXXXXXX',
    [VaultEntry.enums.type.curator]: 'https://store.steampowered.com/curator/XXXXXXXX/admin/pending'
  };

  const isIncomplete = computed(() => !props.onlyApps.every((app) => {
    const entry = model.value.find(item => item.appId === app.id);
    if (!entry) {
      return false;
    }

    for (let idx = 0; idx < (entry.total || 1); idx++) {
      if (entry.vaultEntries && entry.vaultEntries[idx]) {
        continue;
      }

      if (!draftValue(entry.appId, idx + 1)) {
        return false;
      }
    }

    return true;
  }));

  const missingPartnerVault = computed(() => {
    return user.value && !user.value.publicKey;
  });

  const vaultEntries = ref([]);

  const loadVaultEntries = async () => {
    vaultEntries.value = await VaultEntry.getValues(supabase, authUser.value.id, true, onlyAppIds.value, authUser.value.id);
    vaultEntries.value = await Promise.all(vaultEntries.value.map(async entry => ({
      ...entry,
      value: password.value ? await decrypt(entry.value, password.value) : '********'
    })));
  };

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

    await loadVaultEntries();

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

  const rowStates = reactive({});

  const rowState = (appId, index) => {
    const key = `${appId}-${index}`;
    if (!rowStates[key]) {
      rowStates[key] = { phase: 'idle', encryptedValue: '' };
    }

    return rowStates[key];
  };

  const isRowBusy = (appId, index) => {
    return ['encrypting', 'saving'].includes(rowState(appId, index).phase);
  };

  const isRowDone = (appId, index) => {
    return rowState(appId, index).phase === 'success';
  };

  const resetRowStates = () => {
    for (const key of Object.keys(rowStates)) {
      rowStates[key].phase = 'idle';
      rowStates[key].encryptedValue = '';
    }
  };

  watch(() => internalValue.value, (open) => {
    if (!open) {
      resetRowStates();
    }
  });

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
      // Collect new vault entries typed in by the user (still cleartext)
      const pendingDrafts = model.value.flatMap((item) => {
        const entries = [];
        for (let idx = 1; idx <= (item.total || 1); idx++) {
          const value = draftValue(item.appId, idx);
          if (value) {
            entries.push({ appId: item.appId, index: idx, value, type: draft(item.appId, idx).type });
          }
        }

        return entries;
      });

      const existingIds = new Set(vaultEntries.value.map(entry => entry.id));

      // Show a spinner on every row
      for (const item of model.value) {
        for (let idx = 1; idx <= (item.total || 1); idx++) {
          rowState(item.appId, idx).phase = 'encrypting';
        }
      }

      // Encrypt new entries for ourselves and surface the ciphertext
      const selfEncrypted = [];
      for (const { appId, index, value, type } of pendingDrafts) {
        const encryptedValue = await encrypt(value, authUser.value.publicKey);
        selfEncrypted.push({ appId, type, value: encryptedValue });
        rowState(appId, index).encryptedValue = encryptedValue;
      }

      // Encrypt existing entries for the trade partner
      const partnerEncrypted = [];
      for (const item of model.value) {
        for (const vaultEntryId of (item.vaultEntries || [])) {
          const entry = vaultEntries.value.find(entry => entry.id === vaultEntryId);
          if (entry) {
            partnerEncrypted.push({ vaultEntryId, value: await encrypt(entry.value, user.value.publicKey) });
          }
        }
      }

      // Move to the saving phase so new entries reveal their encrypted value
      for (const item of model.value) {
        for (let idx = 1; idx <= (item.total || 1); idx++) {
          const state = rowState(item.appId, idx);
          if (state.phase === 'encrypting') {
            state.phase = 'saving';
          }
        }
      }

      // Give the user a moment to see the encrypted value before saving
      if (pendingDrafts.length) {
        await new Promise(resolve => setTimeout(resolve, 1600));
      }

      // Save new entries to our vault
      for (const { appId, type, value } of selfEncrypted) {
        await VaultEntry.addValues(supabase, authUser.value.id, [{
          appid: appId,
          type,
          values: [value]
        }]);
      }

      for (const { appId, index } of pendingDrafts) {
        draft(appId, index).value = '';
      }

      if (pendingDrafts.length) {
        await loadVaultEntries();
      }

      // Link the newly created entries back to the trade apps
      const newEntriesByApp = {};
      for (const entry of vaultEntries.value) {
        if (!existingIds.has(entry.id)) {
          if (!newEntriesByApp[entry.appId]) {
            newEntriesByApp[entry.appId] = [];
          }

          newEntriesByApp[entry.appId].push(entry.id);
        }
      }

      for (const { appId, index } of pendingDrafts) {
        const item = model.value.find(i => i.appId === appId);
        const newIds = newEntriesByApp[appId] || [];
        const createdId = newIds[newIds.length - index];
        if (item && createdId) {
          item.vaultEntries[index - 1] = createdId;
        }
      }

      // Save partner-encrypted values for existing entries
      await Promise.all(partnerEncrypted.map(({ vaultEntryId, value }) =>
        new VaultEntry(vaultEntryId).addValue(user.value.id, value)
      ));

      // Save partner-encrypted values for newly created entries
      await Promise.all(pendingDrafts.map(async ({ appId, index, value }) => {
        const item = model.value.find(i => i.appId === appId);
        const vaultEntryId = item?.vaultEntries?.[index - 1];
        if (!vaultEntryId) {
          return;
        }

        const encryptedValue = await encrypt(value, user.value.publicKey);
        await new VaultEntry(vaultEntryId).addValue(user.value.id, encryptedValue);
      }));

      // Show the success state briefly before closing
      for (const item of model.value) {
        for (let idx = 1; idx <= (item.total || 1); idx++) {
          rowState(item.appId, idx).phase = 'success';
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      internalValue.value = false;
      emit('submit');
    } catch (error) {
      console.error(error);
      resetRowStates();
      snackbarStore.set('error', error.message || 'Failed to submit vault entries');
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
    <v-card>
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
            v-for="item in sortedModel"
            :key="item.appId"
          >
            <template v-if="onlyAppIds.includes(item.appId)">
              <v-row
                v-for="idx in item.total || 1"
                :key="`${item.appId}-${idx}`"
                class="vault-dialog-row"
                dense
              >
                <v-col
                  class="d-flex align-center"
                  cols="12"
                  sm="3"
                >
                  <div :class="['app-logo w-100', { overlayed: isRowBusy(item.appId, idx) || isRowDone(item.appId, idx) }]">
                    <nuxt-link
                      class="w-100 h-100"
                      rel="noopener"
                      target="_blank"
                      :to="`/app/${item.appId}`"
                    >
                      <v-img
                        v-ripple
                        :alt="getOnlyAppTitle(item.appId)"
                        class="app-logo__image"
                        cover
                        height="40"
                        lazy-src="/applogo.svg"
                        :src="`https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${item.appId}/header.jpg`"
                      />
                    </nuxt-link>
                    <div
                      v-if="isRowBusy(item.appId, idx) || isRowDone(item.appId, idx)"
                      class="app-logo__indicator"
                    >
                      <v-progress-circular
                        v-if="isRowBusy(item.appId, idx)"
                        color="white"
                        indeterminate
                        size="32"
                        width="2"
                      />
                      <v-icon
                        v-else
                        color="white"
                        icon="mdi-check"
                        size="40"
                      />
                    </div>
                  </div>
                </v-col>
                <v-col
                  cols="12"
                  sm="9"
                >
                  <v-scroll-x-transition mode="out-in">
                    <div
                      v-if="isRowDone(item.appId, idx)"
                      key="success"
                      class="d-flex align-center ga-1 w-100 h-100"
                    >
                      <span class="font-weight-medium text-success">{{ getOnlyAppTitle(item.appId) }} ready!</span>
                    </div>
                  </v-scroll-x-transition>
                  <v-text-field
                    v-if="!isRowDone(item.appId, idx) && rowState(item.appId, idx).phase === 'saving' && !vaultEntries.some(entry => entry.appId === item.appId)"
                    key="saving"
                    density="compact"
                    disabled
                    hide-details
                    :label="`${getOnlyAppTitle(item.appId)}${item.total > 1 ? ' #' + idx : ''}`"
                    :model-value="rowState(item.appId, idx).encryptedValue"
                    prepend-inner-icon="mdi-lock"
                    readonly
                    variant="outlined"
                  />
                  <div
                    v-else-if="!isRowDone(item.appId, idx) && vaultEntries.some(entry => entry.appId === item.appId)"
                    key="select"
                    class="d-flex align-center ga-1"
                  >
                    <v-select
                      v-model="item.vaultEntries[idx-1]"
                      clearable
                      density="compact"
                      :disabled="missingPartnerVault || isRowBusy(item.appId, idx)"
                      hide-details
                      item-title="value"
                      item-value="id"
                      :items="vaultEntries.filter(entry => entry.appId === item.appId)"
                      :label="`${getOnlyAppTitle(item.appId)}${item.total > 1 ? ' #' + idx : ''}`"
                      variant="outlined"
                    />
                    <v-btn
                      v-tooltip:left="'Add vault entry'"
                      color="primary"
                      :disabled="isRowBusy(item.appId, idx)"
                      icon="mdi-plus"
                      rel="noopener"
                      rounded
                      size="small"
                      target="_blank"
                      :to="`/vault?tab=unsent&appid=${item.appId}&action=add`"
                      variant="tonal"
                    />
                  </div>
                  <div
                    v-else-if="!isRowDone(item.appId, idx)"
                    key="text"
                    class="d-flex align-center ga-1"
                  >
                    <v-text-field
                      v-model="draft(item.appId, idx).value"
                      autofocus
                      density="compact"
                      hide-details
                      :label="`${getOnlyAppTitle(item.appId)}${item.total > 1 ? ' #' + idx : ''}`"
                      :placeholder="placeholders[draft(item.appId, idx).type]"
                      variant="outlined"
                    >
                      <template #prepend-inner>
                        <v-menu location="bottom start">
                          <template #activator="{ props: menuProps }">
                            <v-icon
                              v-bind="menuProps"
                              :icon="VaultEntry.icons[draft(item.appId, idx).type]"
                            />
                          </template>
                          <v-list>
                            <v-list-item
                              v-for="type in Object.values(VaultEntry.enums.type)"
                              :key="type"
                              :prepend-icon="VaultEntry.icons[type]"
                              :title="VaultEntry.labels[type]"
                              @click="draft(item.appId, idx).type = type"
                            />
                          </v-list>
                        </v-menu>
                      </template>
                    </v-text-field>
                  </div>
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

<style lang="scss" scoped>
  .app-logo {
    position: relative;

    .app-logo__indicator {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    &.overlayed {
      .app-logo__image:after {
        content: '';
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
      }
    }
  }
</style>
