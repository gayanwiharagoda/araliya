# 0003. Expo for mobile

- Status: Accepted
- Date: 2026-06-24
- Deciders: DomusOS team

## Context

DomusOS needs a cross-platform mobile app (iOS + Android) built with React Native.

## Decision

Use Expo (managed workflow, SDK 56) with expo-router for file-based routing.

## Consequences

- Faster dev setup — no Xcode/Android Studio config required for basic development.
- OTA updates via EAS Update.
- File-based routing (expo-router) matches Next.js patterns, reducing cognitive load.
- Can eject to bare workflow if custom native modules are needed later.
- Some native libraries require Expo config plugins or custom dev builds.

## Alternatives considered

- **Bare React Native**: Full native control from day one, but significantly more setup (native toolchains, manual linking). Unnecessary overhead at project start — eject path exists if needed.
- **Flutter / other frameworks**: Would break React code sharing between web and mobile. Team has React expertise.
