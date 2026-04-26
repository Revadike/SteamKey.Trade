<script setup>
  const emit = defineEmits(['import']);
  const props = defineProps({
    appid: {
      type: [String, Number],
      required: true
    }
  });

  const { user } = useAuthStore();
  const { VaultEntry } = useORM();

  const internalValue = defineModel({ type: Boolean, default: false });
  const item = ref({ appid: props.appid, type: VaultEntry.enums.type.key, values: [''] });
  const loading = ref(false);

  const { encrypt } = useVaultSecurity();
  const encrypted = ref(false);
  const encryptAll = async () => {
    loading.value = true;

    const entries = item.value.values.filter(Boolean);
    const encryptedEntries = await Promise.all(entries.map(entry => encrypt(entry)));
    item.value.values = encryptedEntries;

    encrypted.value = true;
    loading.value = false;
  };

  const supabase = useSupabaseClient();
  const importToVault = async () => {
    loading.value = true;

    try {
      item.value.values = item.value.values.filter(Boolean);
      await VaultEntry.addValues(supabase, user.id, [item.value]);

      // Reset
      encrypted.value = false;
      item.value.type = VaultEntry.enums.type.key;
      item.value.values = [''];

      internalValue.value = false;
      emit('import');
    } catch (error) {
      console.error('Error importing to vault:', error);
    } finally {
      loading.value = false;
    }
  };

</script>

<template>
  <v-dialog
    v-model="internalValue"
    width="500"
  >
    <template #activator="attrs">
      <slot
        name="activator"
        v-bind="attrs"
      />
    </template>

    <template #default>
      <v-card :loading="loading">
        <v-card-title>
          Add Vault Entries
        </v-card-title>
        <v-card-text>
          <v-sheet rounded>
            <nuxt-link
              rel="noopener"
              target="_blank"
              :to="`/app/${appid}`"
            >
              <v-img
                v-ripple
                :alt="`App ${appid}`"
                cover
                height="150"
                lazy-src="/applogo.svg"
                :src="`https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`"
              />
            </nuxt-link>

            <div class="d-flex flex-column ga-2 mt-4 overflow-y-auto">
              <input-vault-entries
                v-model="item"
                :disabled="loading || encrypted"
                :encrypted="encrypted"
                @update:encrypted="val => encrypted = val"
              />
            </div>
          </v-sheet>
        </v-card-text>
        <v-card-actions>
          <v-btn
            :disabled="loading"
            variant="text"
            @click="internalValue = false"
          >
            Cancel
          </v-btn>

          <v-spacer />

          <v-btn
            v-if="!encrypted"
            :loading="loading"
            variant="tonal"
            @click="encryptAll"
          >
            Encrypt
          </v-btn>
          <v-btn
            v-else
            :loading="loading"
            variant="tonal"
            @click="importToVault"
          >
            Import
          </v-btn>
        </v-card-actions>
      </v-card>
    </template>
  </v-dialog>
</template>