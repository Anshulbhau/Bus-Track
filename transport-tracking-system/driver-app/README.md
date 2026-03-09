# CityTransit Driver App

A React Native / Expo app for bus drivers to manage trips and share real-time location.

## Tech Stack

- **Expo** (SDK 53) with Expo Router for navigation
- **Supabase** for authentication, database, and real-time updates
- **expo-location** for GPS tracking
- **AsyncStorage** for persistent auth sessions

## Project Structure

```
driver-app/
├── app/
│   ├── _layout.tsx          # Root layout + protected routing
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx        # Login screen (driver-only)
│   └── (tabs)/
│       ├── _layout.tsx      # Tab bar navigation
│       ├── dashboard.tsx    # My Trips (list, start trip)
│       ├── active-trip.tsx  # Active trip + live GPS tracking
│       └── profile.tsx      # Driver profile & sign out
├── src/
│   ├── context/
│   │   └── AuthContext.tsx  # Auth state + role enforcement
│   ├── lib/
│   │   └── supabase.ts      # Supabase client (AsyncStorage)
│   └── types/
│       └── database.ts      # Shared DB types
├── app.json
├── babel.config.js
├── package.json
└── tsconfig.json
```

## Getting Started

### 1. Install dependencies

```bash
cd transport-tracking-system/driver-app
npm install
```

### 2. Start the dev server

```bash
npm start
# or
npx expo start
```

### 3. Open on device

- **iOS Simulator**: Press `i` in the Expo CLI
- **Android Emulator**: Press `a` in the Expo CLI
- **Physical device**: Install [Expo Go](https://expo.dev/client) and scan the QR code

## Features

| Screen | Description |
|--------|-------------|
| **Login** | Email/password auth — only `role = 'driver'` profiles are allowed |
| **My Trips** | Shows all trips assigned to the logged-in driver with status badges |
| **Active Trip** | Starts/stops GPS location sharing; writes to `bus_locations` table every 5s |
| **Profile** | Shows driver info from Supabase `profiles` table |

## Supabase Tables Used

| Table | Usage |
|-------|-------|
| `profiles` | Driver auth, name/phone, role check |
| `trips` | Fetch assigned trips, update status (`scheduled → running → completed`) |
| `buses` | Bus number displayed on trip cards |
| `routes` | Route name, start/end locations |
| `bus_locations` | Inserts real-time GPS coordinates while trip is running |
