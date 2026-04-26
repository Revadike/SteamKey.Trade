<script setup>
  // TODO: Pending refactor
  import { formatNumber } from '~/assets/js/format';

  const supabase = useSupabaseClient();
  const { User } = useORM();
  const stats = ref(null);
  const status = ref('pending');
  const error = ref(null);

  // Define variables needed for the template
  const tradeStatuses = ['pending', 'accepted', 'declined', 'aborted', 'completed'];
  const tradeLabels = {
    statuses: {
      pending: 'Pending',
      accepted: 'Accepted',
      declined: 'Declined',
      aborted: 'Aborted',
      completed: 'Completed',
      disputed: 'Disputed'
    }
  };

  const fetchLatestTrade = async () => {
    const { data, error: tradeError } = await supabase
      .from('trades')
      .select('id, created_at, users!trades_sender_id_fkey(id, display_name)')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tradeError) {
      console.error('Error fetching latest trade:', tradeError);
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      item: { id: data.id },
      by: { id: data.users.id },
      at: data.created_at
    };
  };

  const fetchLatestUser = async () => {
    const { data, error: userError } = await supabase
      .from('users')
      .select('id, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (userError) {
      console.error('Error fetching latest user:', userError);
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      item: { id: data.id },
      at: data.created_at
    };
  };

  onMounted(async () => {
    try {
      // Fetch site statistics from the view
      const { data: siteStats, error: statsError } = await supabase
        .from('site_statistics')
        .select('*')
        .single();

      if (statsError) { throw statsError; }

      // Fetch latest trade and user information
      const [latestTrade, latestUser] = await Promise.all([
        fetchLatestTrade(),
        fetchLatestUser()
      ]);

      // Transform data to match the expected structure
      stats.value = {
        trades: {
          total: {
            all: siteStats.total_trades,
            pending: siteStats.trades_pending,
            accepted: siteStats.trades_accepted,
            declined: siteStats.trades_declined,
            aborted: siteStats.trades_aborted,
            completed: siteStats.trades_completed,
            disputed: siteStats.disputed_trades
          },
          latest: latestTrade,
          volume: siteStats.total_traded_volume
        },
        users: {
          total: {
            all: siteStats.total_users
          },
          latest: latestUser,
          avgTrades: siteStats.avg_trades,
          topRegions: [
            siteStats.top_region1,
            siteStats.top_region2,
            siteStats.top_region3
          ].filter(Boolean) // Filter out null values
        },
        vault: {
          total: {
            all: siteStats.total_vault_entries,
            received: siteStats.vault_entries_received,
            mine: siteStats.vault_entries_mine
          }
        }
      };

      status.value = 'success';
    } catch (err) {
      error.value = err;
      status.value = 'error';
      console.error('Error fetching statistics:', err);
    }
  });
</script>

