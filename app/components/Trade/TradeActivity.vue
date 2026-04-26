<script setup>
  const props = defineProps({
    tradeId: {
      type: String,
      default: null
    },
    title: {
      type: String,
      default: 'Activity'
    },
    titleCenter: {
      type: Boolean,
      default: false
    },
    showTradeLinks: {
      type: Boolean,
      default: false
    }
  });

  const { user, isLoggedIn } = storeToRefs(useAuthStore());
  const { Trade } = useORM();
  const supabase = useSupabaseClient();

  let channel;
  const emit = defineEmits(['update']);

  const { data: trades, refresh } = useSupabaseData('my-recent-trades');

  // Fetch activities using useLazyAsyncData
  const dataKey = props.tradeId
    ? `trade-activities-${props.tradeId}`
    : (isLoggedIn.value ? 'my-trade-activities' : 'trade-activities');
  const { data: activities, status, error } = useLazyAsyncData(dataKey, async () => {
    if (props.tradeId) {
      // Single trade mode
      const tradeInstance = new Trade(supabase, props.tradeId);
      return await tradeInstance.getActivities(10);
    } else {
      // Global trade activity mode
      if (isLoggedIn.value) {
        if (!trades.value || !trades.value.length) {
          await refresh();
        }
        // If user has no trades, return an empty array instead of loading global activities
        if (!trades.value || !trades.value.length) {
          return [];
        }
        return await Trade.getActivities(supabase, trades.value.map(trade => trade.id), 10);
      } else {
        return await Trade.getActivities(supabase, null, 10);
      }
    }
  });

  // Function to create and setup the channel
  const setupRealtimeSubscription = () => {
    // Common channel event handler
    const handleNewActivity = (payload) => {
      if (activities.value) {
        activities.value.push(Trade.fromDB(payload.new, Trade.activity.fields));
        emit('update');
        scrollToBottom();
      }
    };

    // Common channel configuration
    const baseConfig = {
      event: 'INSERT',
      schema: 'public',
      table: Trade.activity.table
    };

    // Clean up any existing channel
    if (channel) {
      supabase.removeChannel(channel);
    }

    if (props.tradeId) {
      // Single trade mode - subscribe to specific trade activities
      const filter = `trade_id=eq.${props.tradeId}`;
      channel = supabase.channel(`${Trade.activity.table}_${props.tradeId}`)
        .on('postgres_changes', { ...baseConfig, filter }, handleNewActivity)
        .subscribe();
    } else if (isLoggedIn.value) {
      // User's personal trade activities
      refresh().then(() => {
        // Only set up the subscription if the user has trades
        if (trades.value && trades.value.length > 0) {
          // Use the 'in' operator to handle multiple UUIDs properly
          const tradeIds = trades.value.map(trade => `"${trade.id}"`).join(',');
          const filter = `trade_id=in.(${tradeIds})`;
          channel = supabase.channel(`${Trade.activity.table}_${user.value.id}`)
            .on('postgres_changes', { ...baseConfig, filter }, handleNewActivity)
            .subscribe();
        }
        // No subscription needed if user has no trades
      });
    } else {
      // Global trade activities
      channel = supabase.channel(Trade.activity.table)
        .on('postgres_changes', baseConfig, handleNewActivity)
        .subscribe();
    }
  };

  // Set up realtime subscription
  onMounted(() => {
    setupRealtimeSubscription();
  });

  // Clean up subscription on component unmount
  onBeforeUnmount(() => {
    if (channel) {
      supabase.removeChannel(channel);
    }
  });

  const scrollToBottom = () => {
    const activityFeed = document.querySelector('.activity-feed');
    if (activityFeed) {
      activityFeed.scrollTop = activityFeed.scrollHeight;
    }
  };

  // Auto-scroll to bottom when activities are loaded
  watch(activities, (newActivities) => {
    if (newActivities && newActivities.length) {
      nextTick(() => {
        scrollToBottom();
      });
    }
  });
</script>

<template>
  <v-card class="activity-window">
    <v-card-title
      :class="{
        'text-button': true,
        'text-center py-4': titleCenter,
      }"
    >
      <v-icon
        icon="mdi-history"
        start
      />
      {{ title }}
    </v-card-title>

    <v-divider />

    <v-card-text class="activity-feed flex-grow-1 d-flex flex-column justify-center">
      <v-timeline
        v-if="activities && activities.length"
        align="start"
        density="compact"
        hide-opposite
        side="end"
      >
        <v-timeline-item
          v-for="activity in activities"
          :key="activity.id"
          :dot-color="Trade.colors[activity.type]"
          :icon="Trade.icons[activity.type]"
          size="small"
        >
          <div class="d-flex flex-column">
            <span class="activity-body ">
              <rich-profile-link
                hide-avatar
                :user-id="activity.userId"
              />
              {{ ' ' }}
              {{ Trade.descriptions[activity.type] }}
              <nuxt-link
                v-if="showTradeLinks"
                :to="`/trade/${activity.tradeId}`"
              >
                <v-icon
                  icon="mdi-arrow-right"
                  size="small"
                />
              </nuxt-link>
            </span>

            <rich-date
              v-if="activity.createdAt"
              class="activity-info"
              :date="activity.createdAt"
            />
          </div>
        </v-timeline-item>
      </v-timeline>

      <div
        v-else
        class="d-flex flex-column align-center justify-center fill-height"
      >
        <v-skeleton-loader
          v-if="status === 'pending'"
          class="w-100 h-100"
          loading
          type="list-item-avatar@5"
        />
        <p
          v-if="error"
          class="text-disabled font-italic"
        >
          An error occurred while fetching activities ({{ error.code || error.message || error.toString() }}).
        </p>
        <span
          v-if="status === 'success' && (!activities || !activities.length)"
          class="text-disabled font-italic text-center"
        >
          No activity yet
        </span>
      </div>
    </v-card-text>
  </v-card>
</template>

<style lang="scss" scoped>
  .activity-window {
    min-height: 200px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .activity-feed {
    /* height: 400px; */
    flex: 1 1 auto;
    overflow-y: auto;
    height: 0px;
    padding: 0 1em;

    .activity-info {
      font-size: 0.65rem;
      color: #888;
    }

    .activity-body {
      color: rgba(var(--v-primary-base));
      font-size: 1rem;
      word-wrap: break-word;
    }
  }
</style>
