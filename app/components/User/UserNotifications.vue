<script setup>
  const supabase = useSupabaseClient();
  const { user } = storeToRefs(useAuthStore());
  const { setNotificationCount } = useAuthStore();
  const { User } = useORM();

  const notifications = ref([]);
  const page = ref(0);
  const pageSize = 5;
  const isLoading = ref(false);
  const loading = ref(false);
  const hasMore = ref(false);
  const notificationsChannel = ref(null);

  const fetchNotificationsPage = async (targetPage) => {
    if (!user.value?.id) {
      return [];
    }

    const from = (targetPage - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from(User.notifications.table)
      .select('*')
      .eq(User.notifications.fields.userId, user.value.id)
      .order(User.notifications.fields.createdAt, { ascending: false })
      .range(from, to);

    if (error) {
      console.error(error);
      return [];
    }

    return data.map(notification => User.fromDB(notification, User.notifications.fields));
  };

  const unreadCount = computed(() => notifications.value.filter(({ read }) => !read).length);

  watch(unreadCount, count => {
    setNotificationCount(count);
  }, {
    immediate: true
  });

  const subscribeToNotifications = () => {
    if (!user.value?.id || notificationsChannel.value) {
      return;
    }

    notificationsChannel.value = supabase
      .channel(`user-notifications-${user.value.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: User.notifications.table,
          filter: `${User.notifications.fields.userId}=eq.${user.value.id}`
        },
        payload => {
          const notification = User.fromDB(payload.new, User.notifications.fields);

          if (notifications.value.some(({ id }) => id === notification.id)) {
            return;
          }

          notifications.value = [notification, ...notifications.value];
        }
      )
      .subscribe();
  };

  const unsubscribeFromNotifications = async () => {
    if (!notificationsChannel.value) {
      return;
    }

    await supabase.removeChannel(notificationsChannel.value);
    notificationsChannel.value = null;
  };

  const loadMore = async () => {
    if (loading.value || !user.value?.id || (!hasMore.value && page.value > 0)) {
      return;
    }

    loading.value = true;
    isLoading.value = page.value === 0;

    const nextPage = page.value + 1;
    const nextItems = await fetchNotificationsPage(nextPage);

    if (nextPage === 1) {
      notifications.value = nextItems;
    } else if (nextItems.length) {
      notifications.value = [...notifications.value, ...nextItems];
    }

    if (nextItems.length) {
      page.value = nextPage;
    }

    hasMore.value = nextItems.length === pageSize;
    isLoading.value = false;
    loading.value = false;
  };

  watch(() => user.value?.id, async (id, oldId) => {
    if (id === oldId) {
      return;
    }

    await unsubscribeFromNotifications();

    notifications.value = [];
    hasMore.value = false;
    page.value = 0;
    isLoading.value = false;

    if (id) {
      subscribeToNotifications();
      await loadMore();
    }
  });

  onMounted(() => {
    if (!user.value?.id) {
      return;
    }

    subscribeToNotifications();
    loadMore();
  });

  const markAsRead = async id => {
    const { error } = await supabase
      .from(User.notifications.table)
      .update({ read: true })
      .eq(User.notifications.fields.id, id);

    if (error) {
      return;
    }

    const index = notifications.value.findIndex(notification => notification.id === id);
    if (index !== -1) {
      notifications.value[index].read = true;
    }
  };

  const openNotification = ({ id, link }) => {
    markAsRead(id);
    if (link) {
      return navigateTo(link);
    }
  };

  const markAllAsRead = async () => {
    loading.value = true;

    const { error } = await supabase
      .from(User.notifications.table)
      .update({ read: true })
      .eq(User.notifications.fields.userId, user.value.id);

    if (!error) {
      notifications.value.forEach(notification => {
        notification.read = true;
      });
    }

    loading.value = false;
  };

  onBeforeUnmount(async () => {
    await unsubscribeFromNotifications();
  });
</script>

<template>
  <v-menu>
    <template #activator="attrs">
      <v-badge
        color="error"
        :content="unreadCount"
        :model-value="!!unreadCount"
        offset-x="5"
        offset-y="5"
        v-bind="attrs.props"
      >
        <v-btn
          icon="mdi-bell"
          v-bind="attrs.props"
        />
      </v-badge>
    </template>

    <v-list class="pt-0">
      <v-btn
        block
        class="mb-2"
        :disabled="unreadCount === 0 || loading"
        variant="tonal"
        @click="markAllAsRead"
      >
        <v-icon
          icon="mdi-check-all"
          start
        />
        Mark all as read
      </v-btn>
      <v-list-item
        v-if="!isLoading && !notifications.length"
        disabled
      >
        <v-list-item-title class="text-disabled text-center">
          No notifications
        </v-list-item-title>
      </v-list-item>
      <v-list-item
        v-for="notification in notifications"
        :key="notification.id"
        :class="{ 'text-disabled': notification.read }"
        @click="openNotification(notification)"
      >
        <v-list-item-title>
          {{ User.getNotificationText(notification.type) }}
        </v-list-item-title>
        <v-list-item-subtitle>
          <rich-date
            class="text-caption"
            :date="notification.createdAt"
          />
        </v-list-item-subtitle>
      </v-list-item>

      <v-btn
        v-if="notifications.length"
        block
        class="mt-2 text-caption"
        :disabled="loading || !hasMore"
        variant="text"
        @click.stop="loadMore"
      >
        <v-icon
          icon="mdi-arrow-down"
          start
        />
        Load more
      </v-btn>
    </v-list>
  </v-menu>
</template>
