<script setup>
  import { validate } from 'uuid';
  import { relativeDate } from '~/assets/js/date';

  const props = defineProps({
    id: {
      type: String,
      required: true
    }
  });

  if (!validate(props.id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Trade ID invalid',
      message: 'This is not a valid trade',
      fatal: true
    });
  }

  const { user, isLoggedIn } = useAuthStore();
  const { App, Trade, Review } = useORM();
  const snackbarStore = useSnackbarStore();
  const supabase = useSupabaseClient();

  const { data: trade, status: tradeStatus, error: tradeError, refresh: tradeRefresh } = useLazyAsyncData(`trade-${props.id}`, async () => {
    try {
      const instance = new Trade(props.id);
      await instance.load();
      return instance.toObject();
    } catch (err) {
      if (err.code === 'PGRST116') {
        throw createError({
          statusCode: 404,
          statusMessage: 'Trade not found',
          message: 'The trade you are looking for does not exist',
          fatal: true
        });
      }
      throw err;
    }
  });

  const { data: tradeApps, status: appsStatus, error: appsError, refresh: appsRefresh } = useLazyAsyncData(`trade-apps-${props.id}`, async () => {
    const instance = new Trade(props.id);
    const apps = await instance.getApps(true);

    return {
      sender: apps.filter(app => app.trade.senderId === app.userId),
      receiver: apps.filter(app => app.trade.receiverId === app.userId)
    };
  });

  watch(() => tradeError.value || appsError.value, (error) => {
    if (error) {
      console.error(error);
      throw error;
    }
  });

  const refresh = () => Promise.all([
    tradeRefresh(),
    appsRefresh()
  ]);

  const { data: tradeViews } = useLazyAsyncData(`trade-views-${props.id}`, async () => {
    const instance = new Trade(props.id);
    return instance.getViews(true);
  });

  const avatarGroupItems = computed(() => {
    if (!tradeViews.value) {
      return [];
    }
    return tradeViews.value.map(view => ({
      image: view.user?.avatar || undefined,
      icon: view.user?.avatar ? undefined : 'mdi-account',
      _raw: view // Store the original data
    }));
  });

  onMounted(async () => {
    if (!isLoggedIn) {
      return;
    }

    const instance = new Trade(props.id);
    await instance.view(user.id); // Mark the trade as viewed
  });

  const apps = ref({ sender: [], receiver: [] });
  const selectedApps = ref({ sender: [], receiver: [] });
  const mandatoryApps = ref({ sender: [], receiver: [] });

  watch(() => tradeApps.value, (newTradeApps, oldTradeApps) => {
    // If `newTradeApps` is valid and contains both sender and receiver
    if (!newTradeApps?.sender || !newTradeApps?.receiver) {
      return;
    }

    // Extract the unique appIds from sender and receiver
    const newSenderAppIds = newTradeApps.sender.map(app => app.appId);
    const newReceiverAppIds = newTradeApps.receiver.map(app => app.appId);

    // Identify added or removed apps by comparing new vs old appIds
    const oldSenderAppIds = oldTradeApps?.sender?.map(app => app.appId) || [];
    const oldReceiverAppIds = oldTradeApps?.receiver?.map(app => app.appId) || [];

    // Determine which apps have been added or removed
    const addedSenderApps = newSenderAppIds.filter(appId => !oldSenderAppIds.includes(appId));
    const removedSenderApps = oldSenderAppIds.filter(appId => !newSenderAppIds.includes(appId));

    const addedReceiverApps = newReceiverAppIds.filter(appId => !oldReceiverAppIds.includes(appId));
    const removedReceiverApps = oldReceiverAppIds.filter(appId => !newReceiverAppIds.includes(appId));

    // If there are any changes (added/removed), update the data
    if (addedSenderApps.length || removedSenderApps.length || addedReceiverApps.length || removedReceiverApps.length) {
      // Query only the apps that have been added or removed
      const appIdsToQuery = [
        ...new Set([
          ...addedSenderApps,
          ...removedSenderApps,
          ...addedReceiverApps,
          ...removedReceiverApps
        ])
      ];

      // Fetch data from the API
      App.query(supabase, [
        { filter: 'in', params: [App.fields.id, appIdsToQuery] }
      ]).then(instances => {
        const data = instances.map(instance => instance.toObject());

        // Helper function to map app data with snapshot information
        const mapAppsWithSnapshot = (data, sourceApps, filterFn = () => true) => {
          return data
            .filter(app => sourceApps.some(({ appId }) => appId === app.id && filterFn({ appId, ...sourceApps.find(a => a.appId === app.id) })))
            .map(app => ({
              ...app,
              snapshot: sourceApps.find(({ appId }) => appId === app.id)?.snapshot,
              total: sourceApps.find(({ appId }) => appId === app.id)?.total // pass total to TableApps
            }));
        };

        // Update `sender` and `receiver` arrays based on the current state
        apps.value.sender = mapAppsWithSnapshot(data, newTradeApps.sender);
        apps.value.receiver = mapAppsWithSnapshot(data, newTradeApps.receiver);

        // Update `mandatoryApps` for both sender and receiver
        mandatoryApps.value.sender = mapAppsWithSnapshot(data, newTradeApps.sender, ({ mandatory }) => mandatory);
        mandatoryApps.value.receiver = mapAppsWithSnapshot(data, newTradeApps.receiver, ({ mandatory }) => mandatory);

        // Set `selectedApps` based on the current state
        if (isAccepting.value) {
          // When accepting, selected apps are the same as mandatory apps, or all selected if required total matches total offered apps
          selectedApps.value.sender = apps.value.sender.length === trade.value.senderTotal ? [...apps.value.sender] : [...mandatoryApps.value.sender];
          selectedApps.value.receiver = apps.value.receiver.length === trade.value.receiverTotal ? [...apps.value.receiver] : [...mandatoryApps.value.receiver];
        } else {
          // Otherwise, use the selected flag from trade apps
          selectedApps.value.sender = mapAppsWithSnapshot(data, newTradeApps.sender, ({ selected }) => selected);
          selectedApps.value.receiver = mapAppsWithSnapshot(data, newTradeApps.receiver, ({ selected }) => selected);
        }
      });
    }
  }, { deep: true, immediate: true });

  watch(() => selectedApps.value, () => {
    for (const type of ['sender', 'receiver']) {
      for (let i = 0; i < tradeApps.value[type].length; i++) {
        const isSelected = mandatoryApps.value[type].some(app => app.id === tradeApps.value[type][i].appId)
          || selectedApps.value[type].some(app => app.id === tradeApps.value[type][i].appId);

        tradeApps.value[type][i].selected = isSelected;
      }
    }
  }, { deep: true });

  const isValid = computed(() => {
    return selectedApps.value.sender.length === trade.value.senderTotal &&
      selectedApps.value.receiver.length === trade.value.receiverTotal;
  });

  const isLoading = computed(() => {
    return tradeStatus.value === 'pending' || appsStatus.value === 'pending';
  });

  const isAccepting = computed(() => {
    return isLoggedIn && trade.value && user.id && trade.value.receiverId === user.id && trade.value.status === Trade.enums.status.pending;
  });

  const submitting = ref(false);
  const updateStatus = async status => {
    if (!Object.values(Trade.enums.status).includes(status)) {
      snackbarStore.set('error', 'Invalid status');
      return;
    }

    submitting.value = true;
    try {
      const instance = new Trade(props.id);

      if ([Trade.enums.status.accepted, Trade.enums.status.completed].includes(status)) {
        if (!isValid.value) {
          snackbarStore.set('error', 'Please select all apps');
          submitting.value = false;
          return;
        }

        const apps = Object.values(tradeApps.value).flat();
        const bothVaultless = trade.value.senderVaultless && trade.value.receiverVaultless;
        const vaultComplete = apps.every(({ vaultEntries, total }) => vaultEntries && vaultEntries.filter(Boolean).length === total);
        if (vaultComplete || bothVaultless) {
          status = Trade.enums.status.completed;
        }

        await instance.setApps(apps, true); // Update selection and connected vault entries
      }

      instance.status = status;
      instance.receiverVaultless = trade.value.receiverVaultless;
      instance.senderVaultless = trade.value.senderVaultless;
      await instance.save();

      snackbarStore.set('success', `Trade ${status}`);
    } catch (error) {
      snackbarStore.set('error', error.message);
    }
    submitting.value = false;
  };

  const isDisputed = computed(() => trade.value && (trade.value.senderDisputed || trade.value.receiverDisputed));
  const reportTrade = async value => {
    submitting.value = true;
    const key = trade.value.receiverId === user.id ? 'receiverDisputed' : 'senderDisputed';
    try {
      const instance = new Trade(props.id);
      instance[key] = value;
      await instance.save();

      snackbarStore.set('success', 'Dispute status updated');
    } catch (error) {
      snackbarStore.set('error', error.message);
    }
    submitting.value = false;
  };

  const deleteTrade = async () => {
    submitting.value = true;
    try {
      const instance = new Trade(props.id);
      await instance.delete();
      snackbarStore.set('success', 'Trade deleted');
      await navigateTo('/trades');
    } catch (error) {
      snackbarStore.set('error', error.message);
    }
    submitting.value = false;
  };

  const showReviewDialog = ref(false);
  const reviewChecked = ref(false);

  watch(() => trade.value?.status, async (status) => {
    if (status !== Trade.enums.status.completed) {
      showReviewDialog.value = false;
      reviewChecked.value = false;
      return;
    }

    if (
      status === Trade.enums.status.completed &&
      isLoggedIn &&
      (user.id === trade.value.senderId || user.id === trade.value.receiverId) &&
      !reviewChecked.value
    ) {
      // Determine partner userId
      const partnerId = user.id === trade.value.senderId ? trade.value.receiverId : trade.value.senderId;
      if (!partnerId) {
        return;
      }

      // Check if review exists
      const reviews = await Review.query(supabase, [
        { filter: 'eq', params: [Review.fields.subjectId, partnerId] },
        { filter: 'eq', params: [Review.fields.userId, user.id] }
      ]);

      if (!reviews.length) {
        showReviewDialog.value = true;
      }

      reviewChecked.value = true;
    }
  }, { immediate: true });

  const footerVisible = computed(() => {
    return isLoggedIn && trade.value && [
      trade.value.receiverId,
      trade.value.senderId
    ].includes(user.id) && ![
      Trade.enums.status.declined,
      Trade.enums.status.aborted
    ].includes(trade.value.status);
  });

  const title = computed(() => `${Trade.labels[trade.value?.status] || 'Loading'} trade`);
  const description = computed(() => `Trade offering ${trade.value?.senderTotal || 0} ${trade.value?.senderTotal === 1 ? 'app' : 'apps'} in exchange for ${trade.value?.receiverTotal || 0} ${trade.value?.receiverTotal === 1 ? 'app' : 'apps'}`);
  const breadcrumbs = computed(() => [
    { title: 'Home', to: '/' },
    { title: 'Trades', to: '/trades' },
    { title: title.value, disabled: true }
  ]);

  useSeoMeta({
    title,
    ogTitle: title,
    description,
    ogDescription: description
  });
