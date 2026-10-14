# LingoBites Mobile App

LingoBites is a mobile application concept designed for Vietnamese speakers who are new to English, helping them learn from real-world English content. The app turns everyday English text (captured via camera, imported from gallery, or pasted) into interactive, structured lessons in Vietnamese.

This repository contains the mobile client application built using **React Native CLI** and **TypeScript**.

The backend API proxy is located in the separate `LingoBites-Server` repository.

---

## 🚀 Getting Started

### Prerequisites

Ensure you have completed the [React Native Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide for React Native CLI.

### Step 1: Clone and Install Dependencies

```sh
# Clone the repository
git clone <repo-url> LingoBites-App
cd LingoBites-App

# Install JavaScript dependencies with the canonical package manager
corepack enable
yarn install --frozen-lockfile

# For iOS, install CocoaPods
bundle install
bundle exec pod install
```

Yarn Classic is the canonical package manager for this repository. Keep
`yarn.lock` as the only JavaScript dependency lockfile; do not commit npm or
pnpm lockfiles.

### Step 2: Configure Environment Variables

Copy `.env.example` to create your local environment file:

```sh
cp .env.example .env.development
```

Edit `.env.development` and set:

- `APP_ENV`: `local` for development, or `staging` / `production`.
- `API_BASE_URL`: The URL of the LingoBites-Server API (e.g., `http://localhost:3000` locally or the Cloud Run URL). Required; staging and production need HTTPS.
- `SUPPORT_EMAIL`: Optional; the support address shown in the app.

The other keys in `.env.example` are read by the native iOS/Android builds (app name, bundle IDs, versions, icon, launch screen). There is no mock mode in the app: AI and OCR always go through the server.

### Step 3: Run the Application

First, start Metro (the JavaScript bundler):

```sh
yarn start
```

In a new terminal window/pane, build and run the app for the development environment:

```sh
yarn ios:dev       # iOS simulator, Development scheme
yarn android:dev   # Android, development flavor
```

Use the `:staging` and `:production` variants (`yarn ios:staging`, `yarn android:production`, ...) to point at the other environments. Each one reads its own `.env.<environment>` file.

### Checks

```sh
yarn lint        # ESLint + module boundaries + warning budget
yarn typecheck
yarn test        # Jest
```

---

## 📁 Repository Structure

```text
android/, ios/   # Native projects (development / staging / production flavors)
src/
  app/           # App root, launch gate, navigation
  features/      # One folder per feature; index.ts is its only public entry
  ui/            # Design system: components, icons, theme
  core/          # Infrastructure: api, auth, db (SQLite), sync, schemas, release flags, i18n
  test/          # Test support and cross-feature integration tests
tools/           # Content lint for lesson packages
docs/            # Architecture, design, operations; older BA docs in docs/legacy/
```

Imports only go down `app -> features -> ui -> core`; `yarn lint:boundaries` enforces it (see [docs/architecture/module-boundaries.md](docs/architecture/module-boundaries.md)).

---

## 📚 Documentation

The BA (Business Analysis) and technical documentation are located in the [docs/](docs) directory:

- [Product Overview](docs/01_Product_Overview.md): Project positioning, target users, and Phase 0 scope.
- [Docs index](docs/README.md): Where each kind of documentation lives.
- [Architecture](docs/architecture/): Module boundaries, navigation, offline mode, code conventions.
- [BA README (legacy)](docs/legacy/01-ba/README.md): Entry point for all documentation roles.
- [Technical Implementation Spec](docs/legacy/01-ba/02-technical/01-technical-implementation-spec.md): Technical stack, database models, API specs, and directory structures.
- [Phase 0 Implementation Plan](docs/legacy/01-ba/02-technical/02-implementation-plan-m1-m5.md): Step-by-step milestones (M0-M5) for building the application.
