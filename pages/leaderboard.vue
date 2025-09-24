<script setup>
  import { useDisplay } from 'vuetify';

  const { User } = useORM();
  // const { isLoggedIn } = storeToRefs(useAuthStore());
  const supabase = useSupabaseClient();

  const title = 'Leaderboard';
  const breadcrumbs = [
    { title: 'Home', to: '/' },
    { title, disabled: true }
  ];

  const table = useTemplateRef('table');
  const mainStat = User.statistics.fields.totalCompletedTrades; // TODO: maybe turn this into a v-select?
  const activeTab = ref('top100');
  // TODO: Implement a friend system (See #94)
  // const tabs = ['top100', 'friends'];
  const tabs = ['top100'];

  const headers = [
    { title: '#', value: 'rank', sortable: false },
    { title: 'User', value: User.statistics.fields.userId, sortable: true },
    { title: User.shortLabels.totalCompletedTrades, value: User.statistics.fields.totalCompletedTrades, sortable: true },
    { title: User.shortLabels.totalAcceptedTrades, value: User.statistics.fields.totalAcceptedTrades, sortable: true },
    { title: User.shortLabels.avgSpeed, value: User.statistics.fields.avgSpeed, sortable: true },
    { title: User.shortLabels.totalReviewsReceived, value: User.statistics.fields.totalReviewsReceived, sortable: true }
  ];

  const queryGetter = () => {
    const query = supabase
      .from(User.statistics.table)
      .select(`
        ${User.statistics.fields.userId},
        ${mainStat},
        ${User.statistics.fields.totalUniqueTrades},
        ${User.statistics.fields.totalDeclinedTrades},
        ${User.statistics.fields.totalAcceptedTrades},
        ${User.statistics.fields.totalReviewsReceived},
        ${User.statistics.fields.avgSpeed}
      `)
      // Exclude top 3 users from the query
      .not(User.statistics.fields.userId, 'in', `(${(top3.value?.map(user => user.userId) || []).join(',')})`);

    // TODO: Implement a friend system (See #94)
    // if (isLoggedIn.value && activeTab.value === 'friends') {
    //   query = query.eq(Trade.fields.receiverId, user.value.id);
    // }

    return query;
  };

  const sortBy = [{
    key: mainStat,
    order: 'desc'
  }];

  const { data: top3, status, error } = useLazyAsyncData(`top-3-${mainStat}`, async () => {
    const { data, error } = await supabase
      .from(User.statistics.table)
      .select(`
        ${User.statistics.fields.userId},
        ${mainStat},
        ${User.statistics.fields.totalUniqueTrades},
        ${User.statistics.fields.totalDeclinedTrades},
        ${User.statistics.fields.totalReviewsReceived},
        ${User.statistics.fields.avgSpeed}
      `)
      .order(mainStat, { ascending: false, nullsFirst: false })
      .order(`${User.statistics.fields.totalUniqueTrades}`, { ascending: false, nullsFirst: false })
      .limit(3);

    if (error) {
      throw error;
    }

    return data.map(record => User.fromDB(record, User.statistics.fields));
  });

  watch(error, (value) => {
    if (value) {
      console.error(value);
      throw createError({
        statusCode: 500,
        statusMessage: 'Internal Server Error',
        message: 'An error occurred while loading the leaderboard',
        fatal: true
      });
    }
  });

  // const isWrapped = computed(() => shouldWrap.value ? 12 : 4);
  const { mdAndUp } = useDisplay();

  useSeoMeta({ title, ogTitle: title });
</script>

<template>
  <s-page-content
    :breadcrumbs="breadcrumbs"
    :loading="status === 'pending'"
  >
    <!-- friends leaderboard only if logged in-->
    <!-- TODO: Implement a friend system (See #94) -->
    <!-- <template
      v-if="isLoggedIn && false"
      #append
    >
      <v-tabs v-model="activeTab">
        <v-tab value="top100">
          <v-icon
            class="mr-2"
            icon="mdi-human-queue"
            variant="tonal"
          />
          Top 100
        </v-tab>
        <v-tab value="friends">
          <v-icon
            class="mr-2"
            icon="mdi-human-male-female"
            variant="tonal"
          />
          Friends
        </v-tab>
      </v-tabs>
    </template> -->

    <v-window
      v-model="activeTab"
      class=""
    >
      <v-window-item
        v-for="tab in tabs"
        :key="tab"
        class="fill-height"
        :value="tab"
      >
        <v-container class="d-flex flex-column align-center my-5">
          <!-- Podium Section -->
          <v-row
            class="w-100 ga-5"
            justify="center"
          >
            <v-col
              v-for="index in (mdAndUp ? [1, 0, 2] : [0, 1, 2])"
              :key="index"
              cols="12"
              md="3"
            >
              <leaderboard-podium-card
                v-if="top3?.[index]"
                :position="(index + 1).toString()"
                :style="mdAndUp ? { marginTop: index === 0 ? '0' : (index === 1 ? '30px' : '60px') } : {}"
                :user="top3[index]"
              />
            </v-col>
          </v-row>
          <table-data
            ref="table"
            class="h-100 mt-10"
            :default-sort-by="sortBy"
            :headers="headers"
            no-data-text="No users found"
            :query-getter="queryGetter"
            @click:row="(item) => navigateTo(`/user/${item[User.fields.customUrl] || item[User.fields.steamId]}`)"
          >
            <template #[`item.rank`]="{ index }">
              <span class="text-h6 font-weight-black">
                {{ `${(((table?.[0]?.currentPage ?? 1) - 1) * (table?.[0]?.itemsPerPage ?? 10)) + index + 3}.` }}
              </span>
            </template>
            <template #[`item.${User.statistics.fields.userId}`]="{ item }">
              <rich-profile-link
                :key="item[User.statistics.fields.userId] "
                hide-reputation
                :user-id="item[User.statistics.fields.userId]"
              />
            </template>
          </table-data>
        </v-container>
      </v-window-item>
    </v-window>
  </s-page-content>
</template>
