<script setup>
  const title = 'Terms and Conditions';
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
      <h2>1. Agreement to Terms</h2>
      <p>Welcome to SteamKey.Trade. These Terms and Conditions constitute a legally binding agreement made between you and SteamKey.Trade (maintained by Revadike, hereinafter referred to as "we," "us," or "our"), concerning your access to and use of the SteamKey.Trade website.</p>
      <p>By accessing or using our platform, you agree that you have read, understood, and agree to be bound by these Terms. If you disagree with any part of these terms, you may not access the website.</p>
      <p>We reserve the right to modify these Terms at any time. Significant changes will be announced through the platform, and your continued use constitutes acceptance of any modifications.</p>
    </v-container>

    <v-container>
      <h2>2. Platform Description</h2>
      <p>SteamKey.Trade is a community-driven platform primarily focused on Steam key trading, with support for other digital goods trading. The platform is maintained by Revadike as a personal project and operates under a self-governed, self-moderated system. The platform's software is open-source, while the database remains private.</p>
    </v-container>

    <v-container>
      <h2>3. User Accounts</h2>
      <p>3.1. Authentication is handled through Steam OpenID. By logging in, you grant us access to your public Steam profile information.</p>
      <p>3.2. You are responsible for maintaining the confidentiality of your account and password for any associated services (such as your encrypted vault).</p>
      <p>3.3. We cannot and will not recover lost vault passwords, as these are used for encryption and are not stored on our servers.</p>
      <p>3.4. We reserve the right to suspend or terminate your account at our sole discretion if you violate these Terms or engage in behavior that poses a risk to the platform or its users.</p>
    </v-container>

    <v-container>
      <h2>4. Trading Rules and Liability</h2>
      <p>4.1. Users are solely responsible for the digital goods they trade on the platform.</p>
      <p>4.2. We cannot verify the validity of traded items before trades and bear no responsibility for invalid or used items.</p>
      <p>4.3. The platform includes a reporting system for documenting scams or fraudulent trades. Reports are public and visible to all users.</p>
      <p>4.4. Trade partners are required to attempt to resolve disputes among themselves first.</p>
      <p>4.5. While we maintain the right to intervene in extreme cases, we typically do not mediate individual trade disputes.</p>
      <p>4.6. Users acknowledge that all trades are conducted at their own risk, and the platform serves only as a means of facilitating these trades.</p>
    </v-container>

    <v-container>
      <h2>5. Prohibited Activities</h2>
      <p>The following activities are prohibited:</p>
      <ul>
        <li>Knowningly trading invalid or fraudulent digital goods</li>
        <li>Engaging in any form of user harassment or misconduct</li>
        <li>Actions that compromise platform stability or performance</li>
        <li>Unauthorized access attempts to private user data</li>
        <li>Exploitation of platform vulnerabilities</li>
        <li>Any activity that violates applicable laws or regulations</li>
      </ul>
    </v-container>

    <v-container>
      <h2>6. Content and Features</h2>
      <p>6.1. Users can create and share collections of apps, participate in trades, chat, and use other platform features.</p>
      <p>6.2. The encrypted vault allows users to securely store their digital goods.</p>
      <p>6.3. We reserve the right to moderate or remove any content that violates these terms.</p>
      <p>6.4. While the core platform is provided free of charge, we may introduce optional paid features or accept donations to support operational costs.</p>
    </v-container>

    <v-container>
      <h2>7. Data Storage and Privacy</h2>
      <p>7.1. We use various storage systems including cookies, IndexedDB, and localStorage for platform functionality.</p>
      <p>7.2. User data is stored in a database and may be retained indefinitely.</p>
      <p>7.3. The platform integrates with third-party services and APIs. We are not responsible for the privacy practices or content of these third-party services.</p>
      <p>7.4. For GDPR-related requests, please contact: revadike@outlook.com</p>
      <p>7.5. Your encrypted vault data remains private and inaccessible to us. We do not store or have access to vault passwords.</p>
    </v-container>

    <v-container>
      <h2>8. Security Measures</h2>
      <p>8.1. We implement reasonable security measures to protect user data and maintain platform integrity.</p>
      <p>8.2. In the event of a security breach:</p>
      <ol>
        <li>We will assess the scope and impact of the breach</li>
        <li>Affected users will be notified within 72 hours</li>
        <li>We will document compromised data and take corrective actions</li>
        <li>Users will be advised of any necessary actions they should take</li>
      </ol>
      <p>8.3. Users are responsible for maintaining the security of their own accounts and passwords.</p>
    </v-container>

    <v-container>
      <h2>9. Service Availability</h2>
      <p>9.1. While we strive for consistent uptime, we make no guarantees regarding service availability.</p>
      <p>9.2. The platform may be unavailable during maintenance or updates.</p>
      <p>9.3. We are not liable for any losses or inconveniences caused by service interruptions.</p>
      <p>9.4. During downtime, all services including the vault may be inaccessible.</p>
    </v-container>

    <v-container>
      <h2>10. Support and Communication</h2>
      <p>
        10.1. Technical issues and feature requests should be reported through our GitHub repository at <a
          href="https://github.com/Revadike/SteamKey.Trade/issues/"
          rel="noopener"
          target="_blank"
        >https://github.com/Revadike/SteamKey.Trade/issues/</a>
      </p>
      <p>10.2. User support is provided through our Discord server and Steam Community group.</p>
      <p>10.3. Response times vary based on community and maintainer availability.</p>
    </v-container>

    <v-container>
      <h2>11. Intellectual Property</h2>
      <p>11.1. The platform's software is open-source and subject to its respective license terms.</p>
      <p>11.2. Users retain ownership of their content and data submitted to the platform.</p>
      <p>11.3. By using the platform, you grant us a non-exclusive license to use, store, and display your content for the purpose of providing platform services.</p>
    </v-container>

    <v-container>
      <h2>12. Disclaimer of Warranties</h2>
      <p>THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT ANY WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT GUARANTEE THE ACCURACY, COMPLETENESS, OR USEFULNESS OF ANY INFORMATION ON THE PLATFORM AND CANNOT BE HELD LIABLE FOR ANY LOSSES OR DAMAGES ARISING FROM YOUR USE OF THE PLATFORM.</p>
    </v-container>

    <v-container>
      <h2>13. Limitation of Liability</h2>
      <p>IN NO EVENT SHALL STEAMKEY.TRADE, ITS MAINTAINER, OR CONTRIBUTORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:</p>
      <ul>
        <li>YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE THE PLATFORM</li>
        <li>ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE PLATFORM</li>
        <li>ANY CONTENT OBTAINED FROM THE PLATFORM</li>
        <li>UNAUTHORIZED ACCESS, USE OR ALTERATION OF YOUR TRANSMISSIONS OR CONTENT</li>
      </ul>
    </v-container>

    <v-container>
      <h2>14. Contact Information</h2>
      <p>For questions about these Terms and Conditions, please contact us through:</p>
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

    <!--
    Additional clauses pending possible implementation:
    3.4. We implement additional account restrictions or requirements to prevent abuse.
    4.6. Trading restrictions are implemented based on user history and successful trade count.
    6.4. Premium features are available for donors.
    10.4. Email support is available.
    -->
  </s-page-content>
</template>

<style lang="scss" scoped>
  ol, ul {
    margin-left: 3rem;
  }
</style>
