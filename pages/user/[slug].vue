<script setup>
  import { formatNumber } from '~/assets/js/format';
  import { isSteamID64, isUrl } from '~/assets/js/validate';

  const route = useRoute();
  const router = useRouter();
  const supabase = useSupabaseClient();
  const { slug } = route.params;
  const { User, Review } = useORM();
  const { user: authUser, isLoggedIn } = useAuthStore();
  const { payload } = useNuxtApp();

  // I need the user ID before I can do anything else
  let user = {};
  const userError = ref(null);
  try {
    if (isSteamID64(slug)) {
      const users = await User.query(supabase, [
        { filter: 'eq', params: [User.fields.steamId, slug] }
      ]);

      if (!users.length) {
        throw new Error('User not found');
      }

      user = users[0];

      if (user.customUrl) {
        // avoid navigateTo to prevent refetching user data
        router.replace({ path: `/user/${user.customUrl}` }, { shallow: true });
      }
    } else {
      const users = await User.query(supabase, [
        { filter: 'eq', params: [User.fields.customUrl, slug] }
      ]);

      if (!users.length) {
        throw new Error('User not found');
      }

      user = users[0];
    }

    payload.data[`user-${user.id}`] = user.toObject();
  } catch (error) {
    userError.value = error;
  }

  const isMe = computed(() => authUser?.id === user.id);

  const { data: stats, /* status: statsStatus, */ error: statsError } = useLazyAsyncData(`user-stats-${user.id}`, () => {
    return user.getStatistics();
  });

  const { data: tradesCommon, status: tradesStatus, error: tradesError } = useLazyAsyncData(`user-trades-with-${user.id}`, () => {
    if (!isLoggedIn || isMe.value) {
      return null;
    }
    return user.getTotalTradesWithUser(authUser.id);
  }, {
    getCachedData: (key, nuxtApp) => {
      return nuxtApp.payload.data[key] || nuxtApp.static.data[key];
    }
  });

  const isLoading = computed(() => {
    return /* statsStatus.value === 'pending' || */ tradesStatus.value === 'pending';
  });

  const hasError = computed(() => {
    return userError.value || statsError.value || tradesError.value;
  });

  watch(() => hasError.value, error => {
    if (error) {
      console.error(error);
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found',
        message: 'The user you are looking for does not exist',
        fatal: true
      });
    }
  }, { immediate: true });

  const background = computed(() => {
    if (!user.background) {
      return 'none';
    }

    if (isUrl(user.background)) {
      return `no-repeat center/cover url(${user.background}) fixed`;
    }

    return 'none';
  });

  const socials = computed(() => user?.steamId
    ? [
      {
        text: 'View on Steam',
        icon: 'mdi-steam',
        href: `https://steamcommunity.com/profiles/${user.steamId}`
      },
      {
        text: 'View on Rep.TF',
        icon: 'mdi-checkbox-marked',
        href: `https://rep.tf/${user.steamId}`
      },
      {
        text: 'View on Barter.vg',
        icon: 'mdi-swap-horizontal',
        href: `https://barter.vg/steam/${user.steamId}`
      },
      {
        text: 'View on SteamTrades',
        icon: 'mdi-gamepad-circle',
        href: `https://www.steamtrades.com/user/${user.steamId}`
      },
      {
        text: 'View on SteamDB',
        icon: 'icon-steamdb',
        href: `https://steamdb.info/calculator/${user.steamId}`
      }
    ]
    : []);

  const tabs = ['Stats', 'Collections', 'Trades', 'Reviews'];
  const activeTab = ref('Stats');
  const tabIcons = {
    Stats: 'mdi-chart-bar',
    Collections: 'mdi-apps',
    Trades: 'mdi-swap-horizontal',
    Reviews: 'mdi-star'
  };

  const totals = computed(() => ({
    Collections: stats.value?.totalCollections ?? null,
    Trades: stats.value?.totalPendingTrades
      + stats.value?.totalCompletedTrades
      + stats.value?.totalDeclinedTrades
      + stats.value?.totalAcceptedTrades
      + stats.value?.totalAbortedTrades,
    Reviews: stats.value?.totalReviewsReceived ?? 0
  }));

  const dialog = ref(false);

  const impersonate = (steamId) => {
    return User.login(supabase, null, steamId);
  };

  const title = computed(() => user?.displayName || slug || 'Unknown user');
  const breadcrumbs = computed(() => [
    {
      title: 'Home',
      to: '/'
    },
    {
      title: 'Users',
      to: '/users'
    },
    {
      title: title.value,
      disabled: true
    }
  ]);

  useHead({ title });
