<script setup>
  const store = useSnackbarStore();
</script>

<template>
  <v-snackbar
    v-model="store.visible"
    close-on-content-click
    :color="store.type"
    :location="$vuetify.display.xs ? 'bottom' : 'top right'"
    :multi-line="$vuetify.display.xs"
    :timeout="store.timeout || 10000"
    timer="white"
    :width="$vuetify.display.xs ? 'calc(100% - 24px)' : undefined"
  >
    {{ store.message }}
    <template #action="{ attrs }">
      <v-btn
        :color="store.type"
        icon
        size="small"
        title="Sluiten"
        v-bind="attrs"
        @click="store.visible = false"
      >
        <v-icon
          icon="mdi-close"
          size="small"
        />
      </v-btn>
    </template>
  </v-snackbar>
</template>

<style lang="scss" scoped>
  .v-snackbar__timer {
    opacity: .5;
  }
</style>
