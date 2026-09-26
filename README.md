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

- `API_BASE_URL`: The URL of your local or staging backend API proxy (e.g., `http://localhost:3000` or the Cloud Run URL).
- `USE_MOCK_AI`: Set to `true` to use mock AI fixtures (no backend API request) or `false` to connect to the actual backend API.
- `USE_MOCK_OCR`: Set to `true` to mock OCR extraction.

### Step 3: Run the Application

First, start Metro (the JavaScript bundler):

```sh
yarn start
```

In a new terminal window/pane, build and run the app:

#### iOS

```sh
yarn ios
```

#### Android

```sh
yarn android
```

---

## 📁 Repository Structure

```text
android/                     # Android native project folder
ios/                         # iOS native project folder
src/                         # Mobile application source code
  app/
    navigation/              # Navigation config (React Navigation)
  components/                # Common UI components (buttons, cards, etc.)
  data/                      # Local data and constants
  modules/                   # Feature modules (input, ocr, ai-analysis, lesson, etc.)
  release/                   # Release config and feature registry
  services/                  # Shared services (AI triggers, database)
  shared/                    # Shareable utils, api client, database wrapper, fixtures
  store/                     # Global state (e.g. Zustand)
  theme/                     # Theme system and styles
docs/                        # BA & Technical documentation
```

---

## 📚 Documentation

The BA (Business Analysis) and technical documentation are located in the [docs/](docs) directory:

- [Product Overview](docs/01_Product_Overview.md): Project positioning, target users, and Phase 0 scope.
- [BA README](docs/01-ba/README.md): Entry point for all documentation roles.
- [Technical Implementation Spec](docs/01-ba/02-technical/01-technical-implementation-spec.md): Technical stack, database models, API specs, and directory structures.
- [Phase 0 Implementation Plan](docs/01-ba/02-technical/02-implementation-plan-m1-m5.md): Step-by-step milestones (M0-M5) for building the application.
