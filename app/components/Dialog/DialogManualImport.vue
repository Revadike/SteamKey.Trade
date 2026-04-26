<script setup>
  const { VaultEntry } = useORM();
  const internalValue = ref(false);
  const inputText = ref('');
  const isLoading = ref(false);

  const { searchMany } = useSearchApps();

  const selectedFormat = ref(0);

  const parseInput = input => {
    const data = {};
    switch (selectedFormat.value) {
      case 0:
        input.split('\n').forEach(line => {
          if (!line) {
            return;
          }

          data[line] = [];
        });
        break;
      case 1:
        input.split('\n').forEach(line => {
          if (!line) {
            return;
          }

          const [query, value] = line.split(/\t/);
          if (!data[query]) {
            data[query] = [];
          }

          if (value) {
            data[query].push(value);
          }
        });
        break;

      case 2:
        // eslint-disable-next-line no-case-declarations
        let query = null;
        input.split('\n').forEach(line => {
          if (!line) {
            query = null;
            return;
          }

          if (!query) {
            query = line;
            data[query] ??= [];
          } else {
            data[query].push(line);
          }
        });
        break;
    }

    return data;
  };

  const total = ref(0);
  const queried = ref(0);
  const emit = defineEmits(['import']);
  const importToVault = async () => {
    isLoading.value = true;

    const data = parseInput(inputText.value);
    total.value = Object.keys(data).length;

    const imports = [];
    const batchSize = 20;
    const queries = Object.keys(data);
    for (let i = 0; i < queries.length; i += batchSize) {
      if (internalValue.value === false) {
        break;
      }

      const batch = queries.slice(i, i + batchSize);
      const batchResults = await searchMany(batch);
      batchResults.forEach(({ query, results }) => {
        queried.value++;
        imports.push({
          query,
          values: data[query].concat(['']),
          type: VaultEntry.enums.type.key,
          suggestions: results.slice(0, 100),
          appid: results[0]?.item?.appid ?? null,
          name: results[0]?.item?.names?.[0] ?? query,
          score: results[0]?.score ?? 1
        });
      });
    }

    emit('import', imports);

    internalValue.value = false;
    isLoading.value = false;
  };
</script>

<template>
  <v-dialog
    v-model="internalValue"
    :persistent="isLoading"
    width="720"
  >
    <template #activator="attrs">
      <slot
        name="activator"
        v-bind="attrs"
      />
    </template>

    <template #default>
      <v-card :loading="isLoading">
        <v-card-title>
          Manual import
          <template v-if="isLoading">
            ({{ queried }}/{{ total }})
          </template>
        </v-card-title>
        <v-card-text>
          <p>
            Select which format fits your data best and paste it below.
          </p>

          <v-item-group
            v-model="selectedFormat"
            :disabled="isLoading"
            mandatory
          >
            <v-row class="mt-2">
              <v-col
                v-for="n in 3"
                :key="n"
                cols="12"
                md="4"
              >
                <v-item v-slot="{ isSelected, toggle }">
                  <v-card
                    :border="isSelected ? 'opacity-50 sm' : undefined"
                    :style="{ pointerEvents: isLoading ? 'none' : undefined }"
                    variant="tonal"
                    @click="toggle"
                  >
                    <v-card-title>
                      <v-icon
                        class="ma-0"
                        :icon="isSelected ? 'mdi-radiobox-marked' : 'mdi-radiobox-blank'"
                        size="x-small"
                      />
                    </v-card-title>
                    <v-card-text v-if="n === 1">
                      <p>Game A</p>
                      <p>Game B</p>
                      <p>Game C</p>
                    </v-card-text>
                    <v-card-text v-if="n === 2">
                      <p>Game A &nbsp; XXX-XXX-XXX</p>
                      <p>Game A &nbsp; YYY-YYY-YYY</p>
                      <p>Game B &nbsp; ZZZ-ZZZ-ZZZ</p>
                    </v-card-text>
                    <v-card-text v-if="n === 3">
                      <p>Game A</p>
                      <p>XXX-XXX-XXX</p>
                      <p>YYY-YYY-YYY</p>
                    </v-card-text>
                  </v-card>
                </v-item>
              </v-col>
            </v-row>
          </v-item-group>

          <v-textarea
            v-model="inputText"
            class="mt-4"
            :disabled="isLoading"
            hide-details
            variant="outlined"
          />
        </v-card-text>
        <v-card-actions>
          <v-btn @click="internalValue = false">
            {{ isLoading ? 'Abort' : 'Close' }}
          </v-btn>

          <v-spacer />

          <v-btn
            :disabled="isLoading"
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
