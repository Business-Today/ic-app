# BT IC app

Expo app for the 52nd International Conference. See the project root README for the
documentation link.

## NFC check-in (staff)

Attendance is taken by tapping each attendee's NFC tag against a staff phone.

1. **Database (one time):** run `supabase/migrations/20261003_add_nfc_tag_id.sql` in the
   Supabase SQL editor. It adds `attendeeProfile.nfcTagId` with a unique index.
2. **Build:** NFC uses a native module (`react-native-nfc-manager`), so it does **not** work in
   Expo Go. Make a new development build after pulling this change:

   ```bash
   npx expo prebuild --clean     # only if you build locally
   eas build --profile development --platform ios      # or android
   ```

   The config plugin in `app.json` adds the iOS NFC entitlement, `NFCReaderUsageDescription`
   and the Android NFC permission. On iOS the "Near Field Communication Tag Reading"
   capability must be enabled on the App ID; EAS does this automatically from the entitlement.

   **Building locally on your own Apple account?** `org.businesstoday.ic` belongs to Business
   Today's Apple team, so Xcode cannot sign it with a personal team and falls back to a wildcard
   profile that lacks NFC and push. Use a dev-only bundle ID on your own (paid) team instead:

   ```bash
   export IC_LOCAL_BUNDLE_ID=org.businesstoday.ic.dev   # any unique ID on your team
   export IC_APPLE_TEAM_ID=XXXXXXXXXX                   # optional, your team ID
   npx expo prebuild --platform ios --clean
   npx expo run:ios --device
   ```

   `app.config.js` applies the override only while those variables are set. Push notifications
   will not register under the dev ID; everything else, including NFC, works. Never set these
   for EAS or production builds.
3. **Assign tags:** Attendance tab (Princeton accounts only) → *Assign NFC tags to attendees*.
   Search for the attendee, select them, then tap the tag you are handing them. A tag that was
   already assigned asks before being moved. *Who owns this tag?* looks up any tag.
4. **Check in:** Attendance tab → pick the day and event → *Tap NFC tags to check in*. Keep
   tapping tags; each tap looks up the tag's owner and records attendance with the same rules as
   before (seminar registration check, no duplicates, `attendanceHistory` row). On iOS the system
   NFC sheet stays open for about a minute at a time; press *Start scanning* to open it again.
   Tapping an unassigned tag offers a shortcut to assign it.

The attendee-facing QR tab is unchanged and still powers networking.

### Xcode 26.2 build fix

`patches/expo-modules-jsi+57.1.0.patch` makes `expo-modules-jsi` compile with Swift 6.2.x
(Xcode 26.2 to 26.4), which otherwise fails the iOS build twice:

- `RuntimeScheduler.h`: drops a `SWIFT_RETURNS_RETAINED` attribute from two constructors
  (Expo's own fix, expo/expo#49740).
- `JavaScriptRuntime.swift`: wraps three call-scoped raw pointers in an `@unchecked Sendable`
  struct so the compiler stops reporting "sending ... risks causing data races"
  (expo/expo#50470). Same semantics, zero cost.

`patch-package` applies it on `npm install`. Xcode 26.5+ (Swift 6.3) compiles the unpatched
source, so delete the patch once everyone is on Xcode 26.5+ or once an Expo release includes
the fixes. If `npm install` ever reports the patch failed to apply, the package version changed:
check whether the fixes landed upstream before recreating it.

---

# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
