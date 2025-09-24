<script setup>
  import { parseDate } from '~/assets/js/format';

  const snackbarStore = useSnackbarStore();
  const { Collection } = useORM();
  const { updateUserCollections, user } = useAuthStore();
  const router = useRouter();

  const props = defineProps({
    id: {
      type: String,
      default: () => null
    }
  });

  const valid = ref(false);
  const loading = ref(false);
  const isNew = !props.id;
  const onlyCollections = isNew ? [] : [props.id];

  const { data: collection, status: collectionStatus, error: collectionError } = useLazyAsyncData(`collection-${props.id || 'new'}`, async () => {
    if (isNew) {
      const data = (new Collection()).toObject();
      return {
        ...data,
        title: 'My collection',
        userId: user.id,
        private: true,
        master: false,
        type: Collection.enums.type.custom,
        links: []
      };
    }

    try {
      const instance = new Collection(props.id);
      await instance.load();

      return instance.toObject();
    } catch (err) {
      if (err.code === 'PGRST116') {
        throw createError({
          statusCode: 404,
          statusMessage: 'Collection not found',
          message: 'The collection you are looking for does not exist',
          fatal: true
        });
      }
      throw err;
    }
  });

  const { data: subcollections, status: subStatus, error: subError } = useLazyAsyncData(
    `collection-subcollections-${props.id || 'new'}`,
    async () => {
      if (isNew) { return []; }

      const instance = new Collection(props.id);
      return instance.getSubcollections().then(collections => {
        return collections.map(instance => instance.toObject());
      });
    }, {
      default: () => []
    });

  // Watch for loading errors
  watch([
    () => collectionError.value,
    () => subError.value
  ], error => {
    if (error) {
      console.error(error);
      snackbarStore.set('error', error.message);
    }
  });

  watch(() => collection.value?.master, master => {
    if (master) {
      collection.value.private = false;
    }
  });

  const appsTable = useTemplateRef('appsTable');
  const activeTab = ref('apps');
  const appidsToAdd = ref([]);
  const appidsToRemove = ref([]);
  const collectionsToRemove = ref([]);
  const newApp = ref(null);
  const selectedApps = ref([]);
  const selectedCollections = ref([]);

  const addApp = async appid => {
    if (!appid) {
      return;
    }

    if (!appidsToAdd.value.includes(Number(appid))) {
      appidsToAdd.value.push(Number(appid));
    }
    appidsToRemove.value = appidsToRemove.value.filter(appid => !appidsToAdd.value.includes(appid));
    newApp.value = undefined;

    await nextTick();
    document.activeElement.blur();
  };

  const removeApps = () => {
    appidsToRemove.value.push(...selectedApps.value.map(app => app.id));
    appidsToAdd.value = appidsToAdd.value.filter(appid => !appidsToRemove.value.includes(appid));
    selectedApps.value = [];
  };

  const emptyCollection = async () => {
    loading.value = true;
    try {
      const instance = new Collection(collection.value.id);
      await instance.empty();
      appidsToRemove.value = [];
      appidsToAdd.value = [];
      selectedApps.value = [];
      if (appsTable.value) {
        await appsTable.value.refresh();
      }
      snackbarStore.set('success', 'Collection updated');
    } catch (error) {
      snackbarStore.set('error', error.message || 'Failed to empty collection');
    }
    loading.value = false;
  };

  const addCollections = collections => {
    subcollections.value.push(...collections);
  };

  const removeCollections = () => {
    collectionsToRemove.value.push(...selectedCollections.value);
    subcollections.value = subcollections.value.filter(collection => !selectedCollections.value.includes(collection));
    selectedCollections.value = [];
  };

  const submit = async () => {
    if (!valid.value) {
      snackbarStore.set('warning', 'Collection is incomplete');
      return;
    }

    loading.value = true;
    try {
      const instance = new Collection(collection.value.id);
      Object.assign(instance, collection.value);
      instance.userId = user.id;

      // Format dates for submission
      if (collection.value.startsAt) {
        instance.startsAt = parseDate(collection.value.startsAt);
      }
      if (collection.value.endsAt) {
        instance.endsAt = parseDate(collection.value.endsAt);
      }

      // Save collection
      await instance.save();

      // Handle apps to remove
      if (appidsToRemove.value.length > 0) {
        await instance.removeApps(appidsToRemove.value);
      }

      // Handle apps to add
      if (appidsToAdd.value.length > 0) {
        await instance.addApps(appidsToAdd.value);
      }

      // Handle subcollections to remove
      await Promise.all(collectionsToRemove.value.map(data => {
        const subInstance = new Collection(data);
        return instance.removeSubcollection(subInstance);
      }));

      // Handle subcollections to add
      await Promise.all(subcollections.value.map(data => {
        const subInstance = new Collection(data);
        return instance.addSubcollection(subInstance);
      }));

      // If the collection is a master collection, update user collections state
      if (instance.master) {
        await updateUserCollections();
      }

      snackbarStore.set('success', isNew ? 'Collection created' : 'Collection saved');
      await navigateTo(`/collection/${instance.id}`);
    } catch (error) {
      console.error(error);
      snackbarStore.set('error', error.message || 'Failed to save collection');
    }
    loading.value = false;
  };

  const isLoading = computed(() =>
    collectionStatus.value === 'pending' ||
    subStatus.value === 'pending'
  );

  const title = computed(() => {
    return isNew ? 'New collection' : 'Editing collection';
  });

  const breadcrumbs = computed(() => [
    { title: 'Home', to: '/' },
    { title: 'Collections', to: '/collections' },
    { title: isNew ? 'New' : 'Edit', disabled: true }
  ]);

  useSeoMeta({ title, ogTitle: title });
