<script setup>
  const password = defineModel({
    type: String,
    default: ''
  });

  defineProps({
    label: {
      type: String,
      default: 'Password'
    },
    rules: {
      type: Array,
      default: () => [v => !!v || 'Password is required']
    }
  });

  const show = ref(false);
</script>

<template>
  <v-text-field
    v-model="password"
    :append-inner-icon="show ? 'mdi-eye-off' : 'mdi-eye'"
    :label="label"
    :rules="rules"
    :type="show ? 'text' : 'password'"
    @click:append-inner="show = !show"
  />
</template>