<script setup>
  const props = defineProps({
    userId: {
      type: String,
      required: true
    }
  });

  const { Trade } = useORM();
  const supabase = useSupabaseClient();

  const headers = [
    { title: Trade.labels.status, value: Trade.fields.status },
    { title: 'With User', value: 'user' },
    { title: 'Have', value: 'have', sortable: false },
    { title: 'Want', value: 'want', sortable: false },
    { title: Trade.labels.createdAt, value: Trade.fields.createdAt, sortable: true }
  ];

  const queryGetter = () => {
    return supabase
      .from(Trade.table)
      .select(`*, ${Trade.apps.table}(${Trade.apps.fields.appId}, ${Trade.apps.fields.userId})`)
      .or(`${Trade.fields.senderId}.eq.${props.userId},${Trade.fields.receiverId}.eq.${props.userId}`);
  };

  const mapItem = (trade) => {
    const { senderId, receiverId } = Trade.fromDB(trade);
    const user = receiverId === props.userId ? senderId : receiverId;
    const have = trade[Trade.apps.table]
      .filter(app => app[Trade.apps.fields.userId] === senderId)
      .map(app => app[Trade.apps.fields.appId]);
    const want = trade[Trade.apps.table]
      .filter(app => app[Trade.apps.fields.userId] === receiverId)
      .map(app => app[Trade.apps.fields.appId]);

    return {
      user,
      have,
      want,
      ...trade
    };
  };
</script>

<template>
  <table-data
    class="trades-table"
    :default-sort-by="[{
      key: Trade.fields.createdAt,
      order: 'desc',
    }]"
    :headers="headers"
    :map-item="mapItem"
    must-sort
    no-data-text="No trades yet"
    :query-getter="queryGetter"
    :row-link="(item) => `/trade/${item.id}`"
  >
    <template #[`item.${Trade.fields.status}`]="{ item }">
      <span
        class="text-no-wrap"
        :class="`text-${Trade.colors[item[Trade.fields.status]]}`"
      >
        <v-icon
          class="mt-n1 mr-1"
          :color="Trade.colors[item[Trade.fields.status]]"
          :icon="Trade.icons[item[Trade.fields.status]]"
        />
        {{ Trade.labels[item[Trade.fields.status]] }}
      </span>
    </template>

    <template #[`item.user`]="{ item }">
      <rich-profile-link :user-id="item.user" />
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
</template>
