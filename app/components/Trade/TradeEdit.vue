<script setup>
  import { useDisplay } from 'vuetify';

  const props = defineProps({
    id: {
      type: String,
      default: null
    },
    counterId: {
      type: String,
      default: null
    },
    copyId: {
      type: String,
      default: null
    },
    sender: {
      type: String,
      default: null
    },
    receiver: {
      type: String,
      default: null
    },
    senderSelected: {
      type: Array,
      default: () => []
    },
    receiverSelected: {
      type: Array,
      default: () => []
    }
  });

  const { user } = useAuthStore();
  const { App, Trade, Collection } = useORM();
  const snackbarStore = useSnackbarStore();
  const router = useRouter();
  const supabase = useSupabaseClient();

  const sides = ['sender', 'receiver'];
  const currentSide = ref(sides[0]);
  const valid = ref(false);
  const isNew = !props.id;
  const isCounter = !!props.counterId;
  const isCopy = !!props.copyId;

  let tradeKey = 'trade-edit';
  let appsKey = 'trade-edit-apps';
  if (props.id) {
    tradeKey = `trade-edit-${props.id}`;
    appsKey = `trade-edit-apps-${props.id}`;
  } else if (props.copyId) {
    tradeKey = `trade-edit-copy-${props.copyId}`;
    appsKey = `trade-edit-apps-copy-${props.copyId}`;
  } else if (props.counterId) {
    tradeKey = `trade-edit-counter-${props.counterId}`;
    appsKey = `trade-edit-apps-counter-${props.counterId}`;
  } else if (isNew) {
    tradeKey = 'trade-edit-new';
    appsKey = 'trade-edit-apps-new';
  }

  const { data: trade, status: tradeStatus, error: tradeError } = useLazyAsyncData(tradeKey, async () => {
    const id = props.id || props.counterId || props.copyId;
    const instance = new Trade(id);
    if (!isNew || isCopy || isCounter) {
      try {
        await instance.load();
      } catch (err) {
        if (err.code === 'PGRST116') {
          let message = 'The trade you are looking for does not exist';
          if (isCounter) {
            message = 'The trade you are trying to counter does not exist';
          } else if (isCopy) {
            message = 'The trade you are trying to copy does not exist';
          }

          throw createError({
            statusCode: 404,
            statusMessage: 'Trade not found',
            message,
            fatal: true
          });
        }

        throw err;
      }
    }

    const data = instance.toObject();

    if (isCounter && data.receiverId !== user.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'You are not allowed to counter this trade',
        fatal: true
      });
    }

    if (isCounter) {
      data.id = null;
      data.originalId = id;
      data.status = Trade.enums.status.pending;

      const {
        senderId,
        senderDisputed,
        senderVaultless,
        senderTotal,
        receiverId,
        receiverDisputed,
        receiverVaultless,
        receiverTotal
      } = data;

      data.senderId = receiverId;
      data.senderDisputed = receiverDisputed;
      data.senderVaultless = receiverVaultless;
      data.senderTotal = receiverTotal;
      data.receiverId = senderId;
      data.receiverDisputed = senderDisputed;
      data.receiverVaultless = senderVaultless;
      data.receiverTotal = senderTotal;
    } else if (isCopy) {
      data.id = null;
      data.status = Trade.enums.status.pending;
    }

    data.senderId = props.sender || user.id;
    data.receiverId = props.receiver || data.receiverId;
    return data;
  });

  const { data: tradeApps, status: appsStatus, error: appsError } = useLazyAsyncData(appsKey, async () => {
    if (isNew && !isCounter && !isCopy) {
      return { sender: [], receiver: [] };
    }

    const id = props.id || props.counterId || props.copyId;
    const instance = new Trade(id);
    const apps = await instance.getApps(true);

    return {
      sender: apps.filter(app => app.trade[isCounter ? 'receiverId' : 'senderId'] === app.userId),
      receiver: apps.filter(app => app.trade[isCounter ? 'senderId' : 'receiverId'] === app.userId)
    };
  });

  watch(() => tradeError.value || appsError.value, (error) => {
    if (error) {
      console.error(error);
      throw error;
    }
  });

  const users = ref({ sender: props.sender || user.id, receiver: props.receiver });
  const selectedCollections = ref({ sender: null, receiver: null });
  const selectedApps = ref({ sender: [], receiver: [] });
  const mandatoryApps = ref({ sender: [], receiver: [] });

  const { data: senderMasterCollections } = useSupabaseData('master-collections', { userId: users.value.sender }, {
    watch: [() => users.value.sender]
  });
  const { data: receiverMasterCollections } = useSupabaseData('master-collections', { userId: users.value.receiver }, {
    watch: [() => users.value.receiver]
  });

  const getPartnerSide = (side) => side === 'sender' ? 'receiver' : 'sender';

  const partnerMasterCollections = computed(() => ({
    sender: senderMasterCollections.value || [],
    receiver: receiverMasterCollections.value || []
  }));

  const getQuickFilters = (side) => {
    // Quick filters are built from prefetched partner master collections.
    const collections = partnerMasterCollections.value[getPartnerSide(side)] || [];
    const wishlistCollection = collections.find((collection) => collection.type === Collection.enums.type.wishlist);
    const libraryCollection = collections.find((collection) => collection.type === Collection.enums.type.library);
    const quickFilters = [];

    if (wishlistCollection?.id) {
      quickFilters.push({
        title: 'Wished',
        value: {
          fields: [],
          collections: {
            any: false,
            only: [wishlistCollection.id],
            exclude: []
          }
        }
      });
    }

    if (libraryCollection?.id) {
      quickFilters.push({
        title: 'Unowned',
        value: {
          fields: [],
          collections: {
            any: false,
            only: [],
            exclude: [libraryCollection.id]
          }
        }
      });
    }

    return quickFilters;
  };

  // If apps are connected to a vault entry, headless mode is enabled
  const headless = ref(false);

  // Local reactive form objects to separate editable state from async data
  const tradeForm = reactive({
    id: null,
    originalId: null,
    senderTotal: 1,
    receiverTotal: 1,
    senderId: props.sender || user.id,
    receiverId: props.receiver || null,
    senderDisputed: false,
    receiverDisputed: false,
    senderVaultless: false,
    receiverVaultless: false,
    status: Trade.enums.status.pending
  });

  const tradeAppsForm = reactive({
    sender: [],
    receiver: []
  });

  // Sync async trade data to local form when loaded
  watch(
    () => trade.value,
    (value) => {
      if (!value) {
        return;
      }

      Object.assign(tradeForm, structuredClone(toRaw(value)));
      users.value.sender = value.senderId;
      users.value.receiver = value.receiverId;
    },
    { immediate: true }
  );

  // Sync async tradeApps data to local form when loaded
  watch(
    () => tradeApps.value,
    (value) => {
      if (value && value.sender && value.receiver && (!isNew || isCounter || isCopy)) {
        // Sync to local form
        tradeAppsForm.sender = structuredClone(toRaw(value.sender));
        tradeAppsForm.receiver = structuredClone(toRaw(value.receiver));

        if (value.sender?.length) {
          headless.value = headless.value || value.sender.every(({ vaultEntries, total }) => vaultEntries && vaultEntries.filter(Boolean).length === total);
        }

        for (const side of sides) {
          const collectionIds = value[side].map(app => app.collectionId);

          if (!selectedCollections.value[side]) {
            selectedCollections.value[side] = [];
          }

          for (const id of collectionIds) {
            if (!selectedCollections.value[side].includes(id)) {
              selectedCollections.value[side].push(id);
            }
          }
        }

        // Check which app IDs need to be loaded
        const existingAppIds = [
          ...selectedApps.value.sender.map(app => app.id),
          ...selectedApps.value.receiver.map(app => app.id)
        ];

        const appIdsToQuery = [...value.sender, ...value.receiver]
          .map(app => app.appId)
          .filter((appId, index, self) =>
            appId &&
            self.indexOf(appId) === index &&
            !existingAppIds.includes(appId)
          );

        if (!appIdsToQuery.length) {
          return;
        }

        // Only query apps that aren't already loaded
        App.query(supabase, [
          { filter: 'in', params: [App.fields.id, appIdsToQuery] }
        ]).then(instances => {
          const newApps = instances.map(instance => instance.toObject());
          const allApps = Array.from(
            new Map([...selectedApps.value.sender, ...selectedApps.value.receiver, ...newApps]
              .filter(app => app.id)
              .map(app => [app.id, app]))
              .values()
          );

          selectedApps.value.sender = allApps.filter(app =>
            value.sender.some(({ appId }) => appId === app.id)
          );
          selectedApps.value.receiver = allApps.filter(app =>
            value.receiver.some(({ appId }) => appId === app.id)
          );
          mandatoryApps.value.sender = allApps.filter(app =>
            value.sender.some(({ appId, mandatory }) => appId === app.id && mandatory)
          );
          mandatoryApps.value.receiver = allApps.filter(app =>
            value.receiver.some(({ appId, mandatory }) => appId === app.id && mandatory)
          );
        });
      }
    },
    { immediate: true }
  );

  // Pre-select apps for new trades if senderSelected/receiverSelected are provided
  watch(
    [() => selectedCollections.value, () => props.senderSelected, () => props.receiverSelected],
    async ([collections, senderIds, receiverIds]) => {
      if (
        // Only for brand new trades
        (!isNew || isCounter || isCopy)
        // Only if both collections are ready
        && (!collections.sender || !collections.receiver)
        // Only if senderSelected/receiverSelected are non-empty
        && (!senderIds?.length && !receiverIds?.length)
      ) {
        return;
      }

      const allIds = [...new Set([...senderIds, ...receiverIds])];
      const appInstances = await App.query(supabase, [
        { filter: 'in', params: [App.fields.id, allIds] }
      ]);

      const allApps = appInstances.map(instance => instance.toObject());

      selectedApps.value.sender = selectedApps.value.sender.concat(
        allApps.filter(app =>
          senderIds.includes(app.id) &&
          !selectedApps.value.sender.some(selectedApp => selectedApp.id === app.id)
        )
      );

      selectedApps.value.receiver = selectedApps.value.receiver.concat(
        allApps.filter(app =>
          receiverIds.includes(app.id) &&
          !selectedApps.value.receiver.some(selectedApp => selectedApp.id === app.id)
        )
      );
    },
    { immediate: true, deep: true }
  );

  const getGridItemWidth = () => {
    const widths = [...document.querySelectorAll('.app-grid-item')].map(item => item.offsetWidth);
    return widths.length ? Math.min(...widths) : 0;
  };

  const display = useDisplay();
  const gridItemWidth = ref(getGridItemWidth());
  watch([
    () => selectedApps.value.sender,
    () => selectedApps.value.receiver,
    () => display.width
  ], async () => {
    await nextTick();
    gridItemWidth.value = getGridItemWidth();
  }, { immediate: true, deep: true });

  watch(
    () => selectedApps.value,
    () => {
      tradeForm.senderTotal = Math.max(Math.min(selectedApps.value.sender.length, tradeForm.senderTotal), mandatoryApps.value.sender.length);
      tradeForm.receiverTotal = Math.max(Math.min(selectedApps.value.receiver.length, tradeForm.receiverTotal), mandatoryApps.value.receiver.length);

      for (const side of sides) {
        const apps = [];
        for (const app of selectedApps.value[side]) {
          const existingTradeApp = tradeAppsForm[side].find(tradeApp => tradeApp.appId === app.id) || {};
          apps.push({
            appId: app.id,
            collectionId: existingTradeApp.collectionId || app.collection?.collectionId || selectedCollections.value?.[side]?.[0] || null,
            vaultEntries: existingTradeApp.vaultEntries || [],
            userId: side === 'sender' ? users.value.sender : users.value.receiver,
            mandatory: mandatoryApps.value[side].some(({ id }) => id === app.id),
            selected: false,
            total: existingTradeApp.total || 1
          });
        }
        tradeAppsForm[side] = apps;
      }
    },
    { deep: true }
  );

  watch(() => users.value, async () => {
    if (users.value.sender === users.value.receiver) {
      snackbarStore.set('warning', 'You cannot trade with yourself');
      users.value.receiver = null;
      return;
    }

    if (isNew && !isCounter && !isCopy) {
      if (users.value.sender) {
        // Set default sender collection to the user's master tradelist
        const masterTradelist = await Collection.getMasterTradelist(supabase, users.value.sender);
        selectedCollections.value.sender = [masterTradelist.id];
      } else {
        selectedCollections.value.sender = null;
      }

      if (users.value.receiver) {
        // Set default receiver collection to the user's master tradelist
        const masterTradelist = await Collection.getMasterTradelist(supabase, users.value.receiver);
        selectedCollections.value.receiver = [masterTradelist.id];
      } else {
        selectedCollections.value.receiver = null;
      }
    }

    if (users.value.sender !== tradeForm.senderId) {
      tradeForm.senderId = users.value.sender;
    }
    if (users.value.receiver !== tradeForm.receiverId) {
      tradeForm.receiverId = users.value.receiver;
    }
  }, { deep: true, immediate: true });

  const isValid = computed(() => {
    return !!(valid.value
      && selectedApps.value.sender.length
      && tradeForm.senderTotal
      && selectedApps.value.sender.length >= tradeForm.senderTotal
      && mandatoryApps.value.sender.length <= tradeForm.senderTotal
      && selectedApps.value.receiver.length
      && tradeForm.receiverTotal
      && selectedApps.value.receiver.length >= tradeForm.receiverTotal
      && mandatoryApps.value.receiver.length <= tradeForm.receiverTotal
    );
  });

  const isLoading = computed(() => {
    return tradeStatus.value === 'pending' || appsStatus.value === 'pending';
  });

  const submit = async () => {
    if (!isValid.value) {
      snackbarStore.set('warning', 'Trade offer is incomplete');
      return;
    }

    try {
      tradeForm.status = Trade.enums.status.pending;

      const instance = new Trade(tradeForm.id);
      Object.assign(instance, tradeForm);
      instance.senderId = users.value.sender;
      instance.receiverId = users.value.receiver;

      const savedInstance = await instance.save();

      await savedInstance.setApps([...tradeAppsForm.sender, ...tradeAppsForm.receiver], false, true);

      // decline original trade if countered
      if (props.counterId && tradeForm.originalId) {
        const originalTrade = new Trade(tradeForm.originalId);
        await originalTrade.decline();
      }

      snackbarStore.set('success', isNew ? 'Trade sent' : 'Trade saved');
      await navigateTo(`/trade/${savedInstance.id}`);
    } catch (error) {
      snackbarStore.set('error', error.message);
    }
  };

  // Calculate square grid values for trade apps display
  const getGridStyle = (count) => {
    if (!count) { return {}; }

    // Calculate the number of columns to make a square grid
    const columns = Math.ceil(Math.sqrt(count));

    return {
      'grid-template-columns': `repeat(${columns}, 1fr)`,
      'grid-template-rows': `repeat(${Math.ceil(count / columns)}, 1fr)`
    };
  };

  const removeApp = (side, appId) => {
    selectedApps.value[side] = selectedApps.value[side].filter(app => app.id !== appId);
  };

  // Calculate total apps count (including quantities) for each side
  const calculateTotalApps = (side) => {
    const apps = tradeAppsForm[side] || [];
    return apps.reduce((sum, app) => sum + (app.total || 1), 0);
  };

  // Calculate total market value for each side
  const calculateTotalMarketValue = (side) => {
    const apps = selectedApps.value[side] || [];
    return apps.reduce((sum, app) => {
      const tradeApp = tradeAppsForm[side]?.find(ta => ta.appId === app.id);
      const quantity = tradeApp?.total || 1;
      const price = app[App.fields.marketPrice] || 0;
      return sum + price * quantity;
    }, 0);
  };

  // Computed properties for each side
  const senderTotalApps = computed(() => calculateTotalApps('sender'));
  const receiverTotalApps = computed(() => calculateTotalApps('receiver'));
  const senderTotalValue = computed(() => calculateTotalMarketValue('sender'));
  const receiverTotalValue = computed(() => calculateTotalMarketValue('receiver'));

  const title = isNew ? 'New trade' : 'Editing trade';
  const breadcrumbs = [
    { title: 'Home', to: '/' },
    { title: 'Trades', to: '/trades' },
    { title: isNew ? 'New' : 'Edit', disabled: true }
  ];

  useSeoMeta({ title, ogTitle: title });
