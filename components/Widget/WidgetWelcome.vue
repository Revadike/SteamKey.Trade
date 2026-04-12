<script setup>
  const { user, isLoggedIn } = storeToRefs(useAuthStore());

  const have = ref(null);
  const want = ref(null);
</script>

<template>
  <v-card class="d-flex flex-column fill-height text-center">
    <v-card-title class="text-center text-button py-4">
      <v-icon
        icon="mdi-home"
        start
      />
      Welcome
    </v-card-title>

    <v-divider />
    <v-card-text class="d-flex flex-column justify-space-between flex-grow-1">
      <h1 v-if="isLoggedIn">
        Welcome back, {{ user.displayName }}!
      </h1>
      <h1 v-else>
        Sup, gamer! 👋
      </h1>
      <p class="mb-4">
        SteamKey.Trade is a community-driven platform where gamers can safely and easily trade their Steam keys, built by <a
          class="text-decoration-none"
          href="https://github.com/Revadike/SteamKey.Trade/graphs/contributors"
          rel="noopener"
          target="_blank"
        >admiring open-source contributors</a> and gamers alike.
      </p>
      <v-spacer />
      <div>
        <v-btn
          v-if="isLoggedIn"
          height="56px"
          prepend-icon="mdi-swap-horizontal"
          size="large"
          text="Trade your Steam keys"
          to="/vault/import"
          variant="tonal"
        />
        <v-btn
          v-else
          height="56px"
          prepend-icon="mdi-steam"
          size="large"
          text="Sign In through Steam"
          to="/login"
          variant="tonal"
        />

        <div class="d-flex align-center my-4">
          <v-divider />
          <span class="mx-4 text-button">or</span>
          <v-divider />
        </div>

        <v-row dense>
          <v-col
            cols="12"
            md="5"
          >
            <input-app-search
              v-model="have"
              clearable
              :disabled="!!want"
              hide-details
              label="Have"
              outlined
              placeholder="Cuphead"
            />
          </v-col>
          <v-col
            cols="12"
            md="5"
          >
            <input-app-search
              v-model="want"
              clearable
              :disabled="!!have"
              hide-details
              label="Want"
              outlined
              placeholder="Dying Light 2"
            />
          </v-col>
          <v-col
            cols="12"
            md="2"
          >
            <v-btn
              :block="!$vuetify.display.mdAndUp"
              :class="{ 'h-100 w-100': $vuetify.display.mdAndUp }"
              :icon="$vuetify.display.mdAndUp ? 'mdi-magnify' : undefined"
              :prepend-icon="$vuetify.display.mdAndUp ? undefined : 'mdi-magnify'"
              :rounded="$vuetify.display.mdAndUp || 'xs'"
              size="large"
              :text="$vuetify.display.mdAndUp ? undefined : 'Search'"
              :to="`/matches?app=${have || want}`"
              variant="tonal"
            />
            <!-- TODO: Match specifically for either have or want -->
          </v-col>
        </v-row>
      </div>
      <v-spacer />
    </v-card-text>
  </v-card>
</template>
