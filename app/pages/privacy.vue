<script setup>
  const title = 'Privacy Policy';
  const breadcrumbs = [
    { title: 'Home', to: '/' },
    { title, disabled: true }
  ];

  useSeoMeta({ title, ogTitle: title });
</script>

<template>
  <s-page-content :breadcrumbs="breadcrumbs">
    <v-container>
      <h1>{{ title }}</h1>
      <p>Last updated: April 5, 2025</p>
    </v-container>

    <v-container>
      <h2>1. Introduction</h2>
      <p>This Privacy Policy explains how SteamKey.Trade (maintained by Revadike, hereinafter referred to as "we," "us," or "our") collects, uses, and protects information when you use our platform. We are committed to protecting your privacy and handling your data transparently.</p>
    </v-container>

    <v-container>
      <h2>2. Information Collection</h2>
      <p>2.1. We collect your public Steam profile information when you log in through Steam OpenID.</p>
      <p>2.2. Most information on our platform is public by default. Unless explicitly marked as private, any information you share may be visible to other users.</p>
      <p>2.3. We collect and store technical information necessary for platform operation and security.</p>
    </v-container>

    <v-container>
      <h2>3. Data Storage and Security</h2>
      <p>3.1. We use Supabase for secure data storage and authentication. Some data may be stored locally in your browser to improve performance and functionality.</p>
      <p>3.2. Your digital goods are protected by our encrypted vault system:</p>
      <ul>
        <li>All encryption happens locally on your device</li>
        <li>Your vault password is never transmitted to or stored on our servers</li>
        <li>Unencrypted content never leaves your device</li>
        <li>Even in case of a data breach, your encrypted items remain secure</li>
        <li>We cannot access or recover the contents of your vault</li>
      </ul>
    </v-container>

    <v-container>
      <h2>4. How We Use Your Information</h2>
      <p>Your information is used exclusively for:</p>
      <ul>
        <li>Operating the trading platform and its features</li>
        <li>Protecting users from fraud and abuse</li>
        <li>Improving the platform experience</li>
        <li>Sending important updates about the service</li>
        <li>Meeting legal requirements</li>
      </ul>
      <p>We do not use your data for advertising or analytics purposes.</p>
    </v-container>

    <v-container>
      <h2>5. Information Sharing</h2>
      <p>5.1. We do not sell your information or share it with third parties.</p>
      <p>5.2. Information may only be shared in these specific circumstances:</p>
      <ul>
        <li>When required by law</li>
        <li>To protect platform security</li>
        <li>To prevent fraud or abuse</li>
        <li>With your explicit permission</li>
      </ul>
    </v-container>

    <v-container>
      <h2>6. Security</h2>
      <p>6.1. We implement industry-standard security measures to protect user data and maintain platform integrity.</p>
      <p>6.2. In the event of any security issues, we will promptly notify affected users and take appropriate action to protect your information.</p>
    </v-container>

    <v-container>
      <h2>7. Your Privacy Rights</h2>
      <p>Under applicable privacy laws, you have the right to:</p>
      <ul>
        <li>Access your personal information</li>
        <li>Request corrections to your data</li>
        <li>Request deletion of your data</li>
        <li>Object to how your data is used</li>
        <li>Export your data</li>
      </ul>
      <p>For privacy-related requests, contact: revadike@outlook.com</p>
    </v-container>

    <v-container>
      <h2>8. Contact Us</h2>
      <p>If you have questions about this Privacy Policy or your data, reach out through:</p>
      <ul>
        <li>
          GitHub Issues: <a
            href="https://github.com/Revadike/SteamKey.Trade/issues/"
            rel="noopener"
            target="_blank"
          >https://github.com/Revadike/SteamKey.Trade/issues/</a>
        </li>
        <li>
          Discord: <a
            href="/discord"
            rel="noopener"
            target="_blank"
          >/discord</a>
        </li>
        <li>
          Steam Community: <a
            href="/steam"
            rel="noopener"
            target="_blank"
          >/steam</a>
        </li>
        <li>
          Email (GDPR requests only): <a
            href="mailto:revadike@outlook.com"
            rel="noopener"
            target="_blank"
          >revadike@outlook.com</a>
        </li>
      </ul>
    </v-container>
  </s-page-content>
</template>

<style lang="scss" scoped>
  ol, ul {
    margin-left: 3rem;
  }
</style>
