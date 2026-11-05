/// <reference types="expo/types" />

// Committed copy of what Expo writes into the gitignored `expo-env.d.ts`.
// `expo start` regenerates that file locally, but CI never runs Expo, so without
// this reference `tsc --noEmit` there would miss Expo's global types.
