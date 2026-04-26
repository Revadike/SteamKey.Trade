<script setup>
  import MarkdownIt from 'markdown-it';
  import changelogMd from '~/assets/md/CHANGELOG.md?raw';

  const md = new MarkdownIt({ html: false, linkify: true });
  const html = computed(() => md.render(changelogMd));
</script>

<template>
  <v-card class="d-flex flex-column fill-height">
    <v-card-title class="text-center text-button py-4">
      <v-icon
        icon="mdi-list-box"
        start
      />
      Changelog
    </v-card-title>

    <v-divider />

    <v-card-text
      v-if="!html"
      class="text-center text-disabled py-8"
    >
      No changelog available.
    </v-card-text>

    <v-card-text
      v-else
      class="overflow-y-auto pa-2 changelog-content"
      style="max-height: 600px;"
    >
      <!-- eslint-disable vue/no-v-html -->
      <div v-html="html" />
      <!-- eslint-enable vue/no-v-html -->
    </v-card-text>
  </v-card>
</template>

<style lang="scss" scoped>
.changelog-content {
  :deep(h2),
  :deep(h2 + ul),
  :deep(h2 + ol) {
    border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
    margin: 0 0 1rem;
  }

  :deep(h2) {
    margin-bottom: 0;                // merge with list
    padding: 0.75rem 1rem;
    border-radius: 10px 10px 0 0;    // only top corners
    background: rgba(var(--v-theme-on-surface), 0.04);
    font-size: 1.05rem;
  }

  :deep(h2 + ul),
  :deep(h2 + ol) {
    margin-top: 0;
    border-top: none;
    border-radius: 0 0 10px 10px;
    padding: 0.5rem 1.5rem;
    position: relative;
  }

  :deep(li) {
    margin: 0.35rem 0;
  }
}
</style>
