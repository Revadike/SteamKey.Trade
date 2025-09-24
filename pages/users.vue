<script setup>
  const { User } = useORM();
  const supabase = useSupabaseClient();

  const headers = [
    { title: User.labels.avatar, value: User.fields.avatar, sortable: false },
    { title: User.labels.displayName, value: User.fields.displayName, sortable: true },
    { title: User.labels.region, value: User.fields.region, sortable: true },
    { title: User.labels.bio, value: User.fields.bio, sortable: false },
    { title: User.labels.steamId, value: User.fields.steamId, sortable: true },
    { title: User.labels.createdAt, value: User.fields.createdAt, sortable: true }
  ];

  const countries = Object.values(User.enums.country).map(cc => ({
    text: User.labels[cc],
    value: cc
  }));
  const filters = [
    { title: User.labels.steamId, value: User.fields.steamId, type: String },
    { title: User.labels.customUrl, value: User.fields.customUrl, type: String },
    { title: User.labels.displayName, value: User.fields.displayName, type: String },
    { title: User.labels.bio, value: User.fields.bio, type: String },
    { title: User.labels.region, value: User.fields.region, type: String, options: countries },
    { title: User.labels.createdAt, value: User.fields.createdAt, type: Date }
  ];

  const queryGetter = () => {
    return supabase
      .from(User.table)
      .select([User.fields.id, ...headers.map(({ value }) => value)].join(','));
  };

  const title = 'Users';
  const breadcrumbs = [
    { title: 'Home', to: '/' },
    { title, disabled: true }
  ];

  useSeoMeta({ title, ogTitle: title });
</script>

<template>
  <s-page-content :breadcrumbs="breadcrumbs">
    <v-card class="h-100">
      <table-data
        class="h-100 "
        :filters="filters"
        filters-in-url
        :headers="headers"
        no-data-text="No users found"
        :query-getter="queryGetter"
        :search-field="User.fields.displayName"
        sort-in-url
        @click:row="(item) => navigateTo(`/user/${item[User.fields.customUrl] || item[User.fields.steamId]}`)"
      >
        <template #[`item.avatar`]="{ item }">
          <v-avatar
            color="surface-variant"
            :icon="item.avatar ? undefined : 'mdi-account'"
            :image="item.avatar ? item.avatar : undefined"
          />
        </template>

        <template #[`item.${User.fields.region}`]="{ item }">
          <span v-tooltip:top="User.labels[item.region]">
            {{ item.region }}
          </span>
        </template>

        <template #[`item.${User.fields.createdAt}`]="{ item }">
          <rich-date :date="item[User.fields.createdAt]" />
        </template>
      </table-data>
    </v-card>
  </s-page-content>
</template>