<template>
  <v-card
    class="d-flex flex-column fill-height"
    :loading="status === 'pending'"
  >
    <v-card-title class="text-center text-button py-4">
      <v-icon
        icon="mdi-chart-bar"
        start
      />
      Statistics
    </v-card-title>

    <v-divider />

    <v-card-text class="d-flex flex-column flex-grow-1">
      <template v-if="status === 'success'">
        <v-row
          class="d-flex flex-grow-1"
          dense
        >
          <!-- Left Column (Trades) -->
          <v-col
            class="pa-4 d-flex flex-column"
            cols="12"
            lg="6"
          >
            <h2>
              <v-icon
                class="mt-n1 mr-1"
                icon="mdi-swap-horizontal"
                size="small"
              />
              Trades
            </h2>
            <v-table class="mb-4">
              <tbody>
                <tr v-if="stats.trades?.latest?.item">
                  <td class="text-overline">
                    Latest
                  </td>
                  <td>
                    <nuxt-link
                      class="text-decoration-none"
                      :to="`/trade/${stats.trades.latest.item.id}`"
                    >
                      {{ 'Trade' }}
                    </nuxt-link>
                    <span class="text-disabled"> by </span>
                    <rich-profile-link
                      hide-avatar
                      :user-id="stats.trades.latest.by.id"
                    />
                    <rich-date
                      class="text-disabled"
                      :date="stats.trades.latest.at"
                    />
                  </td>
                </tr>
                <tr>
                  <td class="text-overline">
                    Total
                  </td>
                  <td>
                    {{ formatNumber(stats.trades?.total?.all ?? 0) }}
                    <span class="text-disabled">trades</span>
                  </td>
                </tr>
                <tr v-if="stats.trades?.volume">
                  <td class="text-overline">
                    Volume
                  </td>
                  <td>
                    {{ formatNumber(stats.trades.volume ?? 0) }}
                    <span class="text-disabled">keys traded</span>
                  </td>
                </tr>
                <tr
                  v-for="tradeStatus in tradeStatuses.concat('disputed')"
                  :key="tradeStatus"
                >
                  <td class="text-overline">
                    {{ tradeLabels.statuses[tradeStatus] }}
                  </td>
                  <td>
                    {{ formatNumber(stats.trades?.total?.[tradeStatus] ?? 0) }}
                    <span class="text-disabled">trades</span>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-col>

          <v-divider
            v-if="$vuetify.display.lgAndUp"
            style="position: absolute; top: 54; left: 50%; height: 100%; z-index: -1;"
            vertical
          />

          <v-col
            class="pa-4 d-flex flex-column"
            cols="12"
            lg="6"
          >
            <div>
              <h2>
                <v-icon
                  class="mt-n1 mr-1"
                  icon="mdi-account-group"
                  size="small"
                />
                Users
              </h2>
              <v-table class="mb-4">
                <tbody>
                  <tr>
                    <td class="text-overline">
                      Total
                    </td>
                    <td>
                      {{ formatNumber(stats.users?.total?.all ?? 0) }}
                      <span class="text-disabled">users</span>
                    </td>
                  </tr>
                  <tr v-if="stats.users?.avgTrades">
                    <td class="text-overline">
                      Avg. Trades
                    </td>
                    <td>
                      {{ formatNumber(stats.users.avgTrades) }}
                      <span class="text-disabled">per user</span>
                    </td>
                  </tr>
                  <tr v-if="stats.users?.topRegions?.length">
                    <td class="text-overline">
                      Top {{ Math.min(3, stats.users.topRegions.length) }} Regions
                    </td>
                    <td>
                      <span
                        v-for="(region, index) in stats.users.topRegions"
                        :key="region"
                        v-tooltip:top="User.labels[region]"
                      >
                        {{ region }}{{ index < stats.users.topRegions.length - 1 ? ', ' : '' }}
                      </span>
                    </td>
                  </tr>
                  <tr v-if="stats.users?.latest?.item">
                    <td class="text-overline">
                      Latest
                    </td>
                    <td>
                      <rich-profile-link
                        hide-avatar
                        :user-id="stats.users.latest.item.id"
                      />
                      <rich-date
                        class="text-disabled"
                        :date="stats.users.latest.at"
                      />
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </div>

            <div>
              <h2>
                <v-icon
                  class="mt-n1 mr-1"
                  icon="mdi-safe"
                  size="small"
                />
                Vaults
              </h2>
              <v-table>
                <tbody>
                  <tr v-if="!isNaN(parseFloat(stats.vault?.total?.all))">
                    <td class="text-overline">
                      In Vaults
                    </td>
                    <td>
                      {{ formatNumber(stats.vault.total.all) }}
                      <span class="text-disabled">keys</span>
                    </td>
                  </tr>
                  <tr v-if="!isNaN(parseFloat(stats.vault?.total?.received))">
                    <td class="text-overline">
                      Traded Away
                    </td>
                    <td class="text-no-wrap">
                      {{ formatNumber(stats.vault.total.received) }}
                      <span class="text-disabled">keys</span>
                      ({{ formatNumber(stats.vault.total.received / (stats.vault.total.all || 1) * 100) }}%)
                    </td>
                  </tr>
                  <tr v-if="!isNaN(parseFloat(stats.vault?.total?.mine))">
                    <td class="text-overline">
                      Imported
                    </td>
                    <td>
                      {{ formatNumber(stats.vault.total.mine) }}
                      <span class="text-disabled">keys</span>
                      ({{ formatNumber(stats.vault.total.mine / (stats.vault.total.all || 1) * 100) }}%)
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </div>
          </v-col>
        </v-row>
      </template>

      <v-row
        v-else-if="status === 'pending'"
        class="fill-height"
        no-gutters
      >
        <v-col cols="6">
          <v-skeleton-loader
            class="w-100 h-100"
            loading
            type="list-item@8"
          />
        </v-col>
        <v-col cols="6">
          <v-skeleton-loader
            class="w-100 h-100"
            loading
            type="list-item@8"
          />
        </v-col>
      </v-row>

      <div
        v-else-if="error"
        class="d-flex flex-column align-center justify-center fill-height"
      >
        <p class="text-disabled font-italic">
          An error occurred while fetching statistics ({{ error.code || error.message || error.toString() }}).
        </p>
      </div>
    </v-card-text>
  </v-card>
</template>

<style lang="scss" scoped>
  .v-table :deep(.text-overline) {
    width: 150px;
    white-space: nowrap;
  }
</style>