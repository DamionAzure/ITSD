import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const required = ["ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD", "ANDROID_KEY_BASE64"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  throw new Error(`Missing Android signing environment variables: ${missing.join(", ")}`);
}

const root = process.cwd();
const android = path.join(root, "src-tauri", "gen", "android");
const keystore = path.join(process.env.RUNNER_TEMP ?? path.join(root, ".tmp"), "itsd-upload-keystore.jks");
const properties = [
  `keyAlias=${process.env.ANDROID_KEY_ALIAS}`,
  `password=${process.env.ANDROID_KEY_PASSWORD}`,
  `storeFile=${keystore}`,
  `storePassword=${process.env.ANDROID_KEY_PASSWORD}`,
  "",
].join("\n");

await mkdir(path.dirname(keystore), { recursive: true });
await writeFile(keystore, Buffer.from(process.env.ANDROID_KEY_BASE64.replace(/\s+/g, ""), "base64"), { mode: 0o600 });
await writeFile(path.join(android, "keystore.properties"), properties, { mode: 0o600 });

const gradlePath = path.join(android, "app", "build.gradle.kts");
let gradle = await readFile(gradlePath, "utf8");
if (!gradle.includes("keystorePropertiesFile")) {
  gradle = gradle.replace(
    'import org.jetbrains.kotlin.gradle.dsl.JvmTarget\n',
    'import org.jetbrains.kotlin.gradle.dsl.JvmTarget\n\nval keystorePropertiesFile = rootProject.file("keystore.properties")\nval keystoreProperties = Properties()\nif (keystorePropertiesFile.exists()) {\n    keystorePropertiesFile.inputStream().use { keystoreProperties.load(it) }\n}\n',
  );
  gradle = gradle.replace(
    '    buildTypes {\n',
    '    signingConfigs {\n        create("release") {\n            if (keystorePropertiesFile.exists()) {\n                keyAlias = keystoreProperties["keyAlias"] as String\n                keyPassword = keystoreProperties["password"] as String\n                storeFile = file(keystoreProperties["storeFile"] as String)\n                storePassword = keystoreProperties["storePassword"] as String\n            }\n        }\n    }\n    buildTypes {\n',
  );
  gradle = gradle.replace(
    '        getByName("release") {\n',
    '        getByName("release") {\n            signingConfig = signingConfigs.getByName("release")\n',
  );
  await writeFile(gradlePath, gradle);
}
