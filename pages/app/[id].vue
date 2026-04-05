<script setup>
  import AppCollections from '~/components/App/AppCollections.vue';
  import AppRelatedApps from '~/components/App/AppRelatedApps.vue';
  import AppTrades from '~/components/App/AppTrades.vue';

  import { formatDate, formatNumber, slugify } from '~/assets/js/format';

  const { App, Collection } = useORM();
  const { user: authUser, isLoggedIn, updateUserCollections } = useAuthStore();
  const { inLibrary, inWishlist, inBlacklist, inTradelist } = storeToRefs(useCollectionsStore());
  const route = useRoute();
  const appid = route.params.id;

  const { data: app, status, error } = useSupabaseData('app', { id: appid });

  watch(() => error.value, error => {
    if (error) {
      throw error;
    }
  }, { immediate: true });

  const { data: totalUsers } = useSupabaseData('total-users');

  const snackbarStore = useSnackbarStore();
  const addToCollections = async collections => {
    try {
      await Promise.all(collections.map(collection => {
        const instance = new Collection(collection);
        return instance.addApps([appid], Collection.enums.source.user, true);
      }));
      snackbarStore.set('success', 'Added to collections');
    } catch (error) {
      console.error(error);
      snackbarStore.set('error', error.message);
    }
  };

  const isReleased = computed(() => app.value?.releasedAt && new Date(app.value.releasedAt).getTime?.() < Date.now());
  const updateEligable = computed(() => app.value?.updatedAt && new Date(app.value.updatedAt).getTime?.() < Date.now() - 1000 * 60 * 60 * 24); // if the app was last updated more than 24 hours ago
  const requestUpdate = async () => {
    if (!updateEligable.value) {
      snackbarStore.set('error', 'App has already been updated in the last 24 hours, please try again later');
      return;
    }

    try {
      const instance = new App(appid);
      await instance.queueUpdate();
      snackbarStore.set('success', 'Requested update');
    } catch (error) {
      console.error(error);
      snackbarStore.set('error', 'Unable to request update at this time');
    }
  };

  const socials = computed(() => [
    ...app.value?.website ? [{
      text: 'View homepage',
      icon: 'mdi-home',
      href: app.value.website
    }] : [],
    {
      text: 'View on Steam',
      icon: 'mdi-steam',
      href: `https://store.steampowered.com/app/${appid}`
    },
    {
      text: 'View on SteamDB',
      icon: 'icon-steamdb',
      href: `https://steamdb.info/app/${appid}`
    },
    {
      text: 'View on GG.Deals',
      icon: 'icon-ggdeals',
      href: `https://gg.deals/steam/app/${appid}`
    },
    {
      text: 'View on Barter.vg',
      icon: 'mdi-swap-horizontal',
      href: `https://barter.vg/steam/app/${appid}`
    }
  ]);

  const tabs = [
    { name: 'Trades', icon: 'mdi-swap-horizontal', component: AppTrades },
    { name: 'Related Apps', icon: 'mdi-controller', component: AppRelatedApps },
    { name: 'Collections', icon: 'mdi-apps', component: AppCollections }
  ];
  const activeTab = ref(tabs[0].name);

  const decodeHtml = (html) => {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  };

  const supabase = useSupabaseClient();
  const removeFromMasterCollection = async (type) => {
    try {
      const instance = await Collection.getMasterCollection(supabase, authUser.id, type);
      await instance.removeApps([appid]);
      await updateUserCollections();
      snackbarStore.set('success', `Removed from your ${type}`);
    } catch (error) {
      console.error(error);
      snackbarStore.set('error', error.message);
    }
  };

  const { public: { siteName } } = useRuntimeConfig();
  const title = computed(() => app.value?.title ?? `Unknown App ${appid}`);
  const description = computed(() => decodeHtml(app.value?.description || `View ${title.value} on ${siteName}`));
  const image = computed(() => app?.header || `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`);
  const breadcrumbs = computed(() => [
    { title: 'Home', to: '/' },
    { title: 'Apps', to: '/apps' },
    { title: title.value, disabled: true }
  ]);

  useSeoMeta({
    title,
    ogTitle: title,
    description,
    ogDescription: description,
    ogImage: image
  });
</script>

