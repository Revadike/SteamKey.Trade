<script setup>
  const { Trade } = useORM();
  const supabase = useSupabaseClient();

  const { isLoggedIn, user } = storeToRefs(useAuthStore());
  const activeTab = useSearchParam('tab', isLoggedIn.value ? 'received' : 'community');
  const tabs = ['received', 'sent', 'community'];

  const headers = computed(() => ([
    { title: Trade.labels.status, value: Trade.fields.status, sortable: true },
    ...((isLoggedIn.value && activeTab.value !== 'community')
      ? [
        activeTab.value === 'received'
          ? { title: 'Received from', value: Trade.fields.senderId, sortable: true }
          : { title: 'Sent to', value: Trade.fields.receiverId, sortable: true },
        { title: 'My apps', value: activeTab.value === 'received' ? 'want' : 'have', sortable: false },
        { title: 'Their apps', value: activeTab.value === 'received' ? 'have' : 'want', sortable: false }
      ]
      : [
        { title: Trade.labels.senderId, value: Trade.fields.senderId, sortable: true },
        { title: 'Have', value: 'have', sortable: false },
        { title: Trade.labels.receiverId, value: Trade.fields.receiverId, sortable: true },
        { title: 'Want', value: 'want', sortable: false }
      ]),
    { title: Trade.labels.createdAt, value: Trade.fields.createdAt, sortable: true }
  ]));

  const statuses = Object.values(Trade.enums.status).map(status => ({
    title: Trade.labels[status],
    value: status
  }));

  const filters = computed(() => [
    { title: Trade.labels.status, value: Trade.fields.status, type: String, options: statuses },
    // TODO: Add user search
    ...(isLoggedIn.value && activeTab.value === 'received'
      ? [{ title: Trade.labels.senderId, value: Trade.fields.senderId, type: String }]
      : []),
    { title: Trade.labels.senderDisputed, value: Trade.fields.senderDisputed, type: Boolean },
    { title: Trade.labels.senderTotal, value: Trade.fields.senderTotal, type: Number },
    // TODO: Add user search
    ...(isLoggedIn.value && activeTab.value === 'sent'
      ? [{ title: Trade.labels.receiverId, value: Trade.fields.receiverId, type: String }]
      : []),
    { title: Trade.labels.receiverDisputed, value: Trade.fields.receiverDisputed, type: Boolean },
    { title: Trade.labels.receiverTotal, value: Trade.fields.receiverTotal, type: Number },
    { title: Trade.labels.createdAt, value: Trade.fields.createdAt, type: Date }
  ]);

  const quickFilters = [
    {
      title: 'Active',
      value: {
        fields: [{
          field: Trade.fields.status,
          operation: 'in',
          value: [Trade.enums.status.pending, Trade.enums.status.accepted]
        }]
      }
    },
    {
      title: 'Disputed',
      value: {
        fields: [{
          operation: 'or',
          value: `${Trade.fields.senderDisputed}.eq.true,${Trade.fields.receiverDisputed}.eq.true`
        }]
      }
    },
    ...statuses.map(({ title, value }) => ({
      title,
      value: {
        fields: [{
          field: Trade.fields.status,
          operation: 'eq',
          value
        }]
      }
    }))
  ];

  const queryGetter = () => {
    let query = supabase
      .from(Trade.table)
      .select(`*, ${Trade.apps.table}(${Trade.apps.fields.appId}, ${Trade.apps.fields.userId})`);

    if (isLoggedIn.value && activeTab.value === 'received') {
      query = query.eq(Trade.fields.receiverId, user.value.id);
    } else if (isLoggedIn.value && activeTab.value === 'sent') {
      query = query.eq(Trade.fields.senderId, user.value.id);
    }
    // For 'community' tab, no user filtering (same as logged out)
    return query;
  };

  const mapItem = (trade) => {
    const have = trade[Trade.apps.table]
      .filter(app => app[Trade.apps.fields.userId] === trade[Trade.fields.senderId])
      .map(app => app[Trade.apps.fields.appId]);
    const want = trade[Trade.apps.table]
      .filter(app => app[Trade.apps.fields.userId] === trade[Trade.fields.receiverId])
      .map(app => app[Trade.apps.fields.appId]);
    return { ...trade, have, want };
  };

  const breadcrumbs = [
    { title: 'Home', to: '/' },
    { title: 'Trades', disabled: true }
  ];

  useSeoMeta({
    title: 'Trades'
  });
