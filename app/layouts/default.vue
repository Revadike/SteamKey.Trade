<script setup>
  import { useTheme } from 'vuetify';

  const supabase = useSupabaseClient();
  const { $vuetify: { display } } = useNuxtApp();
  const { currentRoute } = useRouter();
  const { public: { siteName } } = useRuntimeConfig();
  const { user, isLoggedIn, notificationCount } = storeToRefs(useAuthStore());

  const searchQuery = ref(currentRoute.value?.query?.query || '');

  const $search = ref(null);
  const searchIsExpanded = ref(false);
  const toggleSearch = () => {
    if (searchIsExpanded.value) {
      searchIsExpanded.value = false;
    } else {
      searchIsExpanded.value = true;
      $search.value.focus();
    }
  };

  const search = async () => {
    searchIsExpanded.value = false;
    await navigateTo({
      name: 'search',
      query: {
        q: searchQuery.value
      }
    });
    searchQuery.value = '';
  };

  watch(
    currentRoute,
    ({ query }) => {
      if (query?.q && query.q !== searchQuery.value) {
        searchQuery.value = query.q;
      }
    }
  );

  const navRailMode = ref(true);
  const menuIsActive = ref(false);
  const drawerIsOpen = computed(() => display.smAndUp.value || menuIsActive.value);

  const menu = computed(() => ([
    { title: 'Home', icon: 'mdi-home', to: '/' },
    isLoggedIn.value && { title: 'Vault', icon: 'mdi-safe', to: '/vault' },
    { title: 'Trades', icon: 'mdi-swap-horizontal', to: '/trades' },
    isLoggedIn.value && { title: 'Matches', icon: 'mdi-crosshairs', to: '/matches' },
    { title: 'Collections', icon: 'mdi-apps', to: '/collections' },
    { title: 'Apps', icon: 'mdi-controller', to: '/apps' },
    { title: 'Users', icon: 'mdi-account-group', to: '/users' },
    { title: 'Leaderboard', icon: 'mdi-podium-gold', to: '/leaderboard' }
  ]).filter(Boolean));

  const { setOnline } = usePresenceStore();
  const online = supabase.channel('online_list');
  online
    .on('presence', { event: 'sync' }, () => {
      setOnline(online.presenceState());
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && isLoggedIn.value) {
        await online.track({
          user_id: user.value.id,
          online_at: Date.now()
        });
      }
    });

  onBeforeUnmount(async () => {
    await online.untrack();
  });

  let lastTitleChunk = '';
  const getDocumentTitle = (titleChunk) => {
    lastTitleChunk = titleChunk;
    let title = siteName;
    if (titleChunk) {
      title = `${titleChunk} - ${title}`;
    }
    if (notificationCount.value) {
      title = `(${notificationCount.value}) ${title}`;
    }

    return title;
  };

  watch(() => notificationCount.value, () => {
    document.title = getDocumentTitle(lastTitleChunk);
  });

  const theme = useTheme();
  const isDark = computed(() => theme.global.current.value.dark);
  const restoreTheme = () => {
    const savedTheme = localStorage.getItem('theme') || 'system';
    theme.change(savedTheme);
  };

  const toggleTheme = () => {
    theme.change(isDark.value ? 'light' : 'dark');
    localStorage.setItem('theme', theme.global.name.value);
  };

  const showFullLogo = computed(() => {
    return !searchIsExpanded.value || !display.mdAndDown.value;
  });

  const { refreshFacets } = useAppsStore();
  const { refreshTags } = useTagsStore();
  onMounted(async () => {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'f' && (event.ctrlKey || event.metaKey) && !searchIsExpanded.value) {
        event.preventDefault();
        searchIsExpanded.value = true;
        $search.value.focus();
      }
    });

    restoreTheme();

    // Refresh stores
    refreshFacets();
    refreshTags();
  });

  useHead({
    titleTemplate: getDocumentTitle
  });
</script>