</script>

<template>
  <s-page-content
    :breadcrumbs="breadcrumbs"
    :loading="isLoading"
  >
    <dialog-user-review
      v-if="trade && user && (user.id === trade.senderId || user.id === trade.receiverId)"
      v-model="showReviewDialog"
      :user-id="user.id === trade.senderId ? trade.receiverId : trade.senderId"
    />

    <v-form
      class="d-flex flex-column flex-grow-1"
      @submit.prevent="updateStatus(Trade.enums.status.accepted)"
    >
      <v-row class="flex-grow-1">
        <v-col
          cols="12"
          lg="8"
          order="2"
          order-lg="1"
        >
          <v-card
            class="fill-height d-flex flex-column"
            :loading="submitting"
          >
            <v-card-title class="d-flex align-center text-button">
              <span>

                <v-icon
                  class="mr-1"
                  icon="mdi-swap-horizontal"
                />
                Trade offer:
              </span>

              <v-icon
                class="ml-2 mr-1"
                :color="Trade.colors[trade.status]"
                :icon="Trade.icons[trade.status]"
              />
              <span :class="`text-${Trade.colors[trade.status]}`">
                {{ Trade.labels[trade.status] }}
              </span>

              <span
                v-if="trade.originalId"
                class="ml-2"
              >
                (Counter to
                <nuxt-link
                  :href="`/trade/${trade.originalId}`"
                  rel="noopener"
                  target="_blank"
                >
                  <v-icon icon="mdi-arrow-right" />
                </nuxt-link>
                )
              </span>

              <v-spacer class="my-1" />

              <v-avatar-group
                v-if="avatarGroupItems?.length"
                class="ml-2"
                :items="avatarGroupItems"
                :limit="6"
                size="34"
              >
                <template #item="{ props: avatarProps, index }">
                  <nuxt-link :to="`/user/${tradeViews[index].user.customUrl || tradeViews[index].user.steamId}`">
                    <v-avatar
                      v-ripple
                      v-tooltip="`Viewed by ${tradeViews[index].user.displayName || tradeViews[index].user.steamId} ${relativeDate(tradeViews[index].updatedAt || tradeViews[index].createdAt)}`"
                      class="trade-view-avatar"
                      color="secondary"
                      v-bind="avatarProps"
                    />
                  </nuxt-link>
                </template>

                <template #overflow="{ overflow }">
                  <div>
                    <v-tooltip
                      location="bottom"
                      open-on-click
                    >
                      <template #activator="attrs">
                        <v-avatar
                          class="trade-view-avatar text-disabled text-caption"
                          color="secondary"
                          v-bind="attrs.props"
                        >
                          +{{ overflow }}
                        </v-avatar>
                      </template>
                      <p class="text-center font-weight-bold">
                        Viewers
                      </p>
                      <p
                        v-for="view in tradeViews.slice(6)"
                        :key="view.userId"
                        class="text-no-wrap d-flex align-center"
                      >
                        {{ view.user.displayName || view.user.steamId }}
                        <v-spacer class="mx-1" />
                        <rich-date :date="view.updatedAt || view.createdAt" />
                      </p>
                    </v-tooltip>
                  </div>
                </template>
              </v-avatar-group>

              <v-chip
                v-if="isDisputed"
                class="ml-4"
                color="error"
                size="large"
                variant="outlined"
              >
                <v-icon
                  class="mr-0 mr-sm-2"
                  icon="mdi-chat-alert"
                  size="20"
                />
                <span class="d-none d-sm-block font-weight-bold">Disputed</span>
              </v-chip>
            </v-card-title>
            <v-divider />
            <v-card-text class="d-flex flex-column flex-grow-1">
              <div class="text-center mb-2 text-disabled">
                <rich-profile-link :user-id="trade.senderId" /> offered <strong class="text-primary">{{ trade.senderTotal }}</strong> {{ trade.senderTotal === 1 ? 'app' : 'apps' }}:
              </div>

              <table-apps
                v-model="selectedApps.sender"
                v-model:mandatory="mandatoryApps.sender"
                class="border rounded-lg"
                :items="apps.sender"
                :max-selection="trade.senderTotal"
                no-mandatory
                :show-select="isAccepting"
              />

              <v-spacer />

              <div class="text-center">
                <v-icon
                  class="my-4 mdi-rotate-90"
                  color="primary"
                  icon="mdi-swap-horizontal"
                  size="48"
                />
              </div>

              <v-spacer />

              <div class="text-center mb-2 text-disabled">
                requesting <strong class="text-primary">{{ trade.receiverTotal }}</strong> {{ trade.receiverTotal === 1 ? 'app' : 'apps' }} from <rich-profile-link :user-id="trade.receiverId" />:
              </div>

              <table-apps
                v-model="selectedApps.receiver"
                v-model:mandatory="mandatoryApps.receiver"
                class="border rounded-lg"
                :items="apps.receiver"
                :max-selection="trade.receiverTotal"
                no-mandatory
                :show-select="isAccepting"
              />
            </v-card-text>
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
            class="flex-grow-1"
            :trade-id="props.id"
          />

          <trade-activity
            class="flex-grow-1"
            :trade-id="props.id"
            @update="refresh"
          />
        </v-col>
      </v-row>

      <v-footer
        v-if="footerVisible"
        class="mt-6 flex-grow-0"
        rounded
      >
        <dialog-confirm
          v-if="isAccepting"
          color="error"
          confirm-text="Yes"
          title="Have you tried to counter?"
          @confirm="updateStatus(Trade.enums.status.declined)"
        >
          <template #activator="attrs">
            <v-btn
              v-bind="attrs.props"
              class="mr-4"
              color="error"
              variant="tonal"
            >
              Decline
            </v-btn>
          </template>
        </dialog-confirm>

        <v-btn
          v-if="trade.senderId === user.id && trade.status === Trade.enums.status.pending"
          color="error"
          variant="tonal"
          @click="deleteTrade"
        >
          Delete
        </v-btn>

        <dialog-confirm
          v-if="trade.status === Trade.enums.status.accepted"
          color="error"
          @confirm="updateStatus(Trade.enums.status.aborted)"
        >
          <template #activator="attrs">
            <v-btn
              v-bind="attrs.props"
              color="error"
              variant="tonal"
            >
              Abort
            </v-btn>
          </template>
        </dialog-confirm>

        <v-spacer />

        <v-btn
          class="text-disabled"
          :to="`/trade/new?copy=${id}`"
          type="submit"
          variant="text"
        >
          Copy
        </v-btn>
        <template v-if="isAccepting">
          <v-btn
            class="mx-4"
            color="warning"
            :to="`/trade/new?counter=${id}`"
            type="submit"
            variant="tonal"
          >
            Counter
          </v-btn>
          <span class="text-caption">or</span>
          <dialog-confirm
            v-if="trade.senderVaultless"
            color="warning"
            confirm-text="Agree"
            title="Exchange off-platform"
            @confirm="trade.receiverVaultless = true; updateStatus(Trade.enums.status.accepted)"
          >
            <template #activator="attrs">
              <v-btn
                v-bind="attrs.props"
                class="ml-4"
                color="success"
                :disabled="!isValid"
                variant="tonal"
              >
                Accept
              </v-btn>
            </template>

            <template #body>
              <v-alert
                icon="mdi-alert"
                type="warning"
                variant="outlined"
              >
                <p>Your trade partner has requested to exchange off-platform. Are you sure you want to proceed?</p>
                <br>
                <p>Beware that trading off-platform carries a higher risk, as tracking the exchange will not be possible. This can make resolving potential disputes significantly more difficult.</p>
                <br>
                <p>To successfully mark this trade as completed, <b>both parties must acknowledge and agree to do the exchange outside the platform.</b> Decline this trade if you do not agree.</p>
              </v-alert>
            </template>
          </dialog-confirm>

          <dialog-vault-selector
            v-else
            v-model="tradeApps.receiver"
            :only-apps="selectedApps.receiver.map(({ id }) => id)"
            :user-id="trade.senderId"
            @submit="updateStatus(Trade.enums.status.accepted)"
            @vaultless="trade.receiverVaultless = true; updateStatus(Trade.enums.status.accepted)"
          >
            <template #activator="attrs">
              <v-btn
                v-bind="attrs.props"
                class="ml-4"
                color="success"
                :disabled="!isValid"
                variant="tonal"
              >
                Accept
              </v-btn>
            </template>
          </dialog-vault-selector>
        </template>

        <template v-if="trade.senderId === user.id">
          <v-btn
            v-if="trade.status === Trade.enums.status.pending"
            class="ml-4"
            color="primary"
            :to="`/trade/${id}/edit`"
            variant="tonal"
          >
            Edit
          </v-btn>
          <dialog-confirm
            v-if="trade.senderId === user.id && trade.status === Trade.enums.status.accepted && trade.receiverVaultless"
            color="warning"
            confirm-text="Agree"
            title="Exchange off-platform"
            @confirm="trade.senderVaultless = true; updateStatus(Trade.enums.status.completed)"
          >
            <template #activator="attrs">
              <v-btn
                v-bind="attrs.props"
                class="ml-4"
                color="success"
                variant="tonal"
              >
                Complete
              </v-btn>
            </template>

            <template #body>
              <v-alert
                icon="mdi-alert"
                type="warning"
                variant="outlined"
              >
                <p>Your trade partner has requested to exchange off-platform. Are you sure you want to proceed?</p>
                <br>
                <p>Beware that trading off-platform carries a higher risk, as tracking the exchange will not be possible. This can make resolving potential disputes significantly more difficult.</p>
                <br>
                <p>To successfully mark this trade as completed, <b>both parties must acknowledge and agree to do the exchange outside the platform.</b> Abort this trade if you do not agree.</p>
              </v-alert>
            </template>
          </dialog-confirm>

          <dialog-vault-selector
            v-if="trade.senderId === user.id && trade.status === Trade.enums.status.accepted && !trade.receiverVaultless"
            v-model="tradeApps.sender"
            :only-apps="selectedApps.sender.map(({ id }) => id)"
            :user-id="trade.receiverId"
            @submit="updateStatus(Trade.enums.status.completed)"
            @vaultless="trade.senderVaultless = true; updateStatus(Trade.enums.status.completed)"
          >
            <template #activator="attrs">
              <v-btn
                v-bind="attrs.props"
                class="ml-4"
                color="success"
                variant="tonal"
              >
                Complete
              </v-btn>
            </template>
          </dialog-vault-selector>
        </template>
        <dialog-confirm
          v-if="trade.status === Trade.enums.status.completed && !isDisputed"
          color="error"
          confirm-text="Submit a dispute"
          title="Report trade"
          @confirm="() => reportTrade(true)"
        >
          <template #activator="attrs">
            <v-btn
              v-bind="attrs.props"
              color="error"
              variant="tonal"
            >
              <v-icon
                icon="mdi-alert"
                start
              />
              Report
            </v-btn>
          </template>

          <template #body>
            <v-alert
              icon="mdi-alert"
              type="error"
              variant="outlined"
            >
              <p>If you did not receive the expected item(s), you may dispute this offer until it's marked as resolved.</p>
              <br>
              <p>We encourage resolving the dispute by contacting the other party directly. Consider arranging a new trade where they include a replacement for the invalid or lost item.</p>
              <br>
              <p>Remember, you can mark the dispute as resolved at any time, and report again if needed. <b>If the dispute remains unresolved, it will negatively impact the trader's reputation.</b></p>
            </v-alert>
          </template>
        </dialog-confirm>
        <v-btn
          v-if="(trade.senderDisputed && trade.senderId === user.id) || (trade.receiverDisputed && trade.receiverId === user.id)"
          color="success"
          variant="tonal"
          @click="() => reportTrade(false)"
        >
          <v-icon
            icon="mdi-emoticon-happy-outline"
            start
          />
          Dispute resolved
        </v-btn>
      </v-footer>
    </v-form>
  </s-page-content>
</template>

<style lang="scss" scoped>
  .trade-view-avatar {
    border-width: 4px !important;
    border-style: solid !important;
    border-color: rgb(var(--v-theme-surface)) !important;
    margin-right: -8px;
    transition: transform 0.2s ease-in-out;

    &:hover {
      z-index: 1;
      transform: scale(1.25);
      transition: transform 0.2s ease-in-out;
    }
  }
</style>