</script>

<template>
  <s-page-content :breadcrumbs="breadcrumbs">
    <template #actions>
      <v-btn
        v-if="isLoggedIn"
        to="/trade/new"
        variant="flat"
      >
        <v-icon
          icon="mdi-plus"
          start
        />
        New trade
      </v-btn>
    </template>

    <v-card class="d-flex flex-column h-100">
      <div
        v-if="isLoggedIn"
        class="d-block w-100"
      >
        <v-tabs v-model="activeTab">
          <template
            v-for="(tab, i) in tabs"
            :key="tab"
          >
            <v-tab
              class="w-33"
              :value="tab"
            >
              <template v-if="tab === 'received'">
                <v-icon
                  class="mr-2"
                  icon="mdi-arrow-right"
                  variant="tonal"
                />
                Received
              </template>
              <template v-else-if="tab === 'sent'">
                Sent
                <v-icon
                  class="ml-2"
                  icon="mdi-arrow-right"
                  variant="tonal"
                />
              </template>
              <template v-else>
                <v-icon
                  class="mr-2"
                  icon="mdi-account-group"
                  variant="tonal"
                />
                Community
              </template>
            </v-tab>
            <v-divider
              v-if="i < tabs.length - 1"
              vertical
            />
          </template>
        </v-tabs>
        <v-divider />
      </div>

      <s-quick-filters :filters="quickFilters" />

      <v-window
        v-model="activeTab"
        class="flex-grow-1"
        :disabled="!isLoggedIn"
      >
        <v-window-item
          v-for="tab in tabs"
          :key="tab"
          class="fill-height"
          :value="tab"
        >
          <table-data
            v-if="isLoggedIn || tab === 'community'"
            class="h-100"
            :default-sort-by="[{ key: Trade.fields.createdAt, order: 'desc' }]"
            :filters="filters"
            filters-in-header
            filters-in-url
            :headers="headers"
            :map-item="mapItem"
            :no-data-text="isLoggedIn ? `No ${tab} trades` : 'No trades found'"
            :query-getter="queryGetter"
            :row-link="(item) => `/trade/${item.id}`"
            sort-in-url
          >
            <template #[`item.${Trade.fields.status}`]="{ item }">
              <span :class="`text-${Trade.colors[item[Trade.fields.status]]} text-no-wrap`">
                <v-icon
                  class="mt-n1 mr-1"
                  :color="Trade.colors[item[Trade.fields.status]]"
                  :icon="Trade.icons[item[Trade.fields.status]]"
                />
                {{ Trade.labels[item[Trade.fields.status]] }}
              </span>
            </template>

            <template
              v-for="header in [Trade.fields.senderId, Trade.fields.receiverId]"
              :key="header"
              #[`item.${header}`]="{ item }"
            >
              <rich-profile-link :user-id="item[header]" />
            </template>

            <template
              v-for="header in ['have', 'want']"
              :key="header"
              #[`item.${header}`]="{ item }"
            >
              <v-chip color="grey">
                <strong class="text-primary">
                  {{ item[header === 'have' ? Trade.fields.senderTotal : Trade.fields.receiverTotal] }}
                </strong>
                <span class="text-grey ml-1">
                  of {{ item[header].length }}
                </span>
                <!-- TODO: Display apps -->
              </v-chip>
            </template>

            <template #[`item.${Trade.fields.createdAt}`]="{ item }">
              <rich-date :date="item[Trade.fields.createdAt]" />
            </template>
          </table-data>
        </v-window-item>
      </v-window>
    </v-card>
  </s-page-content>
</template>