<template>
  <v-app
    :class="{ 'offset-dialogs': $vuetify.display.md }"
    :theme="isDark ? 'dark' : 'light'"
  >
    <s-snackbar />
    <dialog-connect-discord />
    <v-app-bar
      class="border"
      elevation="0"
    >
      <template #prepend>
        <v-app-bar-nav-icon
          v-if="$vuetify.display.xs"
          @click="menuIsActive = !menuIsActive"
        />
        <nuxt-link
          v-if="!$vuetify.display.xs"
          class="d-block"
          to="/"
        >
          <v-img
            v-show="showFullLogo"
            alt="SteamKey.Trade"
            class="logo"
            :src="'/logo-banner.svg'"
            width="370"
          />
          <v-img
            v-show="!showFullLogo"
            alt="SteamKey.Trade"
            class="logo"
            :src="'/logo-no-text.svg'"
            style="margin-top: -1px"
            width="48"
          />
          <v-chip
            class="logo-chip"
            color="warning"
            elevation="10"
            size="x-small"
            variant="flat"
          >
            <b>BETA</b>
          </v-chip>
        </nuxt-link>
      </template>
      <template #title>
        <div class="search-bar">
          <v-text-field
            ref="$search"
            v-model="searchQuery"
            :class="{ expanded: searchIsExpanded }"
            hide-details
            placeholder="Search for apps, users, collections..."
            rounded
            single-line
            type="search"
            variant="outlined"
            @keydown.enter="search"
            @keydown.esc="searchIsExpanded = false"
          />
          <v-btn
            :icon="searchIsExpanded ? 'mdi-close' : 'mdi-magnify'"
            @click="toggleSearch"
          />
        </div>
      </template>
      <template #append>
        <v-btn
          :icon=" isDark ? 'mdi-weather-sunny' : 'mdi-weather-night' "
          @click="toggleTheme"
        />
        <user-notifications v-if="isLoggedIn" />

        <v-btn
          v-if="!isLoggedIn"
          class="mx-4"
          title="Log in"
          to="/login"
          width="90"
        >
          <v-img
            alt="Sign in through Steam"
            cover
            src="/signinthroughsteam.png"
            width="100"
          />
        </v-btn>
        <v-menu v-else>
          <template #activator="attrs">
            <v-btn
              class="mx-2"
              icon
              v-bind="attrs.props"
            >
              <v-avatar
                color="surface-variant"
                :icon="user?.avatar ? undefined : 'mdi-account'"
                :image="user?.avatar ? user.avatar : undefined"
              />
            </v-btn>
          </template>
          <v-list>
            <v-list-item :title="`Logged in as ${user.displayName}`" />
            <v-divider />
            <v-list-item
              prepend-icon="mdi-account"
              title="Profile"
              :to="`/user/${user.customUrl || user.steamId}`"
            />
            <v-list-item
              prepend-icon="mdi-cog"
              title="Settings"
              to="/settings"
            />
            <v-list-item
              prepend-icon="mdi-logout"
              title="Log out"
              to="/logout"
            />
          </v-list>
        </v-menu>
      </template>
    </v-app-bar>
    <v-navigation-drawer
      mobile-breakpoint="sm"
      :model-value="drawerIsOpen"
      :permanent="!!$vuetify.display.smAndUp"
      :rail="$vuetify.display.sm && navRailMode"
      @update:model-value="value => menuIsActive = value"
    >
      <v-divider />
      <v-list
        :density="$vuetify.display.smAndDown ? 'compact' : 'default'"
        nav
      >
        <v-list-item
          v-for="item in menu"
          :key="item.title"
          :active="item.to === '/' ? currentRoute.fullPath === item.to : currentRoute.fullPath.startsWith(item.to)"
          :to="item.to"
          :value="item.title"
        >
          <template #prepend>
            <v-icon
              v-if="item.icon"
              :icon="item.icon"
              :size="$vuetify.display.mdAndUp ? 'x-large' : 'default'"
              start
            />
          </template>

          <template #title>
            <span class="text-button">{{ item.title }}</span>
          </template>
        </v-list-item>
      </v-list>

      <template #append>
        <v-divider />
        <v-list
          :density="$vuetify.display.smAndDown ? 'compact' : 'default'"
          nav
        >
          <v-list-item
            href="/github"
            rel="noopener"
            target="_blank"
          >
            <template #prepend>
              <v-icon
                icon="mdi-github"
                :size="$vuetify.display.mdAndUp ? 'x-large' : 'default'"
                start
              />
            </template>

            <template #title>
              <span class="text-button">GitHub</span>
            </template>
          </v-list-item>

          <v-list-item
            href="/steam"
            rel="noopener"
            target="_blank"
          >
            <template #prepend>
              <v-icon
                icon="mdi-steam"
                :size="$vuetify.display.mdAndUp ? 'x-large' : 'default'"
                start
              />
            </template>

            <template #title>
              <span class="text-button">Steam Group</span>
            </template>
          </v-list-item>

          <v-list-item
            href="/discord"
            rel="noopener"
            target="_blank"
          >
            <template #prepend>
              <v-icon
                icon="icon-discord"
                :size="$vuetify.display.mdAndUp ? 'x-large' : 'default'"
                start
              />
            </template>

            <template #title>
              <span class="text-button">Discord</span>
            </template>
          </v-list-item>
        </v-list>
        <v-divider />
        <div class="text-center text-caption w-100 pa-2">
          <nuxt-link
            class="text-decoration-none text-disabled"
            to="/terms"
          >
            {{ $vuetify.display.sm ? 'Terms' : 'Terms & Conditions' }}
          </nuxt-link>
          <v-icon
            class="mx-1"
            icon="mdi-circle-small"
          />
          <nuxt-link
            class="text-decoration-none text-disabled"
            to="/privacy"
          >
            {{ $vuetify.display.sm ? 'Privacy' : 'Privacy Policy' }}
          </nuxt-link>
        </div>
        <v-divider v-if="$vuetify.display.sm" />
        <v-list
          v-if="$vuetify.display.sm"
          density="compact"
        >
          <v-list-item
            :prepend-icon="navRailMode ? 'mdi-chevron-right' : 'mdi-chevron-left'"
            @click="navRailMode = !navRailMode"
          />
        </v-list>
      </template>
    </v-navigation-drawer>
    <v-main>
      <slot />
    </v-main>

    <div class="feature-request-sticker">
      <v-card
        class="feature-request-card"
        color="warning"
        elevation="10"
        variant="flat"
      >
        Bug or missing feature?
        <a
          class="text-surface"
          href="https://github.com/Revadike/SteamKey.Trade/issues/new/choose"
          rel="noopener"
          target="_blank"
        >
          Report here<v-icon
            class="ml-1"
            icon="mdi-open-in-new"
            size="x-small"
          />
        </a>
      </v-card>
    </div>
  </v-app>
