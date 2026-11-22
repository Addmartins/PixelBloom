import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("../", import.meta.url));
const sdk = process.env.ANDROID_SDK_ROOT ?? process.env.ANDROID_HOME ?? join(homedir(), "Android/Sdk");
const tools = join(sdk, "build-tools", process.env.ANDROID_BUILD_TOOLS ?? "36.0.0");
const androidJar = join(sdk, "platforms", "android-34", "android.jar");
const origin = new URL(process.argv[2] ?? "https://invalid.invalid");
const localHost = /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(origin.hostname) && /^\d+(\.\d+){3}$/.test(origin.hostname);
if (!process.argv[2] || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/"
  || (origin.protocol !== "https:" && !(origin.protocol === "http:" && localHost))) {
  throw new Error("Informe uma origem HTTPS ou um endereço IPv4 privado HTTP para teste local.");
}

const downloads = join(project, "public/downloads");
mkdirSync(downloads, { recursive: true });
const template = readFileSync(join(project, "mobile/android/AndroidManifest.xml"), "utf8");
const run = (command, args, cwd) => execFileSync(command, args, { cwd, stdio: "inherit" });
const android = (command, args, cwd) => run(join(tools, command), args, cwd);
const debugKeystore = process.env.PIXELBLOOM_ANDROID_DEBUG_KEYSTORE ?? join(homedir(), ".android/debug.keystore");

const apps = [
  { id: "com.pixelbloom.familia", label: "PixelBloom Família", path: "/dashboard", filename: "pixelbloom-familia-android.apk" },
  { id: "com.pixelbloom.kids", label: "PixelBloom Kids", path: "/kids", filename: "pixelbloom-kids-android.apk" },
];

for (const app of apps) {
  const dir = mkdtempSync(join(tmpdir(), "pixelbloom-android-"));
  try {
    mkdirSync(join(dir, "res/drawable-nodpi"), { recursive: true });
    mkdirSync(join(dir, "res/xml"), { recursive: true });
    mkdirSync(join(dir, "classes"), { recursive: true });
    copyFileSync(join(project, "public/pixelbloom-192.png"), join(dir, "res/drawable-nodpi/app_icon.png"));
    copyFileSync(join(project, "mobile/android/MainActivity.java"), join(dir, "MainActivity.java"));
    writeFileSync(join(dir, "AndroidManifest.xml"), template.replace("APP_PACKAGE", app.id).replace("APP_LABEL", app.label));
    writeFileSync(join(dir, "res/xml/app_network.xml"), `<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  ${origin.protocol === "http:" ? `<domain-config cleartextTrafficPermitted="true"><domain>${origin.hostname}</domain></domain-config>` : ""}
</network-security-config>`);
    writeFileSync(join(dir, "AppConfig.java"), `package com.pixelbloom.mobile;
final class AppConfig {
    static final String ORIGIN = ${JSON.stringify(origin.origin)};
    static final String START_PATH = ${JSON.stringify(app.path)};
}
`);

    android("aapt2", ["compile", "--dir", "res", "-o", "resources.zip"], dir);
    android("aapt2", ["link", "-I", androidJar, "--manifest", "AndroidManifest.xml", "-R", "resources.zip", "-o", "resources.apk"], dir);
    run("javac", ["--release", "8", "-classpath", androidJar, "-d", "classes", "MainActivity.java", "AppConfig.java"], dir);
    run("jar", ["cf", "classes.jar", "-C", "classes", "."], dir);
    android("d8", ["--min-api", "24", "--lib", androidJar, "--output", ".", "classes.jar"], dir);
    run("zip", ["-q", "resources.apk", "classes.dex"], dir);
    android("zipalign", ["-P", "16", "-f", "4", "resources.apk", "aligned.apk"], dir);
    android("apksigner", ["sign", "--ks", debugKeystore, "--ks-key-alias", "androiddebugkey",
      "--ks-pass", "pass:android", "--key-pass", "pass:android", "--out", "signed.apk", "aligned.apk"], dir);
    android("apksigner", ["verify", "signed.apk"], dir);
    const output = join(downloads, app.filename);
    copyFileSync(join(dir, "signed.apk"), output);
    console.log(output);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
