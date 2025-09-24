<script setup>
  import jsonToCsvExport from 'json-to-csv-export';

  import { formatNumber, formatDate } from '~/assets/js/format';

  const snackbarStore = useSnackbarStore();
  const { user, password } = storeToRefs(useAuthStore());
  const { decrypt } = useVaultSecurity();
  const { App, VaultEntry, Trade } = useORM();

  const route = useRoute();
  const supabase = useSupabaseClient();

  const table = ref(null);
  const activeTab = useSearchParam('tab', 'unsent');
  const activeApp = useSearchParam('appid', null);
  const activeDialog = ref(route.query.appid && route.query.action === 'add');

  // Reset active app when tab changes
  watch(activeTab, () => {
    activeApp.value = null;
  });

  // TODO: Use vault entry count instead of app count
  const { data: counts, refresh } = useLazyAsyncData('vault-counts', async () => {
    // Same query as TableApps
    const baseQuery = () => supabase
      .from(App.table)
      .select(`*,
        ${VaultEntry.table}!inner(
          ${VaultEntry.fields.userId},
          ${VaultEntry.fields.tradeId}
        ),
        ${Trade.apps.table}!inner(
          ${Trade.apps.fields.appId},
          ${Trade.apps.fields.tradeId},
          ${Trade.apps.fields.selected},
          ${Trade.apps.fields.userId}
        )
      `, { count: 'exact', head: true })
      // Only our vault apps (we don't have access to other's vault items anyway)
      .eq(`${VaultEntry.table}.${VaultEntry.fields.userId}`, user.value.id);

    const [unsent, sent, received] = await Promise.all([
      baseQuery()
        // Only unsent vault items
        .is(`${VaultEntry.table}.${VaultEntry.fields.tradeId}`, null),
      baseQuery()
        // Only sent vault items
        .not(`${VaultEntry.table}.${VaultEntry.fields.tradeId}`, 'is', null)
        // Only those that were selected in a trade
        .eq(`${Trade.apps.table}.${Trade.apps.fields.selected}`, true)
        // Only items that came from me
        .eq(`${Trade.apps.table}.${Trade.apps.fields.userId}`, user.value.id),
      baseQuery()
        // Only sent vault items
        .not(`${VaultEntry.table}.${VaultEntry.fields.tradeId}`, 'is', null)
        // Only those that were selected in a trade
        .eq(`${Trade.apps.table}.${Trade.apps.fields.selected}`, true)
        // Only items that came from the other user
        .neq(`${Trade.apps.table}.${Trade.apps.fields.userId}`, user.value.id)
    ]);

    return {
      unsent: unsent.count || 0,
      sent: sent.count || 0,
      received: received.count || 0
    };
  });

  const headers = computed(() => [
    { title: VaultEntry.labels.createdAt, value: VaultEntry.fields.createdAt, sortable: true },
    { title: VaultEntry.labels.type, value: `${VaultEntry.table}.${VaultEntry.fields.type}`, sortable: false },
    { title: VaultEntry.labels.value, value: VaultEntry.values.fields.value, sortable: false },
    ...(activeTab.value === 'unsent' ? [] : [{
      title: activeTab.value === 'sent' ? VaultEntry.labels.to : VaultEntry.labels.from,
      value: `${VaultEntry.table}.${Trade.table}`
    }]),
    { title: VaultEntry.labels.actions, value: 'actions', sortable: false, align: 'end' }
  ]);

  const queryGetter = () => {
    const query = supabase
      .from(VaultEntry.values.table)
      .select(`*,
        ${VaultEntry.table}!inner(*,
          ${Trade.table}(
            ${Trade.fields.id},
            ${Trade.fields.receiverId},
            ${Trade.fields.senderId}
          ),
          is_sent
        )
      `)
      .eq(VaultEntry.values.fields.receiverId, user.value.id)
      .eq(`${VaultEntry.table}.${VaultEntry.fields.appId}`, activeApp.value);

    if (activeTab.value === 'unsent') {
      return query.is(`${VaultEntry.table}.${VaultEntry.fields.tradeId}`, null);
    } else if (activeTab.value === 'sent') {
      return query
        .not(`${VaultEntry.table}.${VaultEntry.fields.tradeId}`, 'is', null)
        .eq(`${VaultEntry.table}.is_sent`, true);
    } else if (activeTab.value === 'received') {
      return query
        .not(`${VaultEntry.table}.${VaultEntry.fields.tradeId}`, 'is', null)
        .eq(`${VaultEntry.table}.is_sent`, false);
    }

    return query;
  };

  const mapItem = async item => ({
    ...item,
    [VaultEntry.values.fields.value]: password.value ? await decrypt(item[VaultEntry.values.fields.value], password.value) : '********'
  });

  const loadEntries = async appid => {
    activeApp.value = null;
    await nextTick();
    activeApp.value = appid;
  };

  const deleteEntry = async item => {
    const { error } = await supabase
      .from(VaultEntry.table)
      .delete()
      .eq(VaultEntry.fields.id, item[VaultEntry.values.fields.vaultEntryId]);

    if (error) {
      snackbarStore.set('error', 'Failed to delete entry');
      return;
    }

    snackbarStore.set('success', 'Entry deleted successfully');
    counts.value[activeTab.value]--;
    await table.value?.refresh?.();
  };

  // on Escape key press, clear active app
  const clearApp = event => {
    if (event.key === 'Escape') {
      activeApp.value = null;
    }
  };

  const onImport = async () => {
    await Promise.all([
      table.value?.refresh?.(),
      refresh()
    ]);
    activeDialog.value = false;
  };

  onMounted(() => {
    window.addEventListener('keydown', clearApp);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', clearApp);
  });

  const copy = value => {
    navigator.clipboard.writeText(value);
    snackbarStore.set('success', 'Copied to clipboard');
  };

  const reveal = async item => {
    const instance = new VaultEntry(item[VaultEntry.table][VaultEntry.fields.id]);
    instance.revealedAt = new Date();
    await instance.save();
    await table.value?.refresh?.();
  };

  const exporting = ref(false);
  const exportVault = async () => {
    exporting.value = true;

    const { data: rawData, error } = await supabase.rpc('get_vault_entries', {
      p_user_id: user.value.id
    });

    if (error) {
      snackbarStore.set('error', 'Failed to export vault');
      exporting.value = false;
      return;
    }

    const delimiter = ';';
    const filename = `skt-vault-${new Date().toISOString()}.csv`;

    const data = await Promise.all(rawData.map(async item => ({
      ...item,
      [VaultEntry.values.fields.value]: password.value ? await decrypt(item[VaultEntry.values.fields.value], password.value) : '********',
      [VaultEntry.fields.tradeId]: item[VaultEntry.fields.tradeId]
        ? new URL(`/trade/${item[VaultEntry.fields.tradeId]}`, window.location.origin).href
        : '',
      [VaultEntry.fields.createdAt]: formatDate(item[VaultEntry.fields.createdAt]),
      [VaultEntry.fields.updatedAt]: formatDate(item[VaultEntry.fields.updatedAt]),
      [VaultEntry.fields.revealedAt]: formatDate(item[VaultEntry.fields.revealedAt])
    })));

    const headers = [
      { key: VaultEntry.fields.appId, label: VaultEntry.labels.appId },
      { key: VaultEntry.fields.tradeId, label: VaultEntry.labels.tradeId },
      { key: VaultEntry.fields.type, label: VaultEntry.labels.type },
      { key: VaultEntry.values.fields.value, label: VaultEntry.labels.value },
      { key: VaultEntry.fields.revealedAt, label: VaultEntry.labels.revealedAt },
      { key: VaultEntry.fields.updatedAt, label: VaultEntry.labels.updatedAt },
      { key: VaultEntry.fields.createdAt, label: VaultEntry.labels.createdAt }
    ];

    jsonToCsvExport({ delimiter, data, filename, headers });
    snackbarStore.set('success', 'Vault exported successfully');

    exporting.value = false;
  };

  const title = 'Vault';
  const breadcrumbs = [
    { title: 'Home', href: '/' },
    { title, disabled: true }
  ];

  useSeoMeta({ title, ogTitle: title });
  definePageMeta({
    middleware: 'authenticated'
  });