</template>

<style lang="scss">
  .v-window {
    display: flex;
    flex-grow: 1;
    flex-direction: column;

    .v-window-item--active,
    .v-window__container {
      display: flex;
      flex-grow: 1;
    }
  }

  .v-data-table {
    zoom: 0.9;
  }
</style>

<style lang="scss" scoped>
  .feature-request-sticker {
    position: fixed;
    bottom: 90px;
    right: 0;
    z-index: 100;
    transform: translateX(calc(100% - 140px));
    transition: transform 0.3s ease;
    border: 3px solid rgb(var(--v-theme-surface));
    border-radius: 20px 0px 0px 20px;

    &:hover {
      transform: translateX(3px);
    }

    .feature-request-card {
      padding: 6px;
      font-weight: 700;
      border-radius: 20px 0px 0px 20px;
      color: rgb(var(--v-theme-surface)) !important;
      box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.2);
      font-size: 0.75rem;
    }
  }

  .search-bar {
    position: relative;
    display: flex;
    justify-content: flex-end;

    ::v-deep(.v-field) {
      height: 48px;
    }

    .v-text-field {
      backface-visibility: hidden;
      color: rgb(var(--v-theme-on-surface));
      min-width: 48px;
      opacity: 0;
      position: absolute;
      right: 0;
      top: 0;
      transition: width .3s, opacity 0s .3s;
      width: 0;

      ::v-deep(.v-field__overlay) {
        background-color: rgb(var(--v-theme-surface));
      }

      ::v-deep(input) {
        margin-top: -5px;
        margin-left: 5px;
      }

      &.expanded {
        min-width: 200px;
        opacity: 1;
        transition: width .3s, opacity .3s 0s;
        width: 100%;
      }
    }

    .v-btn {
      position: relative;
      z-index: 1;
      background: none;

      &.v-btn--variant-outlined {
        border-color: transparent;
      }
    }
  }

  .logo {
    // Weird bug with vuetify
    ::v-deep(img) {
      display: block !important;
    }
  }

  .logo-chip {
    position: absolute;
    bottom: 0;
    left: 3.5px;
    box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.2);
    border: 3px solid rgb(var(--v-theme-surface));

    ::v-deep(.v-chip__content) {
      font-weight: 700;
      color: rgb(var(--v-theme-surface));
      font-size: 0.75rem;
    }
  }
</style>
