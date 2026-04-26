<script setup>
  import welcome from '@/components/Widget/WidgetWelcome.vue';
  import usersOnline from '@/components/Widget/WidgetUsersOnline.vue';
  import stats from '@/components/Widget/WidgetStats.vue';
  import tradeActivity from '@/components/Widget/WidgetTradeActivity.vue';
  import bundles from '@/components/Widget/WidgetActiveBundles.vue';
  import changelog from '@/components/Widget/WidgetChangelog.vue';

  const { User } = useORM();
  const { preferences, isLoggedIn } = storeToRefs(useAuthStore());
  const widgets = computed(() => preferences.value?.dashboardWidgets || Object.values(User.enums.widget));
  const components = {
    [User.enums.widget.welcome]: welcome,
    [User.enums.widget.usersOnline]: usersOnline,
    [User.enums.widget.stats]: stats,
    [User.enums.widget.tradeActivity]: tradeActivity,
    [User.enums.widget.bundles]: bundles,
    [User.enums.widget.changelog]: changelog
  };

  const title = 'Home';
  const breadcrumbs = [
    { title, disabled: true }
  ];

  useSeoMeta({ title, ogTitle: title });
</script>

<template>
  <s-page-content :breadcrumbs="breadcrumbs">
    <template #actions>
      <dialog-dashboard-settings v-if="isLoggedIn">
        <template #activator="attrs">
          <v-icon
            v-bind="attrs.props"
            icon="mdi-cog"
            variant="text"
          />
        </template>
      </dialog-dashboard-settings>
    </template>

    <v-row justify="center">
      <v-col
        v-for="(widget, i) in widgets"
        :key="widget"
        cols="12"
        :md="i === 0 && widgets.length % 2 === 1 ? 12 : 6"
      >
        <component :is="components[widget]" />
      </v-col>
    </v-row>
  </s-page-content>
</template>
