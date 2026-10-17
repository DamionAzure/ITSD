import { readFile, writeFile } from "node:fs/promises";

const manifestPath = "src-tauri/gen/android/app/src/main/AndroidManifest.xml";
let manifest = await readFile(manifestPath, "utf8");
if (!/android:screenOrientation="landscape"/.test(manifest)) {
  manifest = manifest.replace(
    '            android:name=".MainActivity"\n',
    '            android:name=".MainActivity"\n            android:screenOrientation="landscape"\n',
  );
  await writeFile(manifestPath, manifest);
}

const themePath = "src-tauri/gen/android/app/src/main/res/values/themes.xml";
let theme = await readFile(themePath, "utf8");
if (!theme.includes('name="android:windowFullscreen"')) {
  theme = theme.replace(
    '        <!-- Customize your theme here. -->',
    '        <item name="android:windowFullscreen">true</item>\n        <item name="android:windowActionModeOverlay">true</item>',
  );
  await writeFile(themePath, theme);
}

const activityPath = "src-tauri/gen/android/app/src/main/java/dev/itsd/app/MainActivity.kt";
let activity = await readFile(activityPath, "utf8");
if (!activity.includes("WindowInsetsControllerCompat")) {
  activity = activity
    .replace(/import androidx\.activity\.enableEdgeToEdge\r?\n/, "import androidx.activity.enableEdgeToEdge\nimport androidx.core.view.WindowCompat\nimport androidx.core.view.WindowInsetsCompat\nimport androidx.core.view.WindowInsetsControllerCompat\n")
    .replace(/    super\.onCreate\(savedInstanceState\)\r?\n/, "    super.onCreate(savedInstanceState)\n    val controller = WindowCompat.getInsetsController(window, window.decorView)\n    controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE\n    controller.hide(WindowInsetsCompat.Type.systemBars())\n");
  await writeFile(activityPath, activity);
}
