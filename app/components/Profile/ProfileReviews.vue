<script setup>
  const props = defineProps({
    userId: {
      type: String,
      required: true
    }
  });

  const { Review } = useORM();
  const headers = [
    { title: 'Comment/User', value: Review.fields.body, sortable: false, align: 'start' },
    ...Object.keys(Review.enums.metric).map(metric => ({
      title: Review.labels[metric],
      value: Review.fields[metric],
      sortable: true,
      align: 'center'
    })),
    { title: Review.labels.createdAt, value: Review.fields.createdAt, sortable: true, align: 'end' }
  ];

  const supabase = useSupabaseClient();
  const queryGetter = () => {
    return supabase.from(Review.table).select().eq(Review.fields.subjectId, props.userId);
  };
</script>

<template>
  <table-data
    :default-sort-by="[{
      key: Review.fields.createdAt,
      order: 'desc'
    }]"
    :headers="headers"
    must-sort
    no-data-text="No reviews yet"
    :query-getter="queryGetter"
  >
    <template #[`item.body`]="{ item }">
      <div class="py-2">
        <p v-if="item.body">
          <v-icon icon="mdi-format-quote-open" />
          {{ item.body }}
          <v-icon icon="mdi-format-quote-close" />
        </p>
        <rich-profile-link :user-id="item[Review.fields.userId]" />
      </div>
    </template>

    <template
      v-for="metric in Object.keys(Review.enums.metric)"
      :key="metric"
      #[`header.${metric}`]
    >
      <v-icon
        v-tooltip:top="Review.labels[metric]"
        :icon="Review.icons[metric]"
      />
    </template>

    <template
      v-for="metric in Object.keys(Review.enums.metric)"
      :key="metric"
      #[`item.${metric}`]="{ item }"
    >
      <div v-tooltip:top="Review.descriptions[metric]">
        <v-rating
          v-model="item[metric]"
          color="yellow"
          length="5"
          readonly
          size="16"
        />
      </div>
    </template>

    <template #[`item.${Review.fields.createdAt}`]="{ item }">
      <rich-date :date="item[Review.fields.createdAt]" />
    </template>
  </table-data>
</template>