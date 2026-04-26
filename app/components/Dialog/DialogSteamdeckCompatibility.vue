<script setup>
  // https://github.com/SteamDatabase/SteamTracking/blob/master/ClientExtracted/steamui/localization/shared_english.json#L2358C1-L2408C1
  const labels = {
    SteamDeckVerified_TestResult_DefaultControllerConfigFullyFunctional: 'All functionality is accessible when using the default controller configuration',
    SteamDeckVerified_TestResult_ControllerGlyphsMatchDeckDevice: 'This game shows Steam Deck controller icons',
    SteamDeckVerified_TestResult_DefaultConfigurationIsPerformant: 'This game\'s default graphics configuration performs well on Steam Deck',
    SteamDeckVerified_TestResult_InterfaceTextIsLegible: 'In-game interface text is legible on Steam Deck',
    SteamDeckVerified_TestResult_DefaultControllerConfigNotFullyFunctional: 'Some functionality is not accessible when using the default controller configuration, requiring use of the touchscreen or virtual keyboard, or a community configuration',
    SteamDeckVerified_TestResult_ControllerGlyphsDoNotMatchDeckDevice: 'This game sometimes shows mouse, keyboard, or non-Steam-Deck controller icons',
    SteamDeckVerified_TestResult_DefaultConfigurationIsNotPerformant: 'This game requires manual configuration of graphics settings to perform well on Steam Deck',
    SteamDeckVerified_TestResult_TextInputDoesNotAutomaticallyInvokesKeyboard: 'Entering some text requires manually invoking the on-screen keyboard',
    SteamDeckVerified_TestResult_InterfaceTextIsNotLegible: 'Some in-game text is small and may be difficult to read',
    SteamDeckVerified_TestResult_NativeResolutionNotSupported: 'This game doesn\'t support Steam Deck\'s native display resolution and may experience degraded performance',
    SteamDeckVerified_TestResult_NativeResolutionNotDefault: 'This game supports Steam Deck\'s native display resolution but does not set it by default and may require you to configure the display resolution manually',
    SteamDeckVerified_TestResult_DisplayOutputHasNonblockingIssues: 'This game has minor graphics/display issues on Steam Deck',
    SteamDeckVerified_TestResult_AudioOutputHasNonblockingIssues: 'This game has minor audio issues on Steam Deck',
    SteamDeckVerified_TestResult_DeviceCompatibilityWarningsShown: 'This game displays compatibility warnings when running on Steam Deck, but runs fine',
    SteamDeckVerified_TestResult_LauncherInteractionIssues: 'This game\'s launcher/setup tool may require the touchscreen or virtual keyboard, or have difficult to read text',
    SteamDeckVerified_TestResult_VideoPlaybackHasNonblockingIssues: 'Some in-game movie content may be missing',
    SteamDeckVerified_TestResult_GameOrLauncherDoesntExitCleanly: 'This game does not exit cleanly and may require you to manually quit via the Steam overlay',
    SteamDeckVerified_TestResult_AuxFunctionalityNotAccessible_MapEditor: 'Some auxiliary functionality is not accessible on Steam Deck: map editor',
    SteamDeckVerified_TestResult_MultiWindowAppAutomaticallySetsFocus: 'This game uses multiple windows and may require you to focus the appropriate windows manually via the Steam overlay',
    SteamDeckVerified_TestResult_DisplayOutputNotCorrectlyScaled: 'This game is incorrectly scaled on Steam Deck and may require you to configure the display resolution manually',
    SteamDeckVerified_TestResult_ResumeFromSleepNotFunctional: 'This game may experience temporary issues after sleeping on Steam Deck',
    SteamDeckVerified_TestResult_GamepadNotEnabledByDefault: 'This game requires manually enabling controller support using in-game settings',
    SteamDeckVerified_TestResult_CloudSavesNotEnabledByDefault: 'This game requires manually enabling Steam Cloud support for saved games using in-game settings',
    SteamDeckVerified_TestResult_NotFullyFunctionalWithoutExternalKeyboard: 'Parts of this game would benefit from using an external keyboard',
    SteamDeckVerified_TestResult_NotFullyFunctionalWithoutExternalWebcam: 'This game requires certain external devices: Webcam',
    SteamDeckVerified_TestResult_NotFullyFunctionalWithoutExternalUSBGuitar: 'This game requires certain external devices: USB Guitar',
    SteamDeckVerified_TestResult_SteamOSDoesNotSupport: 'Valve is still working on adding support for this game on Steam Deck',
    SteamDeckVerified_TestResult_SteamOSDoesNotSupport_VR: 'Steam Deck does not support VR games',
    SteamDeckVerified_TestResult_SteamOSDoesNotSupport_Software: 'This is a Software title and is not supported on Steam Deck',
    SteamDeckVerified_TestResult_SteamOSDoesNotSupport_Retired: 'This game has been retired or is no longer in a playable state and is not supported on Steam Deck',
    SteamDeckVerified_TestResult_UnsupportedAntiCheat_Other: 'This game is unsupported on Steam Deck due to use of an unsupported anti-cheat or multiplayer service',
    SteamDeckVerified_TestResult_UnsupportedAntiCheatConfiguration: 'This game\'s anti-cheat is not configured to support Steam Deck',
    SteamDeckVerified_TestResult_UnsupportedGraphicsPerformance: 'This game\'s graphics settings cannot be configured to run well on Steam Deck',
    SteamDeckVerified_TestResult_SteamOSDoesNotSupport_OperatingSystem: 'This game requires an operating system that is not currently supported on Steam Deck',
    SteamDeckVerified_TestResult_FirstTimeSetupRequiresActiveInternetConnection: 'This game\'s first-time setup requires an active Internet connection',
    SteamDeckVerified_TestResult_SingleplayerGameplayRequiresActiveInternetConnection: 'Singleplayer gameplay requires an active Internet connection',
    SteamDeckVerified_TestResult_CrossPlatformCloudSavesNotSupported: 'This game does not support cross-platform saved games',
    SteamDeckVerified_TestResult_ExternalControllersNotSupportedPrimaryPlayer: 'This game does not default to external Bluetooth/USB controllers on Deck, and may require manually switching the active controller via the Quick Access Menu',
    SteamDeckVerified_TestResult_ExternalControllersNotSupportedLocalMultiplayer: 'This game does not support external Bluetooth/USB controllers on Deck for local multiplayer',
    SteamDeckVerified_TestResult_SimultaneousInputGyroTrackpadFriendly: 'This game supports using the gyro/trackpad in mouse mode for camera controls with gamepad controls for movement',
    SteamDeckVerified_TestResult_HDRMustBeManuallyEnabled: 'This game supports HDR but it must be manually enabled using in-game settings',
    SteamDeckVerified_DescriptionHeader: 'Valve’s testing indicates this title is %1$s on Steam Deck. %2$s',
    SteamDeckVerified_DescriptionHeader_Verified: 'This game is fully functional on Steam Deck, and works great with the built-in controls and display.',
    SteamDeckVerified_DescriptionHeader_Playable: 'This game is functional on Steam Deck, but might require extra effort to interact with or configure.',
    SteamDeckVerified_DescriptionHeader_Unsupported: 'Some or all of this game currently doesn\'t function on Steam Deck.',
    SteamDeckVerified_DescriptionHeader_Unknown: 'Valve is still learning about this title. We do not currently have further information regarding Steam Deck compatibility.',
    SteamDeckVerified_ViewDeveloperPost: 'View Developer Post'
  };

  const formatLabel = (labelKey, ...args) => {
    labelKey = labelKey.replace(/^#/, ''); // Remove leading hash
    if (!labels[labelKey]) {
      return labelKey.split('_').pop().replace(/([A-Z])/g, ' $1').trim();
    }

    return labels[labelKey].replace(/%(\d+)\$s/g, (_, i) => args[i - 1]);
  };

  const categories = {
    0: {
      label: 'Unknown',
      icon: 'mdi-help-circle-outline',
      color: 'disabled'
    },
    1: {
      label: 'Unsupported',
      icon: 'mdi-cancel',
      color: 'primary'
    },
    2: {
      label: 'Playable',
      icon: 'mdi-information',
      color: 'warning'
    },
    3: {
      label: 'Verified',
      icon: 'mdi-check-circle',
      color: 'success'
    }
  };

  const props = defineProps({
    appid: {
      type: Number,
      required: true
    }
  });

  const internalValue = ref(false);
  const loaded = ref(false);

  const { data: report, status, error } = useSupabaseData('steamdeck-compatibility', { appid: props.appid }, {
    watch: [
      () => internalValue.value || loaded.value,
      () => props.appid
    ]
  });

  watch(() => report.value, report => {
    if (report) {
      loaded.value = true;
    }
  });

  const snackbarStore = useSnackbarStore();
  watch(() => error.value, error => {
    if (error) {
      console.error(error);
      snackbarStore.set('error', 'Error loading Steam Deck compatibility report');
      internalValue.value = false;
    }
  });

  // watch(() => internalValue.value, value => {
  //   if (value && !report.value) {
  //     loading.value = true;
  //   }
  // });
</script>

<template>
  <v-dialog
    v-model="internalValue"
    width="720"
  >
    <template #activator="attrs">
      <slot
        name="activator"
        v-bind="attrs"
      />
    </template>

    <v-card
      v-if="status === 'pending'"
      class="pa-4"
      loading
    >
      <v-card-title class="text-h4 font-weight-bold d-flex align-center">
        Steam Deck Compatibility
      </v-card-title>
      <v-card-actions>
        <v-btn
          variant="text"
          @click="internalValue = false"
        >
          Close
        </v-btn>
      </v-card-actions>
    </v-card>
    <v-card
      v-else-if="report"
      class="pa-2"
    >
      <v-card-title class="text-h4 font-weight-bold d-flex align-center">
        Steam Deck Compatibility
        <v-icon
          v-tooltip:top="categories[report.resolved_category].label"
          class="mt-n1 ml-1"
          :color="categories[report.resolved_category].color"
          :icon="categories[report.resolved_category].icon"
          size="32"
        />
      </v-card-title>

      <v-card-text>
        <p>
          {{ formatLabel(
            'SteamDeckVerified_DescriptionHeader',
            categories[report.resolved_category].label,
            labels[`SteamDeckVerified_DescriptionHeader_${categories[report.resolved_category].label}`]
          ) }}
        </p>

        <v-divider
          v-if="report.resolved_items.length > 0"
          class="my-4"
          color="primary"
        />

        <table style="border-collapse: separate; border-spacing: 0 .5em;">
          <tr
            v-for="{ display_type, loc_token	} in report.resolved_items"
            :key="loc_token"
          >
            <td>
              <v-icon
                class="mr-4"
                :color="categories[display_type - 1].color"
                :icon="display_type === 1 ? '' : categories[display_type - 1].icon"
              />
            </td>
            <td>
              <span :class="{ 'text-disabled font-italic': display_type === 1 }">
                {{ formatLabel(loc_token) }}
              </span>
            </td>
          </tr>
        </table>
      </v-card-text>

      <v-card-actions>
        <v-btn
          variant="text"
          @click="internalValue = false"
        >
          Close
        </v-btn>
        <v-spacer />
        <v-btn
          v-if="report.steam_deck_blog_url"
          color="primary"
          :href="report.steam_deck_blog_url"
          rel="noopener"
          target="_blank"
          variant="tonal"
        >
          {{ formatLabel('SteamDeckVerified_ViewDeveloperPost') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
