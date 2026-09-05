<script setup>
  const { data: bundles } = useSupabaseData('active-bundles');

  // Helper function to strip parent bundle name from subcollection title
  const getSubcollectionTitle = (subcollectionTitle, parentTitle) => {
    if (!subcollectionTitle || !parentTitle) {
      return subcollectionTitle;
    }

    // Try to remove "ParentName - " prefix
    const pattern = new RegExp(`^${parentTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–—]\\s*`, 'i');
    const stripped = subcollectionTitle.replace(pattern, '').trim();

    return stripped || subcollectionTitle;
  };

  // Helper function to get time remaining text
  const getTimeRemaining = (endsAt) => {
    if (!endsAt) {
      return null;
    }

    const now = new Date();
    const end = new Date(endsAt);
    const diff = end - now;

    if (diff <= 0) {
      return 'Expired';
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return `${days}d ${hours}h remaining`;
    } else if (hours > 0) {
      return `${hours}h remaining`;
    } else {
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `${minutes}m remaining`;
    }
  };
</script>

<template>
  <v-card class="d-flex flex-column fill-height">
    <v-card-title class="text-center text-button py-4">
      <v-icon
        icon="mdi-package-variant-closed"
        start
      />
      Active Bundles
    </v-card-title>

    <v-divider />

    <v-card-text
      v-if="!bundles || bundles.length === 0"
      class="text-center text-disabled py-8"
    >
      No active bundles at the moment
    </v-card-text>

    <v-card-text
      v-else
      class="pa-2 overflow-y-auto"
      style="max-height: 600px;"
    >
      <v-row dense>
        <v-col
          v-for="bundle in bundles"
          :key="bundle.id"
          cols="12"
        >
          <v-card
            class="border"
            :to="`/collection/${bundle.id}`"
            variant="flat"
          >
            <v-card-title class="text-wrap pb-1">
              {{ bundle.title }}
            </v-card-title>

            <v-card-subtitle
              v-if="getTimeRemaining(bundle.ends_at)"
              class="pt-1"
            >
              <v-icon
                class="mr-1 mt-n1"
                icon="mdi-clock-outline"
                size="x-small"
              />
              {{ getTimeRemaining(bundle.ends_at) }}
            </v-card-subtitle>

            <v-card-text
              v-if="bundle.description"
              class="text-caption text-wrap py-2"
            >
              {{ bundle.description }}
            </v-card-text>

            <!-- Subcollections -->
            <v-card-text
              v-if="bundle.subcollections && bundle.subcollections.length > 0"
              class="pt-0"
            >
              <v-divider class="mb-2" />
              <div class="d-flex flex-wrap ga-1">
                <v-chip
                  v-for="subcollection in bundle.subcollections"
                  :key="subcollection.id"
                  class="text-caption"
                  size="small"
                  :to="`/collection/${subcollection.id}`"
                  variant="outlined"
                  @click.stop
                >
                  {{ getSubcollectionTitle(subcollection.title, bundle.title) }}
                </v-chip>
              </div>
            </v-card-text>

            <!-- External links -->
            <v-card-actions
              v-if="bundle.links && bundle.links.length > 0"
              class="pt-0"
            >
              <v-btn
                v-for="(link, index) in bundle.links.slice(0, 3)"
                :key="index"
                color="primary"
                :href="link.url"
                :icon="link.url.includes('gg.deals') ? 'icon-ggdeals' : 'mdi-open-in-new'"
                rel="noopener noreferrer"
                size="x-small"
                target="_blank"
                variant="text"
                @click.stop
              />
              <v-spacer />
              <rich-date
                class="text-caption text-disabled"
                :date="bundle.created_at"
              />
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
      <v-row dense>
        <v-col
          v-if="bundles.length > 3"
          class="text-center"
          cols="12"
        >
          <v-btn
            block
            color="primary"
            to="/collections?filters=H4sIAAAAAAAACl3MwQrCMBCE4XeZcypLEMF9Dk%2BWIrHZSmFJqknEUPLuUkQEb/MfvlkxzaI%2Bgfv1M8HIdREYxEUeLs8xgCF3GDydFgHjWoJXQTM/IsGni8t/6pa3ny%2BzZA8dHTvan6xlIibaEdEZbTAYo6qMm0vgFS5U8OQ0iUEMWsH9YCCvUYuXLVp7A7rH3r67AAAA&tab=community&sort=title&order=asc"
            variant="outlined"
          >
            View All Active Bundles
          </v-btn>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>
