<script setup>
  const { online } = storeToRefs(usePresenceStore());
</script>

<template>
  <v-card class="d-flex flex-column fill-height text-center">
    <v-card-title class="text-center text-button py-4">
      <v-icon
        icon="mdi-account-multiple"
        start
      />
      Online
    </v-card-title>

    <v-divider />
    <v-card-text class="d-flex flex-column justify-space-between flex-grow-1">
      <p
        v-if="Object.keys(online).length === 1"
        class="mb-4"
      >
        <span class="text-disabled">There is currently </span>
        <b>1</b>
        <span class="text-disabled"> user online</span>
      </p>
      <p
        v-else
        class="mb-4"
      >
        <span class="text-disabled">There are currently </span>
        <b>{{ Object.keys(online).length }}</b>
        <span class="text-disabled"> users online</span>
      </p>
      <v-spacer />
      <div>
        <rich-profile-link
          v-for="userId in Object.keys(online)"
          :key="userId"
          class="mb-2 mr-2"
          :user-id="userId"
        />
      </div>
      <v-spacer />
    </v-card-text>
  </v-card>
</template>
