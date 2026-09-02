# SteamKey.Trade

SteamKey.Trade is a community-driven platform where gamers can safely and easily trade their Steam keys, built by [admiring open-source contributors](https://github.com/Revadike/SteamKey.Trade/graphs/contributors) and gamers alike.

## Requirements

- **[Node.js v24](https://nodejs.org/)** – A JavaScript runtime with improved security and performance.
- **[Docker](https://www.docker.com/)** – A platform for containerized application deployment.
- **[Deno](https://deno.com/)** - A open-source JavaScript runtime for the modern web.

## Instructions

### Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Revadike/SteamKey.Trade.git
   cd SteamKey.Trade
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the Supabase stack:**

   ```bash
   npm run supabase:start
   ```

4. **Set up environment local variables:**

   Copy `.env.example` to `.env.local` and run:
     ```bash
     npx supabase status
     ```
   Enter the API_URL as `SUPABASE_URL` and anon key as `SUPABASE_KEY`.
   
   Inside the supabase folder, copy `.env.example` to `.env.local` and enter the environment variables.

5. **(Optional) Set up environment production variables:**

   Copy `.env.example` to `.env` and enter the URL and API key from [here](https://supabase.com/dashboard/project/_/settings/api).
   
   Inside the supabase folder, copy `.env.example` to `.env.prod` and enter the environment variables.

6. **(Optional) Supabase login:**
   ```bash
   npx supabase login
   ```

7. **(Optional) Supabase link:**
   ```bash
   npx supabase link
   ```

8. **Start the development server:**
   ```bash
   npm run dev:local
   ```

9. **More information:**
   - [Supabase Local Development](https://supabase.com/docs/guides/local-development/overview)
   - [Nuxt Development](https://nuxt.com/docs/getting-started/introduction)

### Branches
- **[`master`](https://github.com/Revadike/SteamKey.Trade/tree/master):**

   The main branch, which is used for production. This branch should always be stable. Every change will be deployed to production.

- **[`develop`](https://github.com/Revadike/SteamKey.Trade/tree/develop):**

   The development branch, which is used for development. This branch can be unstable. Use this branch for submitting pull requests.

### Database
Changes to the database are tracked through migration files, located in `supabase/migrations`. Best to do this in a local environment first, before pushing to production. There are three ways to make new migrations:

1. **(Recommended) Edit Schema Definitions:**

   You can edit the [declarative database schemas](https://supabase.com/docs/guides/local-development/declarative-database-schemas) located in `supabase/schemas`. You can alter and test the schema definitions (including RLS and triggers), and if you're happy with the change, you can generate a new migration using `supabase stop && supabase db diff -s public -f patch` (replace `patch` with a name describing the change), or [supabase:diff](#npm-scripts). *Always review your generated migration files for correctness.*
   
3. **Via Studio:**

   If you like to avoid writing raw SQL for migrations, this is the way for you. Make changes to your local database via the [Supabase studio](http://localhost:54323). Then simply run the [supabase:pull](#npm-scripts) command to generate new migrations based on your changes. *Always review your generated migration files for correctness.* Make sure to update the `supabase/schemas` files with the changes you made in the studio.

5. **Manually:**

   If you rather want to write your own migration files, start with `npx supabase migration new patch` (replace `patch` with a name describing the change). This will generate a new empty migration in `supabase/migrations/<timestamp>_patch.sql`. In here, you can write in SQL the changes you wish to apply to the database. Once done, test them by applying these changes to your local database via [supabase:push](#npm-scripts). Make sure to update the `supabase/schemas` files with the changes you made in the migration.

### Functions
Supabase has so-called Edge functions, which are serverside functions developed with Deno. To create a new function, create `index.js` in `supabase/functions/my-function/` (replace `my-function` with the name of your function). In here, you can write your Deno code. Find more information on how to write these functions [here](https://supabase.com/docs/guides/functions). Finally, add the function to `supabase/config.toml`: 
```toml
[functions.my-function]
# verify_jwt = false # Skip JWT verification
entrypoint = './functions/my-function/index.js'
```

## Documentation
- **[MDI Library](https://pictogrammers.com/library/mdi/)** – Open-source Material Design icons.  
- **[Vuetify](https://vuetifyjs.com/)** – A Vue.js UI framework with pre-built components.  
- **[Vue.js](https://vuejs.org/)** – A JavaScript framework for building reactive web apps.
- **[Nuxt](https://nuxt.com/)** – A Vue.js framework with SSR, SSG, and built-in routing.  
- **[NuxtSupabase](http://supabase.nuxtjs.org/)** – A Nuxt module for easy Supabase integration.  
- **[Supabase](https://supabase.com/)** – An open-source backend with PostgreSQL and auth.  
- **[Supabase JS](https://supabase.com/docs/reference/javascript/)** – JavaScript client for interacting with Supabase services.  

## NPM Scripts

| Command                       | Description                                                                                               |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| **`npm run dev:local`**       | Starts the Supabase functions watcher and Nuxt development server.                                        |
| **`npm run dev:prod`**        | Starts the Nuxt development server using the live database (be careful).                                  |
| **`npm run supabase:start`**  | Starts the local Supabase stack.                                                                          |
| **`npm run supabase:stop`**   | Stops the local Supabase stack.                                                                           |
| **`npm run supabase:status`** | Checks the status of the local Supabase server.                                                           |
| **`npm run supabase:reset`**  | Resets the local Supabase database, applying the migrations and seeding data.                             |
| **`npm run supabase:pull`**   | Pulls schema changes from local database and generates migrations.                                        |
| **`npm run supabase:diff`**   | Diffs schema changes from your schema definitions in `supabase/schemas` and generates migrations.         |
| **`npm run supabase:push`**   | Applies new migrations to local database.                                                                 |
| **`npm run supabase:deploy`** | Deploys edge functions and the migrations to the remote Supabase database.                                |
| **`npm run supabase:dump`**   | Dumps the remote database data to `supabase/seed.sql` and local database schema to `supabase/schema.sql`. |
| **`npm run supabase:types`**  | Generates TypeScript types for the Supabase database.                                                     |
| **`npm run cache:clear`**     | Clears the Nuxt and node_modules cache.                                                                   |
| **`npm run git:merge`**       | Merges the development branch into the master branch.                                                     |
| **`npm run lint`**            | Runs ESLint and Supabase Lint to check for linting errors.                                                |
| **`npm run lint:fix`**        | Runs ESLint and automatically fixes linting errors.                                                       |
| **`npm run build`**           | Builds the Nuxt application for production.                                                               |
| **`npm run start`**           | Starts the Nuxt application in production mode.                                                           |
| **`npm run generate`**        | Generates a static version of the Nuxt application.                                                       |
| **`npm run preview`**         | Previews the generated static application.                                                                |
| **`npm run postinstall`**     | Runs Nuxt prepare after installing dependencies.                                                          |
| **`npm run deploy`**          | Runs `git:merge` and `supabase:deploy`, which deploys new changes to production.                          |