</script>

<template>
  <s-page-content
    :breadcrumbs="breadcrumbs"
    :loading="isLoading"
  >
    <v-form
      v-model="valid"
      class="d-flex flex-column flex-grow-1"
      @submit.prevent="submit"
    >
      <v-card class="mb-4 flex-grow-0">
        <v-card-text>
          <v-row>
            <v-col
              cols="12"
              md="7"
            >
              <v-text-field
                v-model="collection.title"
                hide-details
                :label="Collection.labels.title"
                required
                :rules="[v => !!v || 'Title is required']"
              />
            </v-col>
            <v-col
              cols="12"
              md="3"
            >
              <v-select
                v-model="collection.type"
                :append-inner-icon="Collection.icons[collection.type]"
                hide-details
                :items="Object.values(Collection.enums.type)
                  .filter(type => type !== 'app')
                  .map(type => ({
                    title: Collection.labels[type],
                    value: type,
                    props: { prependIcon: Collection.icons[type] }
                  }))"
                :label="Collection.labels.type"
                menu-icon=""
                required
                :rules="[v => !!v || 'Type is required']"
              />
            </v-col>
            <v-col
              class="d-flex justify-md-center justify-space-between align-center flex-md-column flex-row"
              cols="12"
              md="2"
            >
              <v-switch
                v-model="collection.private"
                v-tooltip:top="Collection.descriptions.private"
                class="mt-md-n1 mt-0"
                density="compact"
                :disabled="collection.master"
                hide-details
                :label="Collection.labels.private"
              />
              <v-switch
                v-if="['library', 'wishlist', 'tradelist', 'blacklist'].includes(collection.type)"
                v-model="collection.master"
                v-tooltip:top="Collection.descriptions.master"
                class="mt-md-n3 mt-0"
                density="compact"
                hide-details
                :label="Collection.labels.master"
              />
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <v-card class="d-flex flex-column flex-grow-1 mb-4">
        <v-tabs v-model="activeTab">
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

        <v-window v-model="activeTab">
          <v-window-item value="apps">
            <v-card-text class="d-flex flex-column overflow-auto">
              <div class="d-flex flex-md-row flex-column align-center ga-4 mb-2 flex-wrap">
                <input-app-search
                  v-model="newApp"
                  class="flex-grow-1 w-100 w-md-auto"
                  density="compact"
                  hide-details
                  label="Add single app"
                  min-width="200"
                  prepend-inner-icon="mdi-plus"
                  @update:model-value="addApp"
                />
                <span class="d-none d-md-inline-block">or</span>
                <dialog-add-apps
                  :collection="collection"
                  @submit="appsTable.refresh(); snackbarStore.set('success', 'Collection updated')"
                >
                  <template #activator="attrs">
                    <v-btn
                      v-bind="attrs.props"
                      :block="!$vuetify.display.mdAndUp"
                      :disabled="isNew && !collection.title"
                      variant="tonal"
                    >
                      <v-icon
                        icon="mdi-plus"
                        start
                      />
                      Add multiple apps
                    </v-btn>
                  </template>
                </dialog-add-apps>

                <v-divider
                  v-if="$vuetify.display.mdAndUp"
                  vertical
                />

                <dialog-add-tag
                  :apps="selectedApps"
                  :collection-type="collection.type"
                  @submit="selectedApps = []; appsTable.refresh()"
                >
                  <template #activator="attrs">
                    <v-btn
                      v-bind="attrs.props"
                      :block="!$vuetify.display.mdAndUp"
                      class="flex-grow-1"
                      :disabled="!Object.keys(selectedApps).length"
                      variant="tonal"
                    >
                      <v-icon
                        icon="mdi-tag"
                        start
                      />
                      Add tag
                    </v-btn>
                  </template>
                </dialog-add-tag>

                <v-divider
                  v-if="$vuetify.display.mdAndUp"
                  vertical
                />

                <div class="d-flex flex-md-row flex-column align-center ga-4 flex-grow-1 w-100 w-md-auto">
                  <v-btn
                    :block="!$vuetify.display.mdAndUp"
                    class="flex-grow-1"
                    :color="!Object.keys(selectedApps).length ? undefined : 'error'"
                    :disabled="!Object.keys(selectedApps).length"
                    variant="tonal"
                    @click="removeApps"
                  >
                    <v-icon
                      icon="mdi-delete"
                      start
                    />
                    Remove {{ Object.keys(selectedApps).length || '' }}
                    {{ Object.keys(selectedApps).length === 1 ? 'app' : 'apps' }}
                  </v-btn>
                  <span class="d-none d-md-inline-block">or</span>
                  <dialog-confirm
                    color="red"
                    confirm-text="Empty"
                    @confirm="emptyCollection"
                  >
                    <template #activator="{ props: activatorProps }">
                      <v-btn
                        :block="!$vuetify.display.mdAndUp"
                        class="flex-grow-1"
                        color="error"
                        variant="tonal"
                        v-bind="activatorProps"
                      >
                        <v-icon
                          icon="mdi-delete-sweep"
                          start
                        />
                        Empty collection
                      </v-btn>
                    </template>
                  </dialog-confirm>
                </div>
              </div>
              <table-apps
                ref="appsTable"
                v-model="selectedApps"
                class="flex-grow-1"
                :exclude-apps="appidsToRemove"
                :include-apps="appidsToAdd"
                no-mandatory
                :only-collections="onlyCollections"
                show-select
              />
            </v-card-text>
          </v-window-item>

          <v-window-item value="collections">
            <v-card-text class="d-flex flex-column overflow-auto">
              <div class="d-flex flex-md-row flex-column align-center ga-4 mb-2 flex-wrap">
                <dialog-select-collection
                  multiple
                  select-text="Add as subcollection"
                  @select="addCollections"
                >
                  <template #activator="attrs">
                    <v-btn
                      v-bind="attrs.props"
                      :block="!$vuetify.display.mdAndUp"
                      class="flex-grow-1"
                      prepend-icon="mdi-plus"
                      variant="tonal"
                    >
                      Add collections
                    </v-btn>
                  </template>
                </dialog-select-collection>
                <v-divider
                  v-if="$vuetify.display.mdAndUp"
                  vertical
                />
                <v-btn
                  :block="!$vuetify.display.mdAndUp"
                  class="flex-grow-1"
                  color="error"
                  :disabled="!Object.keys(selectedCollections).length"
                  variant="tonal"
                  @click="removeCollections"
                >
                  <v-icon
                    icon="mdi-delete"
                    start
                  />
                  Remove {{ Object.keys(selectedCollections).length || '' }}
                  {{ Object.keys(selectedCollections).length === 1 ? 'collection' : 'collections' }}
                </v-btn>
              </div>
              <table-collections
                v-model="selectedCollections"
                class="flex-grow-1"
                :items="subcollections"
                show-select
              />
            </v-card-text>
          </v-window-item>
        </v-window>
      </v-card>

      <v-expansion-panels class="mb-4">
        <v-expansion-panel>
          <v-expansion-panel-title>
            <v-icon
              class="mr-2"
              icon="mdi-cog"
            />
            More options
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-row>
              <v-col cols="12">
                <v-textarea
                  v-model="collection.description"
                  auto-grow
                  :hint="Collection.descriptions.description"
                  :label="Collection.labels.description"
                  persistent-hint
                  rows="3"
                />
              </v-col>
              <v-col
                cols="12"
                md="6"
              >
                <input-date
                  v-model="collection.startsAt"
                  clearable
                  :hint="Collection.descriptions.startsAt"
                  :label="Collection.labels.startsAt"
                  :max-date="collection.endsAt"
                  persistent-hint
                />
              </v-col>
              <v-col
                cols="12"
                md="6"
              >
                <input-date
                  v-model="collection.endsAt"
                  clearable
                  :hint="Collection.descriptions.endsAt"
                  :label="Collection.labels.endsAt"
                  :min-date="collection.startsAt"
                  persistent-hint
                />
              </v-col>
              <v-col cols="12">
                <input-links
                  v-model="collection.links"
                  :hint="Collection.descriptions.links"
                  :label="Collection.labels.links"
                  persistent-hint
                />
              </v-col>
            </v-row>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <v-footer
        class="flex-grow-0"
        rounded
      >
        <v-btn
          variant="text"
          @click="router.back"
        >
          Cancel
        </v-btn>
        <v-spacer />
        <v-btn
          :disabled="!valid || isLoading"
          :loading="loading"
          type="submit"
          variant="tonal"
        >
          {{ isNew ? 'Create' : 'Save' }}
        </v-btn>
      </v-footer>
    </v-form>
  </s-page-content>
</template>
