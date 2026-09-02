<script setup>
  import { useDisplay } from 'vuetify/framework';

  const props = defineProps({
    user: {
      type: Object,
      required: true
    },
    position: {
      type: String,
      required: true
    }
  });

  const { userId } = props.user;
  const attributes = {
    totalUniqueTrades: props.user.totalUniqueTrades,
    totalCompletedTrades: props.user.totalCompletedTrades,
    totalDeclinedTrades: props.user.totalDeclinedTrades,
    totalReviewsReceived: props.user.totalReviewsReceived,
    avgSpeed: props.user.avgSpeed?.toFixed(1)
  };

  const { User } = useORM();

  // TODO: flat or elevated top1?
  // const cardMarginClass = computed(() => {
  //   return props.position === '1' ? 'mb-10' : 'mt-12'; // for showing cards at different height
  // });

  const positionClass = computed(() => {
    switch (props.position) {
      case '1':
        return 'first-place';
      case '2':
        return 'second-place';
      case '3':
        return 'third-place';
      default:
        return '';
    }
  });

  const { smAndDown } = useDisplay();
</script>

<template>
  <v-card class="podium-card">
    <!-- card top -->
    <v-card-text
      class="d-flex align-center justify-start pa-0 avatar-bg"
      :class="`${positionClass}-bg`"
    >
      <rich-profile-link
        :avatar-size="smAndDown ? '80' : '100'"
        class="my-n12 ml-n3 mr-1 z-20 position-relative py-0 card-username font-weight-bold overflow-hidden text-truncate"
        :class="smAndDown ? 'ml-n3' : 'ml-n8'"
        hide-reputation
        :user-id="userId"
      />
      <div
        class="position-absolute d-flex align-center justify-center"
        :class="smAndDown ? 'mb-n15 ml-6' : 'mb-n16 ml-3'"
      >
        <v-icon
          :class="positionClass"
          icon="mdi-seal-variant"
          :size="smAndDown ? 40 : 60"
          style="text-shadow: 0 0 8px rgba(0, 0, 0, 0.9);"
        />
        <v-icon
          class="position-absolute mt-n5"
          :class="`${positionClass} position-absolute ${smAndDown ? 'pt-2' : 'mt-n5'}`"
          icon="mdi-circle"
          :size="smAndDown ? 18 : 26"
        />
        <span :class="`position-absolute font-weight-black text-surface ${smAndDown ? 'text-h7 mt-n4' : 'text-h5 mt-n5'}`">
          {{ position }}
        </span>
      </div>
    </v-card-text>

    <!-- user statistics panel -->
    <v-card-text class="mr-0 ml-2 pt-8 pb-6 px-0">
      <v-row
        v-for="key in Object.keys(attributes)"
        :key="key"
        class="align-center"
      >
        <v-col
          class="text-right text-disabled py-1"
          cols="8"
        >
          <span class="text-no-wrap">
            {{ (User.shortLabels[key] ? User.shortLabels[key] : key) }}
            <v-tooltip
              activator="parent"
              open-delay="300"
            >
              {{ (User.labels[key] ? User.labels[key] : key) }}
            </v-tooltip>
          </span>
        </v-col>
        <v-col
          class="font-weight-bold pt-0 pb-0 text-h6 mx-0 text-no-wrap"
          cols="4"
        >
          {{ attributes[key] ? attributes[key] : 'N/A' }}
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<style scoped lang="scss">
  .podium-card {
    border-radius: 0 0 10px 10px;
    padding: 0;
    border: 2px solid rgb(var(--v-theme-surface-light));
    overflow: visible;
  }

  .first-place {
    color: rgb(204, 165, 0);
  }

  .second-place {
    color: rgb(122, 122, 122);
  }

  .third-place {
    color: rgb(158, 95, 20);
  }

  .first-place-bg {
    background: rgb(204, 165, 0);
    background: linear-gradient(-15deg, rgba(255, 199, 41, 0.7) 0%, rgba(245, 180, 17, 0.7) 35%, rgba(255, 228, 1, 0.7) 45%, rgba(255, 228, 1, 0.7) 100%);
    box-shadow: 0 5px 5px rgba(0, 0, 0, 0.3);
  }

  .second-place-bg {
    background: rgb(122, 122, 122);
    background: linear-gradient(-15deg, rgba(124, 124, 124, 0.7) 35%, rgba(164, 164, 164, 0.7) 45%, rgba(177, 177, 177, 0.7) 60%);
    box-shadow: 0 5px 5px rgba(0, 0, 0, 0.3);
  }

  .third-place-bg {
    background: rgb(158, 95, 20);
    background: linear-gradient(-15deg, rgba(133, 76, 9, 0.7) 35%, rgba(158, 95, 20, 0.7) 45%, rgba(179, 102, 6, 0.7) 100%);
    box-shadow: 0 5px 5px rgba(0, 0, 0, 0.3);
  }

  :deep(.v-avatar) {
    border: 1px solid rgb(var(--v-theme-surface-light));
  }

  .avatar-bg {
    height: 50px;
  }

  // make avatar loader fill whole space correctly
  ::v-deep(.v-skeleton-loader) {
    .v-skeleton-loader__avatar {
      height: 100%;
      width: 100%;
      max-height: initial;
      max-width: initial;
      margin: 0;
      padding: 0;
    }
  }

  .card-username::v-deep(span) {
    color: #dddddd !important;
    font-size: 1rem;
    z-index: 1;
    text-shadow: #444444 2px 2px 3px;
    text-overflow: ellipsis !important;
    overflow: hidden;
    white-space: nowrap;
  }
</style>
