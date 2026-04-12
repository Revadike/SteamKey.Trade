<script setup>
  import { FunctionsHttpError } from '@supabase/supabase-js';
  import { useDisplay } from 'vuetify';

  import { toAccountID } from '~/assets/js/steamid';

  const { Collection, VaultEntry } = useORM();
  const { user, updateUserCollections } = useAuthStore();
  const { encrypt } = useVaultSecurity();
  const { smAndUp, xlAndUp, mobile } = useDisplay();

  const supabase = useSupabaseClient();
  const snackbarStore = useSnackbarStore();

  const query = ref('');
  const showSearch = ref(false);
  const searchInput = ref(null);

  const step = ref(1);
  const imports = ref([]);
  const encrypted = ref(false);
  const isLoading = ref(false);

  const seeAll = ref(false);

  const { searchMany } = useSearchApps();
  const importingSteamInventory = ref(false);
  const importSteamInventory = async () => {
    importingSteamInventory.value = true;
    try {
      const { data, error } = await supabase.functions.invoke('thirdparty-import', {
        body: { source: 'steam-inventory' }
      });

      if (error) {
        throw error;
      }

      const { appids = [], queries = [] } = data;

      if (appids.length === 0 && queries.length === 0) {
        snackbarStore.set('error', 'No items found in your Steam Inventory');
        return;
      }

      const items = [];
      for (const appid of [...new Set(appids)]) {
        const count = appids.filter(id => id === appid).length;
        items.push({
          appid,
          name: null,
          query: appid,
          score: 0,
          suggestions: [],
          type: VaultEntry.enums.type.gift,
          values: Array(count).fill(`https://steamcommunity.com/tradeoffer/new/?partner=${toAccountID(user.steamId)}`)
        });
      }

      const uniqueQueries = [...new Set(queries)];
      for (let i = 0; i < uniqueQueries.length; i += 20) {
        const batch = uniqueQueries.slice(i, i + 20);
        const batchResults = await searchMany(batch);

        batchResults.forEach(({ query, results }) => {
          const count = queries.filter(q => q === query).length;
          items.push({
            appid: results[0]?.item?.appid ?? null,
            name: results[0]?.item?.names?.[0] ?? query,
            query,
            score: results[0]?.score ?? 1,
            suggestions: results.slice(0, 10),
            type: VaultEntry.enums.type.gift,
            values: Array(count).fill(`https://steamcommunity.com/tradeoffer/new/?partner=${toAccountID(user.steamId)}`)
          });
        });
      }

      setImports(items);
    } catch (error) {
      console.error(error);
      if (error instanceof FunctionsHttpError) {
        const message = await error.context.json();
        snackbarStore.set('error', message.error || message);
      } else {
        snackbarStore.set('error', 'An unknown error occurred while importing Steam Inventory');
      }
    } finally {
      importingSteamInventory.value = false;
    }
  };

  const importingBartervg = ref(false);
  const importBartervg = async () => {
    importingBartervg.value = true;

    try {
      const { data, error } = await supabase.functions.invoke('thirdparty-import', {
        body: { source: 'bartervg' }
      });

      if (error) {
        throw error;
      }

      const { appids = [] } = data;

      if (appids.length === 0) {
        snackbarStore.set('error', 'No items found in your Barter.vg tradable collection');
        return;
      }

      const items = appids.map(appid => ({
        appid,
        name: null,
        query: appid,
        score: 0,
        suggestions: [],
        type: VaultEntry.enums.type.key,
        values: ['']
      }));

      setImports(items);
    } catch (error) {
      console.error(error);
      if (error instanceof FunctionsHttpError) {
        const message = await error.context.json();
        snackbarStore.set('error', message.error || message);
      } else {
        snackbarStore.set('error', 'An unknown error occurred while importing Barter.vg');
      }
    } finally {
      importingBartervg.value = false;
    }
  };

  const importingCollection = ref(false);
  const importCollection = async (collection) => {
    importingCollection.value = true;
    try {
      let allAppIds = [];
      let processed = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from(Collection.apps.table)
          .select(Collection.apps.fields.appId)
          .eq(Collection.apps.fields.collectionId, collection.id)
          .range(processed, processed + batchSize - 1);

        if (error) {
          throw error;
        }

        if (!data || data.length === 0) {
          break;
        }

        allAppIds = allAppIds.concat(data);
        if (data.length < batchSize) {
          break;
        }

        processed += batchSize;
      }

      if (allAppIds.length === 0) {
        snackbarStore.set('error', 'No apps found in the selected collection');
        return;
      }

      const items = allAppIds.map(row => ({
        appid: row[Collection.apps.fields.appId],
        name: null,
        query: row[Collection.apps.fields.appId],
        score: 0,
        suggestions: [],
        type: VaultEntry.enums.type.key,
        values: ['']
      }));
      setImports(items);
      snackbarStore.set('success', `Imported ${items.length} apps from collection`);
    } catch (error) {
      console.error(error);
      snackbarStore.set('error', 'Failed to import collection');
    } finally {
      importingCollection.value = false;
    }
  };

  const scoreToPercent = score => {
    return Math.round((1 - score) * 1000) / 10;
  };

  const setImports = items => {
    imports.value = items;
  };

  const encryptAll = async () => {
    await Promise.all(imports.value.map(async (item, i) => {
      const entries = item.values.filter(Boolean);
      const encryptedEntries = await Promise.all(entries.map(entry => encrypt(entry)));
      imports.value[i].values = encryptedEntries;
    }));

    encrypted.value = true;
  };

  const submitVaultEntries = async () => {
    isLoading.value = true;

    try {
      const linkedImports = imports.value.filter(item => item.appid !== null);

      const vaultEntries = linkedImports.filter(item => item.values.filter(Boolean).length > 0);
      const vaultCount = vaultEntries.reduce((acc, item) => acc + item.values.length, 0);
      await VaultEntry.addValues(supabase, user.id, vaultEntries);

      let tradelistCount = linkedImports.length;
      if (linkedImports.length > 0) {
        const appids = linkedImports.map(item => parseInt(item.appid));
        const collection = await Collection.getMasterTradelist(supabase, user.id);
        const existingAppids = await Collection.getMasterCollectionsApps(supabase, user.id).then(({ tradelist }) => tradelist || []);
        const newAppids = appids.filter(appid => !existingAppids.includes(appid));
        if (newAppids.length > 0) {
          await collection.addApps(newAppids, Collection.enums.source.sync);
          tradelistCount = newAppids.length;
        }
      }

      await updateUserCollections();

      isLoading.value = false;
      await navigateTo('/vault');
      snackbarStore.set('success', `Successfully saved ${vaultCount} vault entries and updated ${tradelistCount} apps in your tradelist`);
    } catch (error) {
      console.error(error);
      isLoading.value = false;
      snackbarStore.set('error', 'An error occurred while saving vault entries');
    }
  };

  const onClickSeeAll = () => {
    seeAll.value = !seeAll.value;
  };

  const toggleSearch = () => {
    showSearch.value = !showSearch.value;
    if (showSearch.value) {
      nextTick(() => {
        searchInput.value.focus();
      });
    }
  };

  const changeTo = ({ item, score }, index) => {
    imports.value[index].appid = item.appid;
    imports.value[index].name = item.names[0];
    imports.value[index].score = score;
  };

  const itemsPerPage = computed(() => {
    if (seeAll.value) {
      return imports.value.length;
    }

    return xlAndUp.value ? 8 : (smAndUp.value ? 6 : 2);
  });

  watch([
    () => imports.value,
    () => encrypted.value
  ], () => {
    if (imports.value.length === 0) {
      step.value = 1;
    // } else if (imports.value.every(item => item.value.filter(Boolean).length === 0)) {
    //   step.value = 2;
    // } else if (imports.value.some(item => item.value.filter(Boolean).length > 0) && !encrypted.value) {
    } else if (!encrypted.value) {
      step.value = 3;
    // } else if (imports.value.some(item => item.value.filter(Boolean).length > 0) && encrypted.value) {
    } else if (encrypted.value) {
      step.value = 4;
    }
  }, { immediate: true, deep: true });

  const breadcrumbs = [
    { title: 'Home', to: '/' },
    { title: 'Vault', to: '/vault' },
    { title: 'Import', disabled: true }
  ];

  useSeoMeta({
    title: 'Vault Import',
    ogTitle: 'Vault Import'
  });

  definePageMeta({
    middleware: 'authenticated'
  });
