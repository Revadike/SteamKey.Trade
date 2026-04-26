<script setup>
  const { user } = useAuthStore();
  await navigateTo(`/user/${user.id}`);
</script>

<template>
  <v-container class="fill-height">
    <v-row justify="center">
      <v-col cols="auto">
        <nuxt-link :to="`/user/${user.id}`">
          Click here
        </nuxt-link> if you are not redirected automatically.
      </v-col>
    </v-row>
  </v-container>
</template>