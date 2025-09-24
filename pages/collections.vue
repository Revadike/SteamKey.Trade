<script setup>
  const { user, isLoggedIn } = storeToRefs(useAuthStore());

  const activeTab = isLoggedIn.value ? useSearchParam('tab', 'mine') : ref('community');
  const title = 'Collections';
  const breadcrumbs = [
    { title: 'Home', to: '/' },
    { title, disabled: true }
  ];

  useSeoMeta({ title, ogTitle: title });
</script>

<template>
  <s-page-content :breadcrumbs="breadcrumbs">
    <template #append>
      <dialog-sync-collection v-if="isLoggedIn && activeTab === 'mine'">
        <template #activator="attrs">
          <v-btn
            v-bind="attrs.props"
            class="bg-surface rounded"
            :icon="$vuetify.display.xs"
            :rounded="$vuetify.display.xs"
            variant="flat"
          >
            <v-icon
              class="mr-0 mr-sm-2"
              icon="mdi-sync"
            />
            <span class="d-none d-sm-block">
              Sync
            </span>
          </v-btn>
        </template>
      </dialog-sync-collection>
      <v-btn
        v-if="isLoggedIn"
        class="ml-2 bg-surface rounded"
        :icon="$vuetify.display.xs"
        :rounded="$vuetify.display.xs"
        to="/collection/new"
        variant="flat"
      >
        <v-icon
          class="mr-0 mr-sm-2"
          icon="mdi-plus"
        />
        <span class="d-none d-sm-block">
          New collection
        </span>
      </v-btn>
    </template>

    <v-card class="d-flex flex-column h-100">
      <div
        v-if="isLoggedIn"
        class="d-block w-100"
      >
        <v-tabs v-model="activeTab">
          <v-tab
            class="w-50"
            value="mine"
          >
            <v-icon
              class="mr-2"
              icon="mdi-account"
              variant="tonal"
            />
            Mine
          </v-tab>
          <v-divider vertical />
          <v-tab
            class="w-50"
            value="community"
          >
            <v-icon
              class="mr-2"
              icon="mdi-account-group"
              variant="tonal"
            />
            Community
          </v-tab>
        </v-tabs>
        <v-divider />
      </div>

      <v-window
        v-model="activeTab"
        class="h-100"
        :touch="false"
      >
        <v-window-item
          class="h-100"
          value="mine"
        >
          <table-collections
            v-if="user"
            filters-in-url
            :only-users="[user.id]"
            show-actions
            show-quick-filters
            sort-in-url
          />
        </v-window-item>

        <v-window-item
          class="h-100"
          value="community"
        >
          <table-collections
            :exclude-users="isLoggedIn ? [user.id] : undefined"
            filters-in-url
            show-quick-filters
            sort-in-url
          />
        </v-window-item>
      </v-window>
    </v-card>
  </s-page-content>
</template>