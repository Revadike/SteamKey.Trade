<script setup>
  const { User, Collection } = useORM();

  const snackbarStore = useSnackbarStore();
  const { user: authUser } = useAuthStore();
  const supabase = useSupabaseClient();

  const singleUser = ref(false);
  const selectedUser = useSearchParam('user', null);

  const singleApp = ref(false);
  const selectedApp = useSearchParam('app', null);

  const matchFilterOptions = [
    { value: 'mutual', title: 'Mutual', description: 'Show results where both sides have something the other wants' },
    { value: 'partial', title: 'Partial', description: 'Show results where at least one side has something the other wants' },
    { value: 'all', title: 'Everything', description: 'Show all results, even if nobody wants anything from each other' }
  ];
  const matchFilter = ref(selectedUser.value ? 'all' : selectedApp.value ? 'partial' : 'mutual');

  const loading = ref(false);
  const matches = ref([]);
  const userPage = ref(1);
  const batchSize = 10;
  const processedUsers = ref(new Set());
  const collectionsData = ref({});

  const reset = () => {
    matches.value = [];
    userPage.value = 1;
    processedUsers.value.clear();
  };

  // When user or app is set in URL, infer single mode
  watch([selectedUser, selectedApp], ([newUser, newApp]) => {
    const isSingleUser = newUser !== null;
    if (singleUser.value !== isSingleUser) {
      singleUser.value = isSingleUser;
    }
    const isSingleApp = newApp !== null;
    if (singleApp.value !== isSingleApp) {
      singleApp.value = isSingleApp;
    }
  }, { immediate: true });
  // When user or app is set in URL, update selected values
  watch([singleUser, singleApp], ([newSingleUser, newSingleApp]) => {
    if (!newSingleUser) {
      selectedUser.value = null;
    }
    if (!newSingleApp) {
      selectedApp.value = null;
    }
  }, { immediate: true });

  const getCollectionApps = async (users) => {
    const results = {};

    for (const userId of users) {
      try {
        const userApps = await Collection.getMasterCollectionsApps(supabase, userId);
        if (userApps) {
          results[userId] = {
            tradelist: userApps.tradelist || [],
            wishlist: userApps.wishlist || []
          };
        }
      } catch (error) {
        console.error(`Error fetching collections for user ${userId}:`, error);
      }
    }

    return results;
  };

  // Get users to match against in batches
  const getUsers = async () => {
    const userIds = [];

    if (singleUser.value) {
      userIds.push(selectedUser.value);
    } else {
      // Fetch active users in batches for infinite scrolling
      const { data, error } = await supabase
        .from(User.table)
        .select(User.fields.id)
        .neq(User.fields.id, authUser.id)
        .order(User.fields.updatedAt, { ascending: false }) // most recently active first
        .order(User.fields.createdAt, { ascending: false }) // then by account creation date
        .range((userPage.value - 1) * batchSize, userPage.value * batchSize - 1);

      if (error) {
        throw error;
      }

      userIds.push(...data.map(user => user[User.fields.id]));
    }

    return userIds;
  };

  const filterMatches = (matchData) => {
    const { have, want } = matchData;
    const hasSelectedApp = selectedApp.value ? [have, want].flat().includes(Number(selectedApp.value)) : true;

    switch (matchFilter.value) {
      case 'mutual':
        return have.length > 0 && want.length > 0 && hasSelectedApp;
      case 'partial':
        return (have.length > 0 || want.length > 0) && hasSelectedApp;
      case 'all':
      default:
        return hasSelectedApp;
    }
  };

  const matchesStore = useMatchesStore();

  // Load all fresh matches from cache (for current filter)
  const loadCachedMatches = () => {
    matches.value = [];
    const userIds = Object.keys(matchesStore.users);
    userIds.forEach(userId => {
      const entry = matchesStore.getUserMatches(userId);
      if (entry && filterMatches({ have: entry.have, want: entry.want })) {
        matches.value.push({ user: userId, have: entry.have, want: entry.want });
      }
    });
  };

  onMounted(() => {
    if (selectedUser.value || selectedApp.value) {
      loadCachedMatches();
      if (matches.value.length === 0) {
        loadMatches();
      }
    }
  });

  // When filters change, reload from cache
  watch([matchFilter, selectedApp, selectedUser], () => {
    if (selectedUser.value || selectedApp.value) {
      loadCachedMatches();
    } else {
      matches.value = [];
    }
  }, { immediate: false });

  // Only fetch new users when scrolling (infinite scroll)
  const loadMoreMatches = async ({ done }) => {
    try {
      loading.value = true;

      const users = await getUsers();
      if (users.length === 0 || (singleUser.value && processedUsers.value.has(selectedUser.value))) {
        done('empty');
        return;
      }

      collectionsData.value = {
        ...collectionsData.value,
        ...(await getCollectionApps([authUser.id, ...users].filter(userId => !collectionsData.value[userId])))
      };

      const myHave = collectionsData.value[authUser.id].tradelist;
      const myWant = collectionsData.value[authUser.id].wishlist;

      let validMatchesFound = false;
      for (const userId of users) {
        if (!collectionsData.value[userId]) { continue; }

        const theirHave = collectionsData.value[userId].tradelist;
        const theirWant = collectionsData.value[userId].wishlist;

        // Find matching apps (what I have that they want)
        const have = myHave.filter(appId => theirWant.includes(appId));

        // Find matching apps (what I want that they have)
        const want = myWant.filter(appId => theirHave.includes(appId));

        // Only add match if it passes the filter
        if (filterMatches({ have, want })) {
          // Check if user already exists in matches, replace if so
          const existingIndex = matches.value.findIndex(m => m.user === userId);
          if (existingIndex === -1) {
            matches.value.push({ user: userId, have, want });
          } else {
            matches.value[existingIndex] = { user: userId, have, want };
          }
          matchesStore.setUserMatches(userId, have, want);
          validMatchesFound = true;
        }
      }

      users.forEach(userId => processedUsers.value.add(userId));
      userPage.value++;

      if (!validMatchesFound) {
        await loadMoreMatches({ done });
      }

      done('ok');
    } catch (error) {
      console.error('Error loading more matches:', error);
      snackbarStore.set('error', 'Error loading more matches');
      done('error');
    } finally {
      loading.value = false;
    }
  };

  const loadMatches = () => {
    return loadMoreMatches({ done: () => {} });
  };

  const startMatching = () => {
    reset();
    loadCachedMatches();
    if (matches.value.length === 0) {
      loadMatches();
    }
  };

  const title = 'Matches';
  const breadcrumbs = [
    { title: 'Home', to: '/' },
    { title, disabled: true }
  ];

  useSeoMeta({ title, ogTitle: title });

  definePageMeta({
    middleware: 'authenticated'
  });
