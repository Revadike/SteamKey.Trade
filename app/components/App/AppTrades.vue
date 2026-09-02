<script setup>
  const { Trade } = useORM();
  const supabase = useSupabaseClient();

  const props = defineProps({
    appid: {
      type: [String, Number],
      required: true
    }
  });

  const headers = [
    { title: Trade.labels.status, value: Trade.fields.status, sortable: true },
    { title: Trade.labels.senderId, value: Trade.fields.senderId, sortable: true },
    { title: Trade.labels.receiverId, value: Trade.fields.receiverId, sortable: true },
    { title: Trade.labels.createdAt, value: Trade.fields.createdAt, sortable: true }
  ];

  const queryGetter = () => {
    return supabase
      .from(Trade.table)
      .select(`${Trade.fields.id}, ${headers.map(header => header.value).join(',')}, ${Trade.apps.table}!inner(*)`)
      .eq(`${Trade.apps.table}.${Trade.apps.fields.appId}`, props.appid);
  };
</script>

<template>
  <table-data
    class="h-100"
    :default-sort-by="[{
      key: Trade.fields.createdAt,
      order: 'desc',
    }]"
    :headers="headers"
    must-sort
    no-data-text="No trades yet"
    :query-getter="queryGetter"
    :row-link="(item) => `/trade/${item.id}`"
  >
    <template #[`item.${Trade.fields.status}`]="{ item }">
      <span :class="`text-${Trade.colors[item.status]}`">
        <v-icon
          class="mt-n1 mr-1"
          :color="Trade.colors[item.status]"
          :icon="Trade.icons[item.status]"
        />
        {{ Trade.labels[item.status] }}
      </span>
    </template>

    <template
      v-for="header in [Trade.fields.senderId, Trade.fields.receiverId]"
      :key="header"
      #[`item.${header}`]="{ item }"
    >
      <rich-profile-link :user-id="item[header]" />
    </template>

    <template #[`item.${Trade.fields.createdAt}`]="{ item }">
      <rich-date :date="item[Trade.fields.createdAt]" />
    </template>
  </table-data>
</template>