</script>

<template>
  <s-page-content :breadcrumbs="breadcrumbs">
    <template #prepend>
      <span class="text-warning text-no-wrap d-flex align-center">
        <v-icon
          class="mr-1"
          color="warning"
          icon="mdi-alert"
          size="x-small"
        />
        Use with caution
      </span>
    </template>
    <template #append>
      <v-btn
        class="ml-2 bg-surface rounded"
        :icon="$vuetify.display.xs"
        :rounded="$vuetify.display.xs"
        to="/vault/import"
        variant="flat"
      >
        <v-icon
          class="mr-0 mr-sm-2"
          icon="mdi-import"
        />
        <span class="d-none d-sm-block">
          Import
        </span>
      </v-btn>
      <v-btn
        class="ml-2 bg-surface rounded"
        :disabled="exporting"
        :icon="$vuetify.display.xs"
        :loading="exporting"
        :rounded="$vuetify.display.xs"
        variant="flat"
        @click="() => exportVault()"
      >
        <v-icon
          class="mr-0 mr-sm-2"
          icon="mdi-export"
        />
        <span class="d-none d-sm-block">
          Export
        </span>
      </v-btn>
    </template>

    <dialog-vault-unlocker />

    <div class="d-flex flex-grow-1">
      <v-row class="w-100">
        <v-col
          cols="12"
          lg="6"
        >
          <v-card class="d-flex flex-column fill-height">
            <v-tabs
              v-model="activeTab"
              class="flex-grow-0"
            >
              <v-tab
                :style="{ width: '33%' }"
                value="unsent"
              >
                <v-icon
                  icon="mdi-arrow-up"
                  start
                />
                Unsent

                <template #append>
                  <v-chip
                    size="small"
                    :text="formatNumber(counts?.unsent) || '0'"
                    variant="tonal"
                  />
                </template>
              </v-tab>
              <v-divider vertical />
              <v-tab
                :style="{ width: '33%' }"
                value="sent"
              >
                <v-icon
                  icon="mdi-arrow-down"
                  start
                />
                Sent

                <template #append>
                  <v-chip
                    size="small"
                    :text="formatNumber(counts?.sent) || '0'"
                    variant="tonal"
                  />
                </template>
              </v-tab>
              <v-divider vertical />
              <v-tab
                :style="{ width: '33%' }"
                value="received"
              >
                <v-icon
                  icon="mdi-arrow-down"
                  start
                />
                Received

                <template #append>
                  <v-chip
                    size="small"
                    :text="formatNumber(counts?.received) || '0'"
                    variant="tonal"
                  />
                </template>
              </v-tab>
            </v-tabs>
            <v-divider />

            <v-window>
              <v-window-item class="h-100">
                <table-apps
                  class="h-100"
                  :only-vault-received="activeTab === 'received'"
                  :only-vault-sent="activeTab === 'sent'"
                  :only-vault-unsent="activeTab === 'unsent'"
                  readonly
                  @click:row="({ id }) => loadEntries(id)"
                />
              </v-window-item>
            </v-window>
          </v-card>
        </v-col>
        <v-col
          cols="12"
          lg="6"
        >
          <v-card class="fill-height d-flex flex-column align-stretch">
            <v-card-title
              class="d-flex flex-row align-center text-button"
              style="height: 48px;"
            >
              <v-icon
                icon="mdi-format-list-bulleted"
                start
              />
              Vault Entries
              <v-spacer />
              <dialog-vault-entries
                v-if="activeApp"
                v-model="activeDialog"
                :appid="activeApp"
                @import="onImport"
              >
                <template #activator="attrs">
                  <v-btn
                    v-tooltip:left="'Add more entries'"
                    v-bind="attrs.props"
                    class="mr-n3"
                    icon="mdi-plus"
                    rounded
                    size="small"
                    variant="tonal"
                  />
                </template>
              </dialog-vault-entries>
            </v-card-title>

            <v-divider />

            <v-card-text class="flex-grow-1 d-flex flex-column align-center justify-center pa-0">
              <table-data
                v-if="activeApp"
                ref="table"
                class="flex-grow-1"
                :default-sort-by="[{ key: VaultEntry.values.fields.createdAt, order: 'desc' }, { key: VaultEntry.values.fields.value, order: 'asc' }]"
                :headers="headers"
                :map-item="mapItem"
                must-sort
                :no-data-text="`No entries`"
                :query-getter="queryGetter"
              >
                <template #[`item.${VaultEntry.values.fields.createdAt}`]="{ item }">
                  <rich-date
                    v-if="item[VaultEntry.values.fields.createdAt]"
                    :date="item[VaultEntry.values.fields.createdAt]"
                  />

                  <span
                    v-else
                    class="text-disabled font-italic"
                  >
                    Unknown
                  </span>
                </template>

                <template #[`item.${VaultEntry.table}.${VaultEntry.fields.type}`]="{ item }">
                  <v-icon
                    v-tooltip:top="VaultEntry.labels[item[VaultEntry.table][VaultEntry.fields.type]] || 'Unknown'"
                    :icon="VaultEntry.icons[item[VaultEntry.table][VaultEntry.fields.type]] || 'mdi-help-circle'"
                  />
                </template>

                <template #[`item.${VaultEntry.values.fields.value}`]="{ item }">
                  <v-btn
                    v-if="!item[VaultEntry.table][VaultEntry.fields.revealedAt] && activeTab === 'received'"
                    class="font-weight-bold"
                    variant="tonal"
                    @click="() => reveal(item)"
                  >
                    <v-icon
                      icon="mdi-eye"
                      start
                    />
                    Reveal
                  </v-btn>
                  <v-text-field
                    v-else
                    append-inner-icon="mdi-content-copy"
                    density="compact"
                    hide-details
                    :model-value="item[VaultEntry.values.fields.value]"
                    readonly
                    style="min-width: 150px;"
                    variant="filled"
                    @click:append-inner="() => copy(item[VaultEntry.values.fields.value])"
                  />
                </template>

                <template #[`item.${VaultEntry.table}.${Trade.table}`]="{ item }">
                  <rich-profile-link
                    v-if="item[VaultEntry.table][Trade.table]"
                    :user-id="[
                      item[VaultEntry.table][Trade.table][Trade.fields.receiverId],
                      item[VaultEntry.table][Trade.table][Trade.fields.senderId]
                    ].find(id => id !== user.id)"
                  />
                </template>

                <template #[`item.actions`]="{ item }">
                  <v-btn-group size="small">
                    <v-btn
                      v-if="item[VaultEntry.table][VaultEntry.fields.tradeId]"
                      v-tooltip:top="'View trade'"
                      icon="mdi-open-in-new"
                      size="small"
                      variant="plain"
                      @click.stop="() => navigateTo(`/trade/${item[VaultEntry.table][VaultEntry.fields.tradeId]}`, { open: { target: '_blank' } })"
                    />
                    <dialog-confirm
                      color="red"
                      confirm-text="Delete"
                      @confirm="deleteEntry(item)"
                    >
                      <template #activator="attrs">
                        <v-btn
                          v-tooltip:top="'Delete entry'"
                          v-bind="attrs.props"
                          color="red"
                          icon="mdi-delete"
                          size="small"
                          variant="plain"
                        />
                      </template>
                    </dialog-confirm>
                  </v-btn-group>
                </template>
              </table-data>
              <span
                v-else
                class="text-disabled font-italic text-center"
              >
                Select an app to view entries
              </span>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </div>
  </s-page-content>
</template>