</script>

<template>
  <s-page-content :breadcrumbs="breadcrumbs">
    <v-card class="d-flex flex-column flex-grow-1 pa-4">
      <!-- Filters section -->
      <v-card class="mb-4 border rounded-lg flex-grow-0 pt-4">
        <div class="d-flex flex-lg-row flex-column justify-space-between">
          <v-card
            class="h-100"
            variant="flat"
          >
            <v-card-subtitle>User Filter</v-card-subtitle>
            <v-card-text>
              <v-btn-toggle
                v-model="singleUser"
                class="border"
                color="tonal"
                mandatory
              >
                <v-btn :value="false">
                  <v-icon
                    icon="mdi-account-group"
                    start
                  />
                  All Users
                </v-btn>
                <dialog-select-user @select:user="user => selectedUser = user">
                  <template #activator="{ props: dialogProps }">
                    <v-hover>
                      <template #default="{ isHovering, props: hoverProps }">
                        <v-btn
                          v-bind="{ ...hoverProps, ...dialogProps }"
                          :value="true"
                        >
                          <v-icon
                            :icon="selectedUser ? 'mdi-account-check' : 'mdi-account'"
                            start
                          />
                          {{ isHovering ? (selectedUser ? 'Change User' : 'Select User') : 'Single User' }}
                        </v-btn>
                      </template>
                    </v-hover>
                  </template>
                </dialog-select-user>
              </v-btn-toggle>
            </v-card-text>
          </v-card>

          <!-- App selection -->
          <v-card
            class="h-100"
            variant="flat"
          >
            <v-card-subtitle>App Filter</v-card-subtitle>
            <v-card-text>
              <v-btn-toggle
                v-model="singleApp"
                class="border"
                color="tonal"
                mandatory
              >
                <v-btn :value="false">
                  <v-icon
                    icon="mdi-apps"
                    start
                  />
                  All Apps
                </v-btn>
                <dialog-select-app @select:app="app => selectedApp = app">
                  <template #activator="{ props: dialogProps }">
                    <v-hover>
                      <template #default="{ isHovering, props: hoverProps }">
                        <v-btn
                          v-bind="{ ...hoverProps, ...dialogProps }"
                          :value="true"
                        >
                          <v-icon
                            :icon="selectedApp ? 'mdi-puzzle-check' : 'mdi-puzzle'"
                            start
                          />
                          {{ isHovering ? (selectedApp ? 'Change App' : 'Select App') : 'Single App' }}
                        </v-btn>
                      </template>
                    </v-hover>
                  </template>
                </dialog-select-app>
              </v-btn-toggle>
            </v-card-text>
          </v-card>

          <!-- Match type filter -->
          <v-card
            class="h-100"
            variant="flat"
          >
            <v-card-subtitle>Match Type</v-card-subtitle>
            <v-card-text>
              <v-btn-toggle
                v-model="matchFilter"
                class="border"
                color="tonal"
                divided
                mandatory
              >
                <v-btn
                  v-for="option in matchFilterOptions"
                  :key="option.value"
                  v-tooltip:top="option.description"
                  :value="option.value"
                >
                  <v-icon
                    icon="mdi-crosshairs-gps"
                    start
                  />
                  {{ option.title }}
                </v-btn>
              </v-btn-toggle>
            </v-card-text>
          </v-card>
        </div>

        <v-btn
          block
          class="rounded-0"
          color="tonal"
          :disabled="loading || (singleUser && !selectedUser) || (singleApp && !selectedApp)"
          prepend-icon="mdi-magnify"
          size="large"
          variant="tonal"
          @click="startMatching"
        >
          {{ loading ? 'Loading...' : 'Find Matches' }}
        </v-btn>
      </v-card>

      <div
        v-if="matches.length === 0 && !loading"
        class="d-flex justify-center align-center flex-grow-1"
      >
        <div
          v-if="processedUsers.size > 0"
          class="text-disabled font-italic text-center"
        >
          <p>No matches found.</p>
          <p>Try adjusting your filters or updating your wishlist and tradelist.</p>
          <br>
          <p v-if="selectedApp">
            Consider buying it after checking the deals on
            <a
              :href="`https://gg.deals/steam/app/${selectedApp}`"
              rel="noopener"
              target="_blank"
            >GG.Deals</a>.
          </p>
        </div>
      </div>

      <div
        v-else-if="loading && matches.length === 0"
        class="d-flex justify-center align-center flex-grow-1"
      >
        <v-progress-circular
          indeterminate
          size="64"
        />
      </div>

      <v-infinite-scroll
        v-else
        empty-text=""
        margin="100"
        mode="intersect"
        @load="loadMoreMatches"
      >
        <div
          v-for="match in matches"
          :key="`match-${match.user}`"
        >
          <v-card class="border rounded-lg mb-4">
            <v-card-title class="d-flex align-center ga-2">
              Match with

              <rich-profile-link :user-id="match.user" />

              <v-spacer />

              <v-btn
                v-tooltip:top="`Click to trade with this user`"
                target="_blank"
                :to="`/trade/new?partner=${match.user}&senderapps=${match.have.join(',')}&receiverapps=${match.want.join(',')}`"
                variant="tonal"
              >
                <v-icon
                  icon="mdi-plus"
                  start
                />
                Trade
              </v-btn>
            </v-card-title>
            <v-divider />
            <v-row class="pa-2">
              <v-col
                cols="12"
                lg="6"
              >
                <span class="mb-2 d-flex align-center ga-1">
                  <v-icon icon="mdi-swap-horizontal-circle-outline" />
                  <span class="text-disabled">You have</span>
                  <strong>{{ match.have.length }}</strong>
                  <span class="text-disabled">
                    {{ match.have.length === 1 ? 'item' : 'items' }} they want
                  </span>
                </span>
                <table-apps
                  v-if="match.have.length"
                  :only-apps="match.have"
                  simple
                  style="min-height: 0;"
                />
                <v-alert
                  v-else
                  density="compact"
                  icon="mdi-information"
                  text="Nothing to offer"
                  type="info"
                  variant="tonal"
                />
              </v-col>
              <v-col
                cols="12"
                lg="6"
              >
                <span class="mb-2 d-flex align-center ga-1">
                  <v-icon icon="mdi-heart-circle-outline" />
                  <span class="text-disabled">They have</span>
                  <strong>{{ match.want.length }}</strong>
                  <span class="text-disabled">
                    {{ match.want.length === 1 ? 'item' : 'items' }} you want
                  </span>
                </span>
                <table-apps
                  v-if="match.want.length"
                  :only-apps="match.want"
                  simple
                  style="min-height: 0;"
                />
                <v-alert
                  v-else
                  density="compact"
                  icon="mdi-information"
                  text="Nothing you want"
                  type="info"
                  variant="tonal"
                />
              </v-col>
            </v-row>
          </v-card>
        </div>

        <!-- Loading indicator for infinite scroll -->
        <template #loading>
          <div class="d-flex justify-center py-4">
            <v-progress-circular indeterminate />
          </div>
        </template>
      </v-infinite-scroll>
    </v-card>
  </s-page-content>
</template>