</script>

<template>
  <div
    class="fill-height"
    :style="{ background }"
  >
    <s-page-content
      :breadcrumbs="breadcrumbs"
      :loading="isLoading"
    >
      <template #append>
        <!-- TODO: Implement user roles -->
        <v-btn
          v-if="authUser?.steamId === '76561198042965266'"
          class="ml-2 bg-surface rounded"
          :icon="$vuetify.display.xs"
          :rounded="$vuetify.display.xs"
          variant="flat"
          @click="impersonate(user.steamId)"
        >
          <v-icon
            class="mr-0 mr-sm-2"
            icon="mdi-account-switch"
          />
          <span class="d-none d-sm-block">
            Impersonate
          </span>
        </v-btn>
        <dialog-user-review
          v-if="tradesCommon.total"
          :user-id="user.id"
          @submit="activeTab = 'Reviews'"
        >
          <template #activator="attrs">
            <v-btn
              v-bind="attrs.props"
              class="ml-2 bg-surface rounded"
              :icon="$vuetify.display.xs"
              :rounded="$vuetify.display.xs"
              variant="flat"
            >
              <v-icon
                class="mr-0 mr-sm-2"
                icon="mdi-star"
              />
              <span class="d-none d-sm-block">
                Review
              </span>
            </v-btn>
          </template>
        </dialog-user-review>
        <v-btn
          v-if="isLoggedIn && !isMe"
          class="ml-2 bg-surface rounded"
          :icon="$vuetify.display.xs"
          :rounded="$vuetify.display.xs"
          :to="`/trade/new?partner=${user.id}`"
          variant="flat"
        >
          <v-icon
            class="mr-0 mr-sm-2"
            icon="mdi-plus"
          />
          <span class="d-none d-sm-block">
            New trade
          </span>
        </v-btn>

        <v-btn
          v-else-if="isLoggedIn && isMe"
          class="ml-2 bg-surface rounded"
          :icon="$vuetify.display.xs"
          :rounded="$vuetify.display.xs"
          to="/settings"
          variant="flat"
        >
          <v-icon
            class="mr-0 mr-sm-2"
            icon="mdi-pencil"
          />
          <span class="d-none d-sm-block">
            Edit
          </span>
        </v-btn>
      </template>

      <v-row>
        <v-col
          cols="12"
          md="3"
        >
          <v-card class="fill-height d-flex flex-column align-stretch">
            <v-btn-group divided>
              <v-btn
                v-for="social in socials"
                :key="social.text"
                v-tooltip:top="social.text"
                :href="social.href"
                :icon="social.icon"
                rel="noopener"
                target="_blank"
                :width="`${100 / socials.length}%`"
              />
            </v-btn-group>

            <v-dialog
              v-model="dialog"
              max-width="500"
            >
              <rich-image
                v-if="user?.avatar"
                alt="Avatar"
                :image="user.avatar"
              />
            </v-dialog>

            <v-avatar
              class="w-100 flex-grow-1"
              color="secondary"
              style="min-height: 50vw"
              :style="{ minHeight: $vuetify.display.mdAndUp ? undefined : '60vw' }"
              tile
            >
              <rich-image
                v-if="user?.avatar"
                v-ripple
                alt="Avatar"
                class="cursor-pointer"
                :image="user.avatar"
                @click="dialog = true"
              />
              <v-icon
                v-else
                icon="mdi-account"
                size="200"
              />
            </v-avatar>

            <v-btn-group
              class="ma-2"
              density="compact"
              divided
            >
              <v-btn
                v-tooltip:top="`${stats?.totalCompletedTrades ?? 0} completed ${stats?.totalCompletedTrades === 1 ? 'trade' : 'trades'}`"
                class="w-50 font-weight-bold text-h6"
                color="success"
                @click="activeTab = 'Trades'"
              >
                <v-icon
                  class="mr-1"
                  icon="mdi-thumb-up"
                  size="20"
                />
                {{ formatNumber(stats?.totalCompletedTrades ?? 0) }}
              </v-btn>
              <v-btn
                v-tooltip:top="`${stats?.totalDisputedTrades ?? 0} disputed ${stats?.totalDisputedTrades === 1 ? 'trade' : 'trades'}`"
                class="w-50 font-weight-bold text-h6"
                color="error"
                @click="activeTab = 'Trades'"
              >
                <v-icon
                  class="mr-1"
                  icon="mdi-thumb-down"
                  size="20"
                />
                {{ formatNumber(stats?.totalDisputedTrades ?? 0) }}
              </v-btn>
            </v-btn-group>

            <v-card-title>
              {{ user.displayName }}
            </v-card-title>
            <v-card-subtitle class="text-caption mt-n1">
              <v-icon
                v-if="user.region"
                class="mr-1"
                icon="mdi-map-marker"
              />
              {{ User.labels[user.region] }}
            </v-card-subtitle>

            <div>
              <v-alert
                v-if="user.bio"
                border="start"
                class="ma-2 text-caption"
                style="white-space: pre-wrap;"
              >
                {{ user.bio }}
              </v-alert>
            </div>

            <div
              v-for="metric in Review.enums.metric"
              :key="metric"
              v-ripple
              class="d-flex align-center justify-space-between mx-2 my-1 bg-secondary rounded-lg px-2 py-1 cursor-pointer"
              color="grey"
              outlined
              small
              text-color="white"
              @click="activeTab = 'Reviews'"
            >
              <div class="d-flex align-center flex-row">
                <v-icon
                  class="mr-2"
                  :icon="Review.icons[metric]"
                />
                <span class="text-caption d-block d-md-none d-lg-block">
                  {{ Review.labels[metric] }}
                </span>
              </div>

              <div class="d-flex align-center flex-row">
                <v-icon
                  class="mr-2"
                  color="yellow"
                  icon="mdi-star"
                />
                <template v-if="!isNaN(parseFloat(stats?.[`avg${metric.charAt(0).toUpperCase()}${metric.slice(1)}`]))">
                  <span class="font-weight-bold text-h6">
                    {{ (stats[`avg${metric.charAt(0).toUpperCase()}${metric.slice(1)}`]).toFixed(1) }}
                  </span>
                  <span class="font-caption text-disabled">&#x202F;/&#x202F;5&#x202F;</span>
                </template>
                <span
                  v-else
                  class="font-weight-bold text-h6"
                >
                  N/A
                </span>
              </div>
            </div>

            <div class="mb-1" />
          </v-card>
        </v-col>
        <v-col
          cols="12"
          md="9"
        >
          <v-card class="d-flex flex-column fill-height">
            <v-tabs
              v-model="activeTab"
              :direction="$vuetify.display.smAndUp ? 'horizontal' : 'vertical'"
            >
              <template
                v-for="(tab, i) in tabs"
                :key="tab"
              >
                <v-tab
                  :class="$vuetify.display.smAndUp ? 'w-25' : 'w-100'"
                  :value="tab"
                >
                  <v-icon
                    class="mr-1"
                    :icon="tabIcons[tab]"
                  />
                  {{ tab }}

                  <template
                    v-if="tab !== 'Stats'"
                    #append
                  >
                    <v-chip
                      size="small"
                      :text="`${totals[tab]}`"
                      variant="tonal"
                    />
                  </template>
                </v-tab>
                <v-divider
                  v-if="i < tabs.length - 1"
                  vertical
                />
              </template>
            </v-tabs>

            <v-divider />

            <v-window v-model="activeTab">
              <v-window-item
                class="overflow-y-scroll overflow-x-hidden fill-height"
                value="Stats"
              >
                <profile-stats
                  :stats="stats"
                  :user="user"
                />
              </v-window-item>

              <v-window-item
                class="fill-height"
                value="Collections"
              >
                <profile-collections :user-id="user.id" />
              </v-window-item>

              <v-window-item
                class="fill-height"
                value="Trades"
              >
                <profile-trades :user-id="user.id" />
              </v-window-item>

              <v-window-item
                class="fill-height"
                value="Reviews"
              >
                <profile-reviews :user-id="user.id" />
              </v-window-item>
            </v-window>
          </v-card>
        </v-col>
      </v-row>
    </s-page-content>
  </div>
</template>