<template>
  <s-page-content
    :breadcrumbs="breadcrumbs"
    :loading="status !== 'success'"
  >
    <template #append>
      <v-btn
        v-if="inLibrary(appid)"
        v-tooltip:top="'Remove from your library'"
        class="ml-2 bg-surface rounded"
        color="success"
        :icon="$vuetify.display.xs"
        :rounded="$vuetify.display.xs"
        variant="tonal"
        @click="removeFromMasterCollection(Collection.enums.type.library)"
      >
        <v-icon
          class="mr-0 mr-sm-2"
          :icon="$vuetify.display.xs ? Collection.icons.library : 'mdi-minus'"
        />
        <span class="d-none d-sm-block">
          Library
        </span>
      </v-btn>

      <v-btn
        v-if="inWishlist(appid)"
        v-tooltip:top="'Remove from your wishlist'"
        class="ml-2 bg-surface rounded"
        color="error"
        :icon="$vuetify.display.xs"
        :rounded="$vuetify.display.xs"
        variant="tonal"
        @click="removeFromMasterCollection(Collection.enums.type.wishlist)"
      >
        <v-icon
          class="mr-0 mr-sm-2"
          :icon="$vuetify.display.xs ? Collection.icons.wishlist : 'mdi-minus'"
        />
        <span class="d-none d-sm-block">
          Wishlist
        </span>
      </v-btn>

      <v-btn
        v-if="inBlacklist(appid)"
        v-tooltip:top="'Remove from your blacklist'"
        class="ml-2 bg-surface rounded"
        color="disabled"
        :icon="$vuetify.display.xs"
        :rounded="$vuetify.display.xs"
        variant="tonal"
        @click="removeFromMasterCollection(Collection.enums.type.blacklist)"
      >
        <v-icon
          class="mr-0 mr-sm-2"
          :icon="$vuetify.display.xs ? Collection.icons.blacklist : 'mdi-minus'"
        />
        <span class="d-none d-sm-block">
          Blacklist
        </span>
      </v-btn>

      <v-btn
        v-if="inTradelist(appid)"
        v-tooltip:top="'Remove from your tradelist'"
        class="ml-2 bg-surface rounded"
        color="info"
        :icon="$vuetify.display.xs"
        :rounded="$vuetify.display.xs"
        variant="tonal"
        @click="removeFromMasterCollection(Collection.enums.type.tradelist)"
      >
        <v-icon
          class="mr-0 mr-sm-2"
          :icon="$vuetify.display.xs ? Collection.icons.tradelist : 'mdi-minus'"
        />
        <span class="d-none d-sm-block">
          Tradelist
        </span>
      </v-btn>

      <dialog-select-collection
        v-if="isLoggedIn"
        multiple
        select-text="Add to collections"
        :table-props="{ onlyUsers: [authUser.id] }"
        @select="addToCollections"
      >
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            class="ml-2 bg-surface rounded"
            :icon="$vuetify.display.xs"
            :rounded="$vuetify.display.xs"
            variant="flat"
          >
            <v-icon
              class="mr-0 mr-sm-2"
              :icon="$vuetify.display.xs ? 'mdi-apps' : 'mdi-plus'"
            />
            <span class="d-none d-sm-block">
              Collection
            </span>
          </v-btn>
        </template>
      </dialog-select-collection>
    </template>

    <v-row class="flex-grow-1">
      <v-col
        class="d-flex flex-column flex-grow-1"
        cols="12"
        lg="7"
        order="2"
        order-lg="1"
      >
        <v-row
          v-if="app.videos?.length || app.screenshots?.length"
          class="flex-grow-0 mb-6"
          no-gutters
        >
          <v-col>
            <s-carousel
              :media="[...(app.videos || []), ...(app.screenshots || [])]"
              rounded
            />
          </v-col>
        </v-row>

        <v-row
          class="d-flex flex-grow-1"
          no-gutters
        >
          <v-col class="d-flex flex-column fill-height">
            <v-card class="d-flex flex-column flex-grow-1">
              <v-tabs v-model="activeTab">
                <template
                  v-for="(tab, i) in tabs"
                  :key="tab.name"
                >
                  <v-tab :width="`${(100 / tabs.length).toFixed(1)}%`">
                    <v-icon
                      class="mr-1"
                      :icon="tab.icon"
                    />
                    {{ tab.name }}
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
                  v-for="tab in tabs"
                  :key="tab.name"
                  class="h-100"
                  :value="tab.name"
                >
                  <component
                    :is="tab.component"
                    :app="app"
                    :appid="appid"
                  />
                </v-window-item>
              </v-window>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
      <v-col
        cols="12"
        lg="5"
        order="1"
        order-lg="2"
      >
        <v-row>
          <v-col>
            <v-card>
              <v-btn-group
                class="w-100"
                divided
              >
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
              <v-img
                :aspect-ratio="460 / 215"
                lazy-src="/applogo.svg"
                :src="app?.header || `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`"
              />
            </v-card>
          </v-col>
        </v-row>

        <v-row style="min-height: 100px;">
          <v-col cols="8">
            <v-card class="d-flex flex-column fill-height text-center justify-center position-relative overflow-hidden">
              <v-icon
                class="position-absolute opacity-10"
                icon="mdi-steam"
                size="80"
                style="left: 25%; transform: translate(-50%, -50%); top: 50%; pointer-events: none;"
              />
              <v-icon
                class="position-absolute opacity-10"
                icon="mdi-shopping"
                size="75"
                style="right: 25%; transform: translate(50%, -50%); top: 50%; pointer-events: none;"
              />
              <v-row no-gutters>
                <!-- Steam Store Price Block (Left Side) -->
                <v-col
                  v-tooltip:top="'The price on Steam'"
                  cols="6"
                >
                  <a
                    v-ripple
                    class="d-flex flex-column align-center justify-center text-decoration-none h-100 w-100 cursor-pointer"
                    :href="app.free ? `steam://rungameid/${appid}` : `https://store.steampowered.com/app/${appid}`"
                    rel="noopener"
                    style="line-height: 1"
                    :target="app.free ? '_self' : '_blank'"
                  >
                    <h1
                      v-if="app.free"
                      class="text-success"
                    >
                      Free
                    </h1>
                    <span
                      v-if="app.free"
                      class="text-caption text-disabled"
                    >
                      Launch on Steam
                    </span>
                    <span
                      v-if="app.retailPrice && app.discountedPrice !== app.retailPrice"
                      class="text-caption"
                    >
                      <span class="text-decoration-line-through text-disabled">
                        ${{ app.retailPrice }}
                      </span>
                      <span class="text-disabled"> (</span>
                      <span class="text-primary">{{ formatNumber(100 * (app.retailPrice - app.discountedPrice) / app.retailPrice, 0) }}%</span>
                      <span class="text-disabled"> off)</span>
                    </span>
                    <h1
                      v-if="!isNaN(parseFloat(app.discountedPrice))"
                      class="text-yellow"
                    >
                      ${{ formatNumber(app.discountedPrice, 2, 2) }}
                    </h1>
                    <h2
                      v-else-if="!app.free"
                      class="text-primary font-weight-thin text-no-wrap d-flex align-center justify-center"
                    >
                      ¯\_(ツ)_/¯
                    </h2>
                  </a>
                </v-col>

                <v-divider
                  style="position: absolute; left: 50%; height: 100%;"
                  vertical
                />

                <!-- GG.Deals Market Price Block (Right Side) -->
                <v-col
                  v-tooltip:top="'Market price (GG.Deals)'"
                  cols="6"
                >
                  <a
                    v-ripple
                    class="d-flex flex-column align-center justify-center text-decoration-none h-100 w-100 cursor-pointer"
                    :href="`https://gg.deals/steam/app/${appid}`"
                    rel="noopener"
                    style="line-height: 1"
                    target="_blank"
                  >
                    <h1
                      v-if="!isNaN(parseFloat(app.marketPrice))"
                      class="text-yellow"
                    >
                      ${{ formatNumber(app.marketPrice, 2, 2) }}
                    </h1>
                    <h2
                      v-else
                      class="text-primary font-weight-thin text-no-wrap d-flex align-center justify-center"
                    >
                      ¯\_(ツ)_/¯
                    </h2>
                    <span
                      v-if="!isNaN(parseFloat(app.historicalLow))"
                      class="text-caption"
                    >
                      <span class="text-primary">${{ formatNumber(app.historicalLow, 2, 2) }}</span> <span class="text-disabled">historical low</span>
                    </span>
                  </a>
                </v-col>
              </v-row>
            </v-card>
          </v-col>
          <v-col
            v-tooltip:top="'Steam reviews'"
            cols="4"
          >
            <v-card
              v-ripple
              class="d-flex flex-column fill-height text-center justify-center pa-4 text-body-2 position-relative overflow-hidden"
              style="line-height: 1"
            >
              <v-icon
                class="position-absolute opacity-10"
                icon="mdi-star"
                size="80"
                style="left: 50%; transform: translate(-50%, -50%); top: 50%;"
              />
              <a
                class="text-decoration-none position-relative"
                :href="`https://steamcommunity.com/app/${appid}/reviews`"
                rel="noopener"
                target="_blank"
              >
                <h1
                  v-if="app.positiveReviews + app.negativeReviews"
                  :class="`${(app.positiveReviews / (app.positiveReviews + app.negativeReviews)) > 0.5 ? 'text-success' : 'text-error'} text-no-wrap`"
                >
                  {{ formatNumber(100 * app.positiveReviews / (app.positiveReviews + app.negativeReviews)) }}%
                </h1>
                <h2
                  v-else
                  class="text-primary font-weight-thin text-no-wrap d-flex align-center justify-center"
                >
                  ¯\_(ツ)_/¯
                </h2>
                <span
                  v-if="app.positiveReviews + app.negativeReviews"
                  class="text-caption text-primary"
                >
                  {{ formatNumber(app.positiveReviews + app.negativeReviews) }} <span class="text-disabled">reviews</span>
                </span>
              </a>
            </v-card>
          </v-col>
        </v-row>

        <v-row
          v-if="isReleased || true"
          class="flex-grow-0 mt-6 mb-3"
        >
          <v-hover open-delay="500">
            <template #default="{ isHovering, props }">
              <v-col
                v-bind="props"
                :class="{ 'steamdb-widget': true, 'expanded': isHovering, 'light': $vuetify.theme.name === 'light' }"
              >
                <iframe
                  loading="lazy"
                  :src="`https://steamdb.info/embed/?appid=${appid}`"
                />
              </v-col>
            </template>
          </v-hover>
        </v-row>

        <v-row>
          <v-col>
            <v-card>
              <v-card-text>
                <v-alert
                  v-if="inLibrary(appid)"
                  border="start"
                  class="mb-2"
                  color="success"
                  icon="mdi-information"
                  variant="tonal"
                >
                  You have this app in your library
                </v-alert>
                <v-alert
                  v-if="inWishlist(appid)"
                  border="start"
                  class="mb-2"
                  color="error"
                  icon="mdi-information"
                  variant="tonal"
                >
                  You have this app on your wishlist
                </v-alert>
                <v-alert
                  v-if="inBlacklist(appid)"
                  border="start"
                  class="mb-2"
                  color="disabled"
                  icon="mdi-information"
                  variant="tonal"
                >
                  You have this app on your blacklist
                </v-alert>
                <v-alert
                  v-if="inTradelist(appid)"
                  border="start"
                  class="mb-2"
                  color="info"
                  icon="mdi-information"
                  variant="tonal"
                >
                  You have this app on your tradelist
                </v-alert>

                <span v-if="app.description">
                  {{ decodeHtml(app.description) }}
                </span>

                <v-chip-group class="chips">
                  <v-chip
                    v-for="tag in app.tags"
                    :key="tag"
                    class="text-capitalize"
                    label
                    size="small"
                    :to="`/collection/tag-${slugify(tag)}`"
                  >
                    {{ tag }}
                  </v-chip>
                </v-chip-group>

                <v-table class="mt-2">
                  <tbody>
                    <tr v-if="app.id">
                      <td class="text-overline text-no-wrap">
                        {{ App.labels.id }}
                      </td>
                      <td>
                        {{ app.id }}
                      </td>
                    </tr>
                    <tr v-if="app.type">
                      <td class="text-overline text-no-wrap">
                        {{ App.labels.type }}
                      </td>
                      <td>
                        <nuxt-link
                          class="text-decoration-none text-capitalize text-primary"
                          :to="`/collection/type-${slugify(app.type)}`"
                        >
                          {{ App.labels[Object.entries(App.enums.type).find(([,value]) => value === app.type)?.[0]] }}
                        </nuxt-link>
                      </td>
                    </tr>
                    <tr v-if="app.releasedAt">
                      <td class="text-overline text-no-wrap">
                        {{ App.labels.releasedAt }}
                      </td>
                      <td>
                        {{ formatDate(app.releasedAt, false) }}
                      </td>
                    </tr>
                    <tr v-if="app.developers?.length">
                      <td class="text-overline text-no-wrap">
                        {{ app.developers.length === 1 ? App.labels.developer : App.labels.developers }}
                      </td>
                      <td>
                        <v-chip-group class="chips">
                          <v-chip
                            v-for="developer in app.developers"
                            :key="developer"
                            class="text-capitalize"
                            label
                            size="small"
                            :to="`/collection/developer-${slugify(developer)}`"
                          >
                            {{ developer }}
                          </v-chip>
                        </v-chip-group>
                      </td>
                    </tr>
                    <tr v-if="app.publishers?.length">
                      <td class="text-overline text-no-wrap">
                        {{ app.publishers.length === 1 ? App.labels.publisher : App.labels.publishers }}
                      </td>
                      <td>
                        <v-chip-group class="chips">
                          <v-chip
                            v-for="publisher in app.publishers"
                            :key="publisher"
                            class="text-capitalize"
                            label
                            size="small"
                            :to="`/collection/publisher-${slugify(publisher)}`"
                          >
                            {{ publisher }}
                          </v-chip>
                        </v-chip-group>
                      </td>
                    </tr>
                    <tr v-if="app.languages?.length">
                      <td class="text-overline text-no-wrap">
                        {{ app.languages.length === 1 ? App.labels.language : App.labels.languages }}
                      </td>
                      <td>
                        <v-chip-group class="chips">
                          <v-chip
                            v-for="language in app.languages"
                            :key="language"
                            class="text-capitalize"
                            label
                            size="small"
                            :to="`/collection/language-${slugify(language)}`"
                          >
                            {{ language }}
                          </v-chip>
                        </v-chip-group>
                      </td>
                    </tr>
                    <tr
                      class="cursor-pointer"
                      @click="activeTab = 'Collections'"
                    >
                      <td class="text-overline text-no-wrap">
                        In Library
                      </td>
                      <td>
                        {{ formatNumber(app.libraries || 0) }}
                        <span class="text-disabled">
                          ({{ formatNumber(100 * (app.libraries || 0) / totalUsers) }}%)
                        </span>
                      </td>
                    </tr>
                    <tr
                      class="cursor-pointer"
                      @click="activeTab = 'Collections'"
                    >
                      <td class="text-overline text-no-wrap">
                        On Wishlist
                      </td>
                      <td>
                        {{ formatNumber(app.wishlists || 0) }}
                        <span class="text-disabled">
                          ({{ formatNumber(100 * (app.wishlists || 0) / totalUsers) }}%)
                        </span>
                      </td>
                    </tr>
                    <tr
                      class="cursor-pointer"
                      @click="activeTab = 'Collections'"
                    >
                      <td class="text-overline text-no-wrap">
                        For Trade
                      </td>
                      <td>
                        {{ formatNumber(app.tradelists || 0) }}
                        <span class="text-disabled">
                          ({{ formatNumber(100 * (app.tradelists || 0) / totalUsers) }}%)
                        </span>
                      </td>
                    </tr>
                    <!-- <tr
                      class="cursor-pointer"
                      @click="activeTab = 'Collections'"
                    >
                      <td class="text-overline text-no-wrap">
                        On Blacklist
                      </td>
                      <td>
                        {{ formatNumber(app.blacklists || 0) }}
                        <span class="text-disabled">
                          ({{ formatNumber(100 * (app.blacklists || 0) / totalUsers) }}%)
                        </span>
                      </td>
                    </tr> -->
                    <tr
                      class="cursor-pointer"
                      @click="activeTab = 'Collections'"
                    >
                      <td class="text-overline text-no-wrap">
                        Bundles
                      </td>
                      <td>
                        {{ formatNumber(app.bundles || 0) }}
                      </td>
                    </tr>
                    <tr
                      class="cursor-pointer"
                      @click="activeTab = 'Collections'"
                    >
                      <td class="text-overline text-no-wrap">
                        Given Away
                      </td>
                      <td>
                        {{ formatNumber(app.giveaways || 0) }}
                      </td>
                    </tr>
                    <!-- <tr
                      class="cursor-pointer"
                      @click="activeTab = 'Collections'"
                    >
                      <td class="text-overline text-no-wrap">
                        {{ App.labels.steamPackages }}
                      </td>
                      <td>
                        {{ formatNumber(app.steamPackages || 0) }}
                      </td>
                    </tr>
                    <tr
                      class="cursor-pointer"
                      @click="activeTab = 'Collections'"
                    >
                      <td class="text-overline text-no-wrap">
                        {{ App.labels.steamBundles }}
                      </td>
                      <td class="text-overline text-no-wrap">
                        {{ formatNumber(app.steamBundles || 0) }}
                      </td>
                    </tr> -->
                    <tr v-if="!isNaN(parseFloat(app.achievements))">
                      <td class="text-overline text-no-wrap">
                        {{ App.labels.achievements }}
                      </td>
                      <td>
                        <a
                          class="text-decoration-none"
                          :href="`https://steamcommunity.com/my/stats/${appid}?tab=achievements`"
                          rel="noopener"
                          target="_blank"
                        >
                          {{ formatNumber(app.achievements) }}
                        </a>
                      </td>
                    </tr>
                    <tr v-if="!isNaN(parseFloat(app.cards))">
                      <td class="text-overline text-no-wrap">
                        {{ App.labels.cards }}
                      </td>
                      <td>
                        <a
                          class="text-decoration-none"
                          :href="`https://steamcommunity.com/my/gamecards/${appid}`"
                          rel="noopener"
                          target="_blank"
                        >
                          {{ formatNumber(app.cards) }}
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td class="text-overline text-no-wrap">
                        {{ App.labels.steamdb }}
                        {{ App.labels.steamdeck }}
                      </td>
                      <td class="d-flex align-center">
                        <dialog-steamdeck-compatibility
                          :appid="Number(appid)"
                          hydrate-on-demand
                        >
                          <template #activator="attrs">
                            <div
                              v-bind="attrs.props"
                              class="cursor-pointer flex-grow-1 text-no-wrap"
                            >
                              <v-icon
                                v-if="!app.steamdeck"
                                color="disabled"
                                icon="mdi-help-circle-outline"
                              />
                              <v-icon
                                v-else-if="app.steamdeck === 'Verified'"
                                color="success"
                                icon="mdi-check-circle"
                              />
                              <v-icon
                                v-else-if="app.steamdeck === 'Unsupported'"
                                icon="mdi-cancel"
                              />
                              <v-icon
                                v-else-if="app.steamdeck === 'Playable'"
                                color="warning"
                                icon="mdi-information"
                              />
                              {{ app.steamdeck || 'Unknown' }}
                            </div>
                          </template>
                        </dialog-steamdeck-compatibility>
                      </td>
                    </tr>
                    <tr v-if="app.exfgls !== null">
                      <td class="text-overline text-no-wrap">
                        {{ App.labels.exfgls }}
                      </td>
                      <td>
                        <v-icon
                          :color="app.exfgls ? 'error' : 'success'"
                          :icon="app.exfgls ? 'mdi-close' : 'mdi-check'"
                        />
                      </td>
                    </tr>
                    <tr v-if="app.removedAs">
                      <td class="text-overline text-no-wrap">
                        {{ App.labels.removedAs }}
                      </td>
                      <td>
                        <a
                          class="text-decoration-none"
                          :href="`https://steam-tracker.com/app/${appid}`"
                          rel="noopener"
                          target="_blank"
                        >
                          {{ app.removedAs }}
                        </a>
                      </td>
                    </tr>
                    <tr v-if="app.removedAt">
                      <td class="text-overline text-no-wrap">
                        {{ App.labels.removedAt }}
                      </td>
                      <td>
                        {{ formatDate(app.removedAt, false) }}
                      </td>
                    </tr>
                  </tbody>
                </v-table>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>

    <v-footer class="mt-6 text-caption flex-grow-0">
      <v-spacer />
      Last updated: {{ formatDate(app.updatedAt) }}
      <v-btn
        v-if="isLoggedIn"
        v-tooltip:top="'Request to queue app for update'"
        class="ml-2"
        density="compact"
        icon="mdi-refresh"
        variant="text"
        @click="requestUpdate"
      />
    </v-footer>
  </s-page-content>
</template>

<style lang="scss" scoped>
  .steamdb-widget {
    border-radius: 6px;
    border: none;
    height: 90px;
    overflow: hidden;
    position: relative;
    transition: height 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    zoom: 0.8;

    &.expanded {
      height: 310px;
    }

    &.light {
      iframe {
        filter: grayscale(100%) invert(1) contrast(1.5);
      }
    }

    iframe {
      border-radius: 6px;
      border: none;
      filter: grayscale(100%) brightness(1.3);
      height: 390px;
      overflow: hidden;
      position: relative;
      top: -88px;
      width: 100%;
    }
  }

  .chips {
    ::v-deep(.v-slide-group__container) {
      width: 0;
    }

    ::v-deep(.v-slide-group__prev--disabled),
    ::v-deep(.v-slide-group__next--disabled) {
      display: none;
    }

    ::v-deep(.v-slide-group__prev),
    ::v-deep(.v-slide-group__next) {
      min-width: 0;
      flex: 0;
      padding: 0 16px;
    }
  }
</style>