</script>

<template>
  <s-page-content :breadcrumbs="breadcrumbs">
    <template #breadcrumbs="{ breadcrumbs: items }">
      <div class="d-flex align-center flex-wrap ga-2">
        <v-breadcrumbs
          :items="items"
          :max-items="items.length"
        />
        <span class="text-warning text-no-wrap d-flex align-center">
          <v-icon
            class="mr-1"
            color="warning"
            icon="mdi-alert"
            size="x-small"
          />
          Proceed with caution
        </span>
      </div>
    </template>

    <dialog-vault-security v-if="!user.publicKey" />

    <div class="h-100">
      <v-data-iterator
        class="vault-import"
        :items="imports"
        :items-per-page="itemsPerPage"
        :search="query"
      >
        <template #header="{ page, pageCount, prevPage, nextPage }">
          <v-stepper
            class="mb-5 overflow-visible"
            :mobile="mobile"
            :model-value="step"
          >
            <v-stepper-header>
              <template
                v-for="(item, i) in ['Import trade list', 'Enter vault entries', 'Encrypt vault entries', 'Save to vault']"
                :key="i"
              >
                <v-divider v-if="i" />
                <v-stepper-item
                  :complete="step > i + 1"
                  :edit-icon="step === i + 1 ? 'mdi-pencil' : null"
                  editable
                  :title="item"
                  :value="i + 1"
                  @click="step = i + 1"
                />
              </template>
            </v-stepper-header>
          </v-stepper>

          <div
            class="d-flex justify-space-between mb-5 align-center"
            style="height: 40px;"
          >
            <v-slide-group
              v-show="!showSearch && step === 1"
              class="import-buttons"
              show-arrows
            >
              <v-slide-group-item>
                <dialog-manual-import @import="setImports">
                  <template #activator="{ props: activatorProps }">
                    <v-btn
                      v-bind="activatorProps"
                      :disabled="importingSteamInventory || importingBartervg || importingCollection"
                      variant="tonal"
                    >
                      <v-icon icon="mdi-text-box-edit-outline" />
                      <span class="hidden-sm-and-down ml-0 ml-sm-2">
                        Manual
                      </span>
                    </v-btn>
                  </template>
                </dialog-manual-import>
              </v-slide-group-item>

              <v-slide-group-item>
                <dialog-select-collection
                  :multiple="false"
                  :table-props="{ onlyUsers: [user.id], maxSelection: 1 }"
                  @select="importCollection"
                >
                  <template #activator="{ props: activatorProps }">
                    <v-btn
                      v-bind="activatorProps"
                      :disabled="importingSteamInventory || importingBartervg"
                      :loading="importingCollection"
                      variant="tonal"
                    >
                      <v-icon icon="mdi-apps" />
                      <span class="hidden-sm-and-down ml-0 ml-sm-2">
                        Collection
                      </span>
                    </v-btn>
                  </template>
                </dialog-select-collection>
              </v-slide-group-item>

              <v-slide-group-item>
                <v-btn
                  :disabled="importingBartervg || importingCollection"
                  :loading="importingSteamInventory"
                  variant="tonal"
                  @click="importSteamInventory"
                >
                  <v-icon icon="mdi-steam" />
                  <span class="hidden-sm-and-down ml-0 ml-sm-2">
                    Steam Inventory
                  </span>
                </v-btn>
              </v-slide-group-item>

              <v-slide-group-item>
                <dialog-steamtrades-import @import="setImports">
                  <template #activator="{ props: activatorProps }">
                    <v-btn
                      v-bind="activatorProps"
                      :disabled="importingSteamInventory || importingBartervg || importingCollection"
                      variant="tonal"
                    >
                      <v-icon icon="mdi-gamepad-circle" />
                      <span class="hidden-sm-and-down ml-0 ml-sm-2">
                        SteamTrades
                      </span>
                    </v-btn>
                  </template>
                </dialog-steamtrades-import>
              </v-slide-group-item>

              <v-slide-group-item>
                <v-btn
                  :disabled="importingSteamInventory || importingCollection"
                  :loading="importingBartervg"
                  variant="tonal"
                  @click="importBartervg"
                >
                  <v-icon icon="mdi-swap-horizontal" />
                  <span class="hidden-sm-and-down ml-0 ml-sm-2">
                    Barter.vg
                  </span>
                </v-btn>
              </v-slide-group-item>

              <!-- <v-btn
                  disabled
                  variant="tonal"
                >
                  <v-icon icon="mdi-reddit" />
                  <span class="hidden-sm-and-down ml-0 ml-sm-2">
                    Reddit
                  </span>
                </v-btn> -->
            </v-slide-group>
            <v-alert
              v-if="!showSearch && step === 2"
              class="hidden-sm-and-down"
              density="compact"
              icon="mdi-information-outline"
              text="Vault entries can be steam keys, bundle links, steam gift links, or anything else you want to trade."
              variant="tonal"
            />
            <v-btn
              v-if="!showSearch && step === 3"
              :disabled="encrypted || imports.every(item => !item.values.filter(Boolean).length)"
              variant="tonal"
              @click="encryptAll"
            >
              <v-icon icon="mdi-lock" />
              <span>
                Encrypt
              </span>
            </v-btn>
            <v-btn
              v-if="!showSearch && step === 4"
              :loading="isLoading"
              variant="tonal"
              @click="submitVaultEntries"
            >
              <v-icon icon="mdi-content-save" />
              <span>
                Submit
              </span>
            </v-btn>

            <v-text-field
              v-if="showSearch"
              ref="searchInput"
              v-model="query"
              clearable
              density="comfortable"
              hide-details
              label="Search"
              rounded
              variant="outlined"
              @keydown.escape="showSearch = false"
            />

            <div class="d-flex align-center ml-2">
              <v-btn
                class="me-2"
                :disabled="imports.length === 0"
                icon="mdi-magnify"
                size="small"
                variant="tonal"
                @click="toggleSearch"
              />

              <v-btn
                class="me-2"
                :disabled="page === 1"
                icon="mdi-arrow-left"
                size="small"
                variant="tonal"
                @click="prevPage"
              />

              <v-btn
                :disabled="page === pageCount"
                icon="mdi-arrow-right"
                size="small"
                variant="tonal"
                @click="nextPage"
              />
            </div>
          </div>
        </template>

        <template #no-data>
          <v-container class="d-flex flex-column align-center justify-center h-100">
            <v-fade-transition leave-absolute>
              <span
                v-if="step === 1 && query.length === 0"
                class="text-disabled font-italic"
              >
                Begin by importing your trade list using a method above
              </span>
              <span
                v-else-if="query.length > 0"
                class="text-disabled font-italic"
              >
                No results found for '{{ query }}'
              </span>
              <span
                v-else
                class="text-disabled font-italic"
              >
                Go back to step 1 to import your trade list
              </span>
            </v-fade-transition>
          </v-container>
        </template>

        <template #default="{ items, page }">
          <v-row>
            <v-col
              v-for="(item, i) in items"
              :key="i"
              cols="12"
              sm="4"
              xl="3"
            >
              <v-sheet
                class="position-relative"
                rounded
              >
                <nuxt-link
                  rel="noopener"
                  target="_blank"
                  :to="`/app/${item.raw.appid}`"
                >
                  <v-img
                    v-ripple
                    :alt="item.raw.name"
                    cover
                    height="150"
                    lazy-src="/applogo.svg"
                    :src="`https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${item.raw.appid}/header.jpg`"
                  />
                </nuxt-link>

                <v-list-item
                  density="comfortable"
                  lines="two"
                  :subtitle="`Matched '${item.raw.query}' with ${scoreToPercent(item.raw.score)}% confidence`"
                  :title="item.raw.name"
                >
                  <template #title>
                    <v-menu location="bottom">
                      <template #activator="{ props }">
                        <v-btn
                          v-bind="props"
                          class="position-absolute top-0 right-0"
                          icon="mdi-dots-vertical"
                          :ripple="false"
                          style="z-index: 1;"
                          variant="plain"
                        />
                      </template>

                      <v-list>
                        <v-list-item
                          class="bg-error text-center"
                          @click="() => imports.splice((page - 1) * itemsPerPage + i, 1)"
                        >
                          <v-list-item-title>
                            <v-icon
                              class="mt-n1"
                              icon="mdi-delete"
                              size="small"
                              start
                            />
                            <strong class="text-button">Delete</strong>
                          </v-list-item-title>
                        </v-list-item>
                        <v-list-item
                          v-for="(suggestion, index) in item.raw.suggestions"
                          :key="index"
                          :disabled="suggestion.item.appid === item.raw.appid"
                          width="240px"
                          @click="changeTo(suggestion, (page - 1) * itemsPerPage + i)"
                        >
                          <v-list-item-title>
                            {{ suggestion.item.names[0] || `Unknown App ${suggestion.item.appid}` }}
                          </v-list-item-title>
                          <v-list-item-subtitle>
                            Match: {{ scoreToPercent(suggestion.score) }}% | AppID: {{ suggestion.item.appid }}
                          </v-list-item-subtitle>
                        </v-list-item>
                      </v-list>
                    </v-menu>
                    <div class="d-flex align-center justify-space-between">
                      <strong
                        class="text-h6 text-truncate"
                        :title="item.raw.name"
                      >
                        {{ item.raw.name }}
                      </strong>
                    </div>
                  </template>
                </v-list-item>

                <div class="sheet-body">
                  <input-vault-entries
                    v-model="item.raw"
                    :disabled="step === 4"
                    :encrypted="encrypted"
                    @update:encrypted="val => encrypted = val"
                  />
                </div>
              </v-sheet>
            </v-col>
          </v-row>
        </template>

        <template #footer="{ page, pageCount }">
          <v-footer
            class="justify-space-between mt-5"
            rounded
          >
            Total: {{ imports.length }}
            <v-btn
              v-if="pageCount > 1 || seeAll"
              class="me-8"
              variant="text"
              @click="onClickSeeAll"
            >
              <span class="text-decoration-underline text-none">
                {{ seeAll ? 'See less' : 'See all' }}
              </span>
            </v-btn>

            <div>
              Page {{ page }} of {{ pageCount }}
            </div>
          </v-footer>
        </template>
      </v-data-iterator>
    </div>
  </s-page-content>
</template>

<style lang="scss" scoped>
  .vault-import {
    height: 100%;
    display: flex;
    flex-direction: column;

    ::v-deep(> div:nth-child(3)) {
      height: 100%;
    }

    .sheet-body {
      height: 180px;
      overflow-y: auto;
      align-items: stretch;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
    }

    .import-buttons {
      &::v-deep(.v-slide-group__prev.v-slide-group__prev--disabled),
      &::v-deep(.v-slide-group__next.v-slide-group__next--disabled) {
        display: none;
      }

      // only outer buttons are rounded, inner buttons are connected
      &::v-deep(.v-btn) {
        border-radius: 0;
        // divider line between buttons
        &::before {
          content: '';
          position: absolute;
          top: 4px;
          bottom: 4px;
          left: 0;
          width: 1px;
          background-color: rgba(var(--v-theme-on-surface), 0.12);
        }

        &:first-child {
          border-top-left-radius: 8px;
          border-bottom-left-radius: 8px;
          &::before {
            display: none;
          }
        }

        &:last-child {
          border-top-right-radius: 8px;
          border-bottom-right-radius: 8px;
        }
      }
    }
  }
</style>
