<script setup>
  defineProps({
    loading: {
      type: Boolean,
      default: false
    },
    breadcrumbs: {
      type: Array,
      default: () => []
    }
  });
</script>

<template>
  <v-container
    v-if="loading"
    class="d-flex flex-column flex-grow-1 h-100"
  >
    <div>
      <v-skeleton-loader
        class="bg-transparent ml-n4"
        loading
        :type="`chip@${breadcrumbs.length}`"
      />
    </div>
    <v-card class="rounded-lg flex-grow-1 d-flex">
      <div class="v-skeleton-loader flex-grow-1 d-flex">
        <div class="v-skeleton-loader__bone v-skeleton-loader__ossein h-100 opacity-50" />
      </div>
    </v-card>
  </v-container>
  <v-container
    v-else
    class="d-flex flex-column flex-grow-1 h-100 ga-2"
  >
    <div class="d-flex align-center flex-wrap ga-2 w-100">
      <div class="s-page-content__breadcrumbs d-flex align-center">
        <slot
          v-if="$slots.breadcrumbs"
          v-bind="{ breadcrumbs }"
          name="breadcrumbs"
        />
        <v-breadcrumbs
          v-else-if="breadcrumbs?.length"
          :items="breadcrumbs"
          :max-items="breadcrumbs.length"
        />
      </div>
      <div class="s-page-content__spacer" />
      <div
        v-if="$slots.actions"
        class="s-page-content__actions d-flex flex-wrap ga-2"
      >
        <slot name="actions" />
      </div>
    </div>

    <slot name="default" />
  </v-container>
</template>

<style scoped lang="scss">
  .s-page-content__header {
    width: 100%;
  }

  .s-page-content__breadcrumbs {
    min-width: 0;
  }

  .s-page-content__breadcrumbs :deep(.v-breadcrumbs) {
    padding: 0;
  }

  .s-page-content__spacer {
    flex-grow: 99;
  }

  .s-page-content__actions {
    flex-grow: 1;
    display: flex;
    align-items: stretch;
  }

  .s-page-content__actions :deep(.v-btn) {
    --v-theme-overlay-multiplier: var(--v-theme-surface-overlay-multiplier);
    background-color: rgb(var(--v-theme-surface)) !important;
    border-radius: 4px !important;
    color: rgb(var(--v-theme-on-surface));
    flex: 1 1 auto !important;
  }

  @media (max-width: 599px) {
    .s-page-content__breadcrumbs {
      width: 100%;
    }

    .s-page-content__spacer {
      display: none;
    }

    .s-page-content__actions :deep(.v-btn) {
      flex: 1 1 100% !important;
    }
  }
</style>