</script>

<template>
  <s-page-content
    :breadcrumbs="breadcrumbs"
    :loading="isLoading"
  >
    <v-form
      v-model="valid"
      class="d-flex flex-column flex-grow-1"
      @submit.prevent="submit"
    >
      <v-row>
        <v-col
          cols="12"
          lg="8"
          order="2"
          order-lg="1"
        >
          <v-card class="d-flex flex-column fill-height">
            <div class="d-block">
              <v-tabs
                v-model="currentSide"
                class="tabs"
              >
                <template
                  v-for="tab in sides"
                  :key="tab"
                >
                  <v-tab
                    class="w-50"
                    :disabled="currentSide === tab || !users[tab]"
                    :value="tab"
                  >
                    <v-hover>
                      <template #default="{ isHovering, props: hoverProps }">
                        <div style="position: relative">
                          <rich-profile-link
                            v-if="users[tab]"
                            :key="users[tab]"
                            hide-reputation
                            no-link
                            :style="{ pointerEvents: 'none' }"
                            :user-id="users[tab]"
                          />
                          <template v-if="selectedApps[tab]?.length">
                            <v-icon icon="mdi-circle-small" />
                            {{ tab === 'sender' ? senderTotalApps : receiverTotalApps }}
                            <v-icon icon="mdi-circle-small" />
                            ${{ (tab === 'sender' ? senderTotalValue : receiverTotalValue).toFixed(2) }}
                          </template>

                          <dialog-select-user
                            v-if="tab !== 'sender'"
                            :title="`${users[tab] ? 'Change' : 'Select'} trade ${Trade.labels[tab].toLowerCase()}`"
                            @select:user="userId => users[tab] = userId"
                          >
                            <template #activator="{ props: dialogProps }">
                              <v-btn
                                v-bind="{ ...hoverProps, ...dialogProps }"
                                icon
                                size="x-small"
                                :style="users[tab] ? 'left: 1px; top: -1px; position: absolute;' : 'margin-right: 8px;'"
                                :variant="isHovering ? 'tonal' : 'text'"
                              >
                                <v-icon
                                  v-if="isHovering || !users[tab]"
                                  :class="!isHovering && tab === 'to' ? 'flipped' : ''"
                                  :icon="isHovering ? 'mdi-pencil' : tab === 'from' ? 'mdi-account-arrow-right' : 'mdi-account-arrow-left'"
                                  size="x-large"
                                />
                              </v-btn>
                              <span v-if="!users[tab]">Select a trader</span>
                            </template>
                          </dialog-select-user>
                        </div>
                      </template>
                    </v-hover>
                  </v-tab>

                  <v-divider
                    v-if="tab !== sides[sides.length - 1]"
                    vertical
                  />
                </template>
              </v-tabs>
              <v-divider />
            </div>
            <v-window
              v-model="currentSide"
              class="fill-height"
            >
              <v-window-item
                v-for="tab in sides"
                :key="tab"
                class="fill-height"
                :value="tab"
              >
                <v-container class="d-flex flex-column fill-height">
                  <dialog-select-collection
                    v-if="users[tab]"
                    multiple
                    :table-props="{
                      showSelect: true,
                      onlyUsers: [users[tab]],
                      onlyTypes: [Collection.enums.type.tradelist]
                    }"
                    @select="items => selectedCollections[tab] = items.map(({ id }) => id)"
                  >
                    <template #activator="{ props: dialogProps }">
                      <v-btn
                        v-bind="dialogProps"
                        block
                        class="flex-grow-0"
                        variant="tonal"
                      >
                        <v-icon
                          icon="mdi-pencil"
                          start
                        />
                        Tradelist selection
                      </v-btn>
                    </template>
                  </dialog-select-collection>

                  <table-apps
                    v-if="selectedCollections[tab]"
                    v-model="selectedApps[tab]"
                    v-model:mandatory="mandatoryApps[tab]"
                    class="flex-grow-1"
                    :only-collections="selectedCollections[tab]"
                    :quick-filters="getQuickFilters(tab)"
                    show-select
                  />
                </v-container>
              </v-window-item>
            </v-window>
          </v-card>
        </v-col>
        <v-col
          class="d-flex flex-column ga-6"
          cols="12"
          lg="4"
          order="1"
          order-lg="2"
        >
          <chat-container
            v-if="id"
            :trade-id="id"
          />

          <v-card class="d-flex flex-column flex-grow-1 h-100">
            <v-card-title class="text-button">
              <v-icon
                icon="mdi-information"
                start
              />
              Shape your offer
            </v-card-title>

            <v-divider />

            <v-card-text class="d-flex flex-column flex-grow-1">
              <v-chip
                class="mb-4 justify-center"
                size="large"
              >
                {{ tradeForm.senderTotal === 1 ? '1 app' : `${tradeForm.senderTotal || 0} apps` }} in exchange for {{ tradeForm.receiverTotal === 1 ? '1 app' : `${tradeForm.receiverTotal || 0} apps` }}
              </v-chip>
              <template
                v-for="side in sides"
                :key="side"
              >
                <div
                  class="d-flex flex-column"
                  :class="selectedApps[side].length ? 'flex-grow-0' : 'flex-grow-1'"
                >
                  <div
                    v-if="selectedApps[side].length"
                    class="d-flex align-center mb-1"
                  >
                    <span class="me-2 mb-2 text-no-wrap">{{ tradeForm[side + 'Total'] || 0 }} / {{ selectedApps[side].length || 0 }}</span>
                    <v-slider
                      v-model.number="tradeForm[side + 'Total']"
                      class="w-100 mb-2 flex-grow-0"
                      :disabled="selectedApps[side].every(({ id }) => mandatoryApps[side].some(({ id: mandatoryId }) => mandatoryId === id))"
                      hide-details
                      :max="selectedApps[side].length"
                      :min="mandatoryApps[side].length"
                      required
                      step="1"
                      type="number"
                      variant="plain"
                    />
                  </div>
                  <div
                    v-if="!selectedApps[side].length"
                    class="d-flex flex-column justify-center align-center text-center flex-grow-1"
                  >
                    <span class="text-disabled font-italic">Select apps to trade</span>
                  </div>
                  <div
                    v-else
                    class="flex-grow-1 app-grid"
                    :style="getGridStyle(selectedApps[side].length)"
                  >
                    <div
                      v-for="app in selectedApps[side]"
                      :key="`summary-${app.id}`"
                      class="app-grid-item position-relative"
                    >
                      <v-btn
                        v-tooltip:top="`Remove ${app.title || `Unknown app ${app.id}`}`"
                        class="app-remove-btn"
                        icon="mdi-close"
                        size="x-small"
                        @click.stop="removeApp(side, app.id)"
                      />
                      <nuxt-link
                        rel="noopener"
                        target="_blank"
                        :to="`/app/${app.id}`"
                      >
                        <v-img
                          v-ripple
                          v-tooltip:top="app.title || `Unknown app ${app.id}`"
                          :alt="app.title"
                          aspect-ratio="1"
                          class="h-100 w-100"
                          cover
                          lazy-src="/applogo.svg"
                          :src="app.header || `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${app.id}/header.jpg`"
                        />
                      </nuxt-link>
                      <v-number-input
                        v-model="tradeAppsForm[side][tradeAppsForm[side].findIndex(({ appId }) => appId === app.id)].total"
                        class="app-quantity-input"
                        :control-variant="gridItemWidth > 120 ? 'default' : 'hidden'"
                        density="compact"
                        hide-details
                        :min="1"
                        :prefix="gridItemWidth > 180 ? 'Copies:' : '#'"
                      />
                    </div>
                  </div>
                </div>
                <div
                  v-if="side === 'sender'"
                  class="d-flex align-center justify-center my-2"
                  :class="sides.every(side => selectedApps[side].length) ? 'flex-grow-1' : 'flex-grow-0'"
                >
                  <v-icon
                    class="my-4"
                    color="primary"
                    icon="mdi-swap-horizontal mdi-rotate-90"
                    size="32"
                  />
                </div>
              </template>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-footer
        class="mt-6 flex-grow-0"
        rounded
      >
        <v-btn
          variant="text"
          @click="router.back"
        >
          Cancel
        </v-btn>
        <v-spacer />
        <div class="d-flex flex-row align-center h-100">
          <v-switch
            v-model="headless"
            :color="headless ? 'warning' : undefined"
            hide-details
            true-icon="mdi-exclamation-thick"
          >
            <template #label>
              <span class="d-sm-block d-none">Auto-complete</span>

              <v-icon
                v-tooltip:left="'Ensures all offered apps are connected to a vault entry,\nand automatically completes the trade when accepted'"
                end
                icon="mdi-information-outline"
                size="20"
              />
            </template>
          </v-switch>
          <v-btn
            v-if="!headless || !tradeForm.receiverId"
            class="ml-4"
            color="success"
            :disabled="!isValid"
            type="submit"
            variant="tonal"
          >
            {{ isNew ? 'Send' : 'Save' }}
          </v-btn>
          <dialog-vault-selector
            v-else
            v-model="tradeAppsForm.sender"
            :only-apps="selectedApps.sender.map(({ id }) => id)"
            :user-id="tradeForm.receiverId"
            @submit="submit"
            @vaultless="tradeForm.senderVaultless = true; submit()"
          >
            <template #activator="attrs">
              <v-btn
                v-bind="attrs.props"
                class="ml-4"
                color="success"
                :disabled="!isValid"
                variant="tonal"
              >
                {{ isNew ? 'Send' : 'Save' }}
              </v-btn>
            </template>
          </dialog-vault-selector>
        </div>
      </v-footer>
    </v-form>
  </s-page-content>
</template>

<style lang="scss" scoped>
  .flipped {
    transform: scaleX(-1);
  }

  .tabs {
    ::v-deep(.v-btn--disabled) {
      opacity: inherit;
      pointer-events: inherit;
    }
  }

  .app-grid {
    display: grid;
    grid-gap: 8px;
    width: 100%;
    height: 100%;
    align-items: center;

    .app-grid-item {
      aspect-ratio: 1;
      display: block;
      position: relative;
      &:hover .app-remove-btn {
        opacity: 1;
      }
    }
  }

  .app-remove-btn {
    position: absolute;
    top: 1px;
    right: 1px;
    z-index: 2;
    background: rgba(var(--v-theme-surface), 0.8);
    opacity: 0;
    transition: opacity 0.2s;
  }

  .app-quantity-input {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2;
    background: rgba(var(--v-theme-surface), 0.8);
  }
</style>
