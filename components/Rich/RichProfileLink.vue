<script setup>
  import { formatNumber } from '~/assets/js/format';

  const { User } = useORM();
  const { user: authUser, isLoggedIn } = useAuthStore();

  const isMe = computed(() => isLoggedIn && authUser.id === props.userId);

  const props = defineProps({
    userId: {
      type: [String, null],
      required: true
    },
    userData: {
      type: Object,
      default: null
    },
    avatarSize: {
      type: [String, Number],
      default: 30
    },
    hideAvatar: {
      type: Boolean,
      default: false
    },
    hideText: {
      type: Boolean,
      default: false
    },
    hideReputation: {
      type: Boolean,
      default: false
    },
    noLink: {
      type: Boolean,
      default: false
    }
  });

  const { data: user, status: userStatus, error: userError } = useLazyAsyncData(`user-${props.userId}`, async () => {
    if (props.userId === null) {
      const user = new User({
        displayName: 'System',
        bio: 'I\'m totally not crashing right now!'
      });
      return user.toObject();
    }

    if (props.userData) {
      return props.userData;
    }

    const user = new User(props.userId);
    await user.load();
    return user.toObject();
  }, {
    getCachedData: (key, nuxtApp) => {
      return nuxtApp.payload.data[key] || nuxtApp.static.data[key];
    }
  });

  const { data: stats, status: statsStatus, error: statsError } = useLazyAsyncData(`user-stats-${props.userId}`, () => {
    if (props.userId === null) {
      return null;
    }

    const user = new User(props.userId);
    return user.getStatistics();
  }, {
    getCachedData: (key, nuxtApp) => {
      return nuxtApp.payload.data[key] || nuxtApp.static.data[key];
    }
  });

  const { data: tradesCommon, status: tradesStatus, error: tradesError } = useLazyAsyncData(`user-trades-with-${props.userId}`, () => {
    if (!isLoggedIn || isMe.value || props.userId === null) {
      return null;
    }

    const user = new User(authUser.id);
    return user.getTotalTradesWithUser(props.userId);
  }, {
    getCachedData: (key, nuxtApp) => {
      return nuxtApp.payload.data[key] || nuxtApp.static.data[key];
    }
  });

  const isLoading = computed(() => {
    return userStatus.value === 'pending' || statsStatus.value === 'pending' || tradesStatus.value === 'pending';
  });

  const hasError = computed(() => {
    return userError.value || statsError.value || tradesError.value;
  });

  const errorMessage = computed(() => {
    return userError.value?.message || statsError.value?.message || tradesError.value?.message;
  });

  const { online } = storeToRefs(useUsersStore());
  const isOnline = computed(() => {
    return online.value?.[props.userId] || props.userId === null; // System user is always online (I hope)
  });

  const onlineBorder = computed(() => {
    return isOnline.value ? 'border: 1px solid rgb(var(--v-theme-success)); box-shadow: 0 0 3px rgb(var(--v-theme-success));' : '';
  });
</script>

