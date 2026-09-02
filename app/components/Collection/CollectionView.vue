<script setup>
  import { formatDate, formatUrl } from '~/assets/js/format';

  const { user, isLoggedIn } = storeToRefs(useAuthStore());
  const snackbarStore = useSnackbarStore();
  const { Collection } = useORM();

  const props = defineProps({
    id: {
      type: String,
      required: true
    }
  });

  const loading = ref(false);
  const appTable = ref(null);
  const activeTab = ref('apps');

  const { data: collection, status, error } = useSupabaseData('collection', { id: props.id });
  const { data: fetchedSubcollections, error: subcollectionsError } = useSupabaseData('collection-subcollections', { id: props.id });

  const subcollections = computed(() => (fetchedSubcollections.value || []).map(sc => sc.id));

  watch(() => appTable.value?.totalItems, (total) => {
    if (total === 0 && subcollections.value.length > 0) {
      activeTab.value = 'collections';
    }
  });

  watch([
    () => error.value,
    () => subcollectionsError.value
  ], (errors) => {
    if (errors.some(e => e)) {
      console.error(...errors);
      throw errors.find(e => e);
    }
  });

  const deleteCollection = async () => {
    loading.value = true;
    try {
      const instance = new Collection(props.id);
      await instance.delete();

      snackbarStore.set('success', 'Collection deleted');
      await navigateTo('/collections');
    } catch (error) {
      snackbarStore.set('error', error.message);
    }
    loading.value = false;
  };

  const syncing = ref(false);
  const syncWithSteam = async () => {
    syncing.value = true;
    if (collection.value.type === Collection.enums.type.wishlist) {
      await useSteamSync(Collection.enums.type.wishlist).sync();
    } else if (collection.value.type === Collection.enums.type.library) {
      await useSteamSync(Collection.enums.type.library).sync();
    }

    syncing.value = false;
  };

  const { public: { siteName } } = useRuntimeConfig();
  const title = computed(() => collection.value?.title || `Collection ${props.id}`);
  const description = computed(() => collection.value?.description || `View ${Collection.labels[collection.value?.type]?.toLowerCase() || 'collection'} on ${siteName}`);
  const breadcrumbs = computed(() => [
    { title: 'Home', to: '/' },
    { title: 'Collections', to: '/collections' },
    { title: title.value, disabled: true }
  ]);

  useSeoMeta({
    title,
    ogTitle: title,
    description,
    ogDescription: description
  });
</script>

<template>
  <s-page-content
    :breadcrumbs="breadcrumbs"
    :loading="status === 'pending'"
  >
    <template
      v-if="isLoggedIn && collection && collection.userId === user.id"
      #actions
    >
      <v-btn
        v-if="collection.master && [Collection.enums.type.wishlist, Collection.enums.type.library].includes(collection.type)"
        :loading="syncing"
        variant="flat"
        @click="syncWithSteam"
      >
        <v-icon
          icon="mdi-sync"
          start
        />
        Sync
      </v-btn>

      <v-btn
        :to="`/collection/${id}/edit`"
        variant="flat"
      >
        <v-icon
          icon="mdi-pencil"
          start
        />
        Edit
      </v-btn>

      <dialog-confirm
        v-if="!collection.master"
        color="red"
        confirm-text="Delete"
        @confirm="deleteCollection"
      >
        <template #activator="attrs">
          <v-btn
            color="error"
            variant="flat"
            v-bind="attrs.props"
          >
            <v-icon
              icon="mdi-delete"
              start
            />
            Delete
          </v-btn>
        </template>
      </dialog-confirm>
    </template>

    <v-card class="d-flex flex-column fill-height pa-4">
      <div class="d-flex align-top justify-space-between">
        <div class="flex-grow-1 d-flex flex-column justify-space-between">
          <v-card-title class="text-h5 pa-0 text-wrap">
            <v-icon
              v-if="collection.master"
              v-tooltip:top="`This master collection is used to indicate whether an app belongs to your ${collection.type}`"
              class="mt-n1 mr-0"
              color="disabled"
              icon="mdi-crown"
              size="24"
            />
            <v-icon
              v-if="collection.private"
              v-tooltip:top="'Private collection'"
              class="mt-n1 mr-0"
              color="disabled"
              icon="mdi-lock"
              size="24"
            />
            {{ collection.title }}
          </v-card-title>
          <v-card-subtitle class="text-caption pa-0 mt-2">
            <v-icon
              class="mt-n1 mr-1"
              icon="mdi-account"
            />
            <rich-profile-link
              hide-avatar
              hide-reputation
              :user-id="collection.userId"
            />

            <v-icon icon="mdi-circle-small" />

            <v-icon
              class="mt-n1 mr-1"
              icon="mdi-calendar"
            />
            <rich-date :date="collection.createdAt" />
            <template v-if="collection.updatedAt && collection.updatedAt !== collection.createdAt">
              (updated <rich-date :date="collection.updatedAt" />)
            </template>

            <template v-if="collection.startsAt && collection.endsAt">
              <v-icon icon="mdi-circle-small" />
              <v-icon
                class="mt-n1 mr-1"
                icon="mdi-alarm"
              />
              {{ formatDate(collection.startsAt, false) }} — {{ formatDate(collection.endsAt, false) }}
            </template>
          </v-card-subtitle>

          <div v-if="collection.description">
            <v-alert
              border="start"
              class="mt-8 w-75"
              icon="mdi-information"
            >
              {{ collection.description }}
            </v-alert>
          </div>
        </div>

        <v-avatar
          class="collection-background"
          elevation="0"
          size="250"
        >
          <v-icon
            color="white"
            :icon="Collection.icons[collection.type]"
            size="250"
          />
        </v-avatar>
      </div>

      <v-chip-group class="mt-2">
        <v-chip
          v-for="item in collection.links"
          :key="item.url"
          class="mb-4"
          :href="item.url"
          :prepend-icon="item.icon || 'mdi-link'"
          rel="noopener"
          target="_blank"
        >
          {{ item.title || formatUrl(item.url) }}
        </v-chip>
      </v-chip-group>

      <v-divider class="mt-4" />

      <v-tabs
        v-if="appTable?.totalItems > 0 && subcollections?.length"
        v-model="activeTab"
      >
        <v-tab
          class="w-50"
          value="apps"
        >
          <v-icon
            class="mr-2"
            icon="mdi-controller"
          />
          {{ Collection.labels.apps }}
        </v-tab>
        <v-divider vertical />
        <v-tab
          class="w-50"
          value="collections"
        >
          <v-icon
            class="mr-2"
            icon="mdi-apps"
          />
          {{ Collection.labels.subcollections }}
        </v-tab>
      </v-tabs>
      <v-divider />

      <v-window
        v-model="activeTab"
        class="flex-grow-1 overflow-visible"
      >
        <v-window-item value="apps">
          <table-apps
            ref="appTable"
            class="h-100 mt-4"
            :only-collections="[collection.id]"
          />
        </v-window-item>

        <v-window-item
          v-if="subcollections?.length"
          value="collections"
        >
          <table-collections :only-collections="subcollections" />
        </v-window-item>
      </v-window>
    </v-card>
  </s-page-content>
</template>

<style scoped>
  .collection-background {
    opacity: 0.05;
    position: absolute;
    right: 0;
    top: 0;
    z-index: -1;
  }
</style>