<template>
  <span class="profile-link">
    <span
      v-if="hasError"
      class="text-disabled font-italic error-message"
    >
      {{ errorMessage }}
    </span>

    <span v-else-if="!user || isLoading">
      <v-avatar
        v-if="!hideAvatar"
        :class="{ 'mr-1': !hideText }"
        color="secondary"
        :size="avatarSize"
        :style="onlineBorder"
      >
        <v-skeleton-loader
          class="w-100 h-100"
          type="avatar"
        />
      </v-avatar>
      <span
        v-if="!hideText"
        :class="['d-inline-block', { 'ml-1': !hideAvatar }]"
      >
        <v-skeleton-loader
          height="16"
          style="transform: translateY(3px);"
          width="100"
        />
      </span>

      <span
        v-if="!hideReputation"
        class="d-inline-block"
      >
        <v-skeleton-loader
          v-if="!hideText"
          class="ml-1"
          height="14"
          style="transform: translateY(2px);"
          width="20"
        />
      </span>
    </span>

    <v-tooltip
      v-else
      class="profile-tooltip"
      location="top"
      open-on-click
    >
      <template #activator="attrs">
        <nuxt-link
          v-bind="attrs.props"
          class="text-no-wrap"
          :to="noLink || !user || !(user.customUrl || user.steamId) ? undefined : `/user/${user.customUrl || user.steamId}`"
        >
          <v-avatar
            v-if="!hideAvatar"
            :class="{ 'mr-1': !hideText }"
            color="secondary"
            :size="avatarSize"
            :style="onlineBorder"
          >
            <rich-image
              v-if="user?.avatar"
              :alt="user.displayName || 'User avatar'"
              contain
              :image="user.avatar"
            />
            <v-icon
              v-else
              icon="mdi-account"
            />
          </v-avatar>
          <span v-if="!hideText">
            {{ user.displayName || user.steamId || 'Unknown user' }}
          </span>

          <span
            v-if="!hideReputation"
            class="d-inline-block"
          >
            <sup
              v-if="stats?.totalCompletedTrades"
              class="text-caption text-success"
            >
              +{{ formatNumber(stats.totalCompletedTrades) }}
            </sup>
            <sub
              v-if="stats?.totalDisputedTrades"
              class="text-caption text-error font-weight-bold"
            >
              -{{ formatNumber(stats.totalDisputedTrades) }}
            </sub>
          </span>
        </nuxt-link>
      </template>

      <v-card
        elevation="8"
        max-width="500"
        width="100%"
      >
        <v-card-title class="border d-flex flex-row align-center ga-2">
          <v-avatar
            class="flex-grow-0"
            color="secondary"
            rounded="0"
            size="50"
            :style="onlineBorder"
          >
            <rich-image
              v-if="user?.avatar"
              :alt="user.displayName || 'User avatar'"
              contain
              :image="user.avatar"
            />
            <v-icon
              v-else
              :icon="user?.id ? 'mdi-account' : 'mdi-robot-happy'"
            />
          </v-avatar>
          <div class="d-flex flex-column flex-grow-1">
            <span
              class="font-weight-bold text-h6"
              :class="isOnline ? 'text-success' : ''"
            >
              {{ user.displayName || user.steamId || 'Unknown user' }}
            </span>

            <span
              v-if="user.id === authUser?.id"
              class="text-caption text-disabled"
            >
              This is you <v-icon icon="mdi-emoticon-outline" />
            </span>
            <span
              v-else-if="authUser && user.id"
              class="text-caption text-disabled"
            >
              You traded
              <span class="text-primary font-weight-bold">
                {{ formatNumber(tradesCommon) }}
              </span>
              {{ tradesCommon === 1 ? 'time' : 'times' }}
              with this user
            </span>
          </div>
        </v-card-title>
        <v-card-text class="border py-2">
          <span
            v-if="user.bio"
            style="white-space: pre-wrap;"
          >
            {{ user.bio }}
          </span>
          <span
            v-else
            class="text-disabled font-italic"
          >
            No bio provided
          </span>
        </v-card-text>
      </v-card>
    </v-tooltip>
  </span>
</template>

<style lang="scss" scoped>
  .profile-link {
    display: inline-block;

    sup, sub {
      display: none;;
      font-family: monospace;
      margin-left: .2em;
      position: relative;
      display: block;
      font-size: .4em;
      line-height: .2;
    }

    a {
      text-decoration: none;
    }

    > .loading {
      display: flex;
      align-items: center;
      justify-content: start;
      margin-left: 0.1rem;
      margin-right: 0.1rem;

      ::v-deep(> div) {
        background-color: transparent;
      }

      ::v-deep(.v-skeleton-loader__avatar) {
        transform: scale(.65);
        margin-left: -0.6rem !important;
      }

      ::v-deep(.v-skeleton-loader__bone) {
        margin: 0px;
      }
    }
  }

  .profile-tooltip {
    ::v-deep(.v-overlay__content) {
      padding: 0;
    }
  }
</style>
