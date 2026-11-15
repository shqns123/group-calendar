// @ts-check
/**
 * Local release builds only (scripts/build-android-local.ps1 sets LOCAL_RELEASE_SIGNING=1 before
 * `expo prebuild`): sign the release APK with the same keystore EAS uses, so it installs as an
 * update over an EAS-built app. The key paths and passwords are read from environment variables
 * at Gradle time and never written into the project.
 *
 * EAS cloud builds don't set LOCAL_RELEASE_SIGNING, so this plugin leaves their build.gradle as is
 * and EAS applies its own signing.
 */
const { withAppBuildGradle, withProjectBuildGradle } = require("expo/config-plugins");

/**
 * jitpack.io is the template's last-resort repository, so Gradle asks it for every artifact the
 * others lack, and jitpack can stall such lookups for many minutes (seen on local builds). Only
 * `com.github.*` artifacts live there; limit it to those.
 */
const JITPACK_FILTER = String.raw`
// Local builds: jitpack.io only for com.github.* artifacts, in every project. Some libraries
// (e.g. @react-native-masked-view/masked-view) add their own jitpack repository.
allprojects {
  // React Native's core AAR (~170MB) is served from repo.reactnative.dev, which keeps stalling
  // mid-download on this network and Gradle can't resume. Fetch it once with a resumable download
  // into ~/.m2 (scripts/build-android-local.ps1 does this) and read it from there first.
  def localRn = repositories.mavenLocal { content { includeModule 'com.facebook.react', 'react-android' } }
  repositories.remove(localRn)
  repositories.addFirst(localRn)
  repositories.withType(MavenArtifactRepository).configureEach { repo ->
    if (repo.url.toString().contains('jitpack.io')) {
      repo.content { includeGroupByRegex 'com\\.github\\..*' }
    }
  }
}
`;

const SHORT_CXX = String.raw`
// Local builds on Windows: C++ build folders under GC_CXX_ROOT (C:\gcx) instead of each library's
// android\.cxx. CMake nests the source path inside its object paths, and from this repo's real
// location they pass Windows' 260-character limit (react-native-worklets failed with "mkdir: No such
// file or directory"). Set by scripts/build-android-local.ps1.
def gcCxxRoot = System.getenv('GC_CXX_ROOT')
if (gcCxxRoot) {
  subprojects { p ->
    ['com.android.library', 'com.android.application'].each { id ->
      p.plugins.withId(id) {
        // Projects Gradle configured before this point can't take it any more; skip those.
        try {
          p.android.externalNativeBuild.cmake.buildStagingDirectory = new File(gcCxxRoot, p.name)
        } catch (Exception e) {
          logger.lifecycle("GC_CXX_ROOT: kept the default C++ folder for " + p.name)
        }
      }
    }
  }
}
`;

function withShortCxxPaths(config) {
  return withProjectBuildGradle(config, (c) => {
    if (!c.modResults.contents.includes("GC_CXX_ROOT")) c.modResults.contents += SHORT_CXX;
    return c;
  });
}

function withJitpackOnlyForGithub(config) {
  return withProjectBuildGradle(config, (c) => {
    if (!c.modResults.contents.includes("Local builds: jitpack.io only")) {
      c.modResults.contents += JITPACK_FILTER;
    }
    return c;
  });
}

const RELEASE_CONFIG = `
        release {
            if (System.getenv('RELEASE_STORE_FILE')) {
                storeFile file(System.getenv('RELEASE_STORE_FILE'))
                storePassword System.getenv('RELEASE_STORE_PASSWORD')
                keyAlias System.getenv('RELEASE_KEY_ALIAS')
                keyPassword System.getenv('RELEASE_KEY_PASSWORD')
            }
        }`;

module.exports = function withLocalReleaseSigning(config) {
  if (process.env.LOCAL_RELEASE_SIGNING !== "1") return config;
  config = withJitpackOnlyForGithub(config);
  config = withShortCxxPaths(config);
  return withAppBuildGradle(config, (c) => {
    let src = c.modResults.contents;
    if (src.includes("RELEASE_STORE_FILE")) return c;

    // 1) A `release` signing config next to `debug`.
    const debugCfg = /(signingConfigs\s*\{\s*debug\s*\{[^}]*\})/;
    if (!debugCfg.test(src)) throw new Error("withLocalReleaseSigning: signingConfigs.debug not found in app/build.gradle");
    src = src.replace(debugCfg, `$1${RELEASE_CONFIG}`);

    // 2) The release build type uses it (when the key env vars are set).
    const releaseType = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
    if (!releaseType.test(src)) throw new Error("withLocalReleaseSigning: release signingConfig not found in app/build.gradle");
    src = src.replace(releaseType, "$1signingConfig System.getenv('RELEASE_STORE_FILE') ? signingConfigs.release : signingConfigs.debug");

    // 3) The app's own C++ build (autolinked codegen) under GC_CXX_ROOT too. The root-level rule
    //    can't reach :app (configured too early), so it's set here, while app/build.gradle runs.
    if (!src.includes("GC_CXX_ROOT")) {
      src += `
if (System.getenv('GC_CXX_ROOT')) {
    android.externalNativeBuild.cmake.buildStagingDirectory = new File(System.getenv('GC_CXX_ROOT'), 'app')
    // Autolinked codegen sources live deep in node_modules and CMake folds their full path into
    // the object path (308 chars for reanimated). Telling CMake Windows' real limit makes it hash
    // those paths short; the SDK's ninja 1.10 can't use long paths.
    android.defaultConfig.externalNativeBuild.cmake.arguments.add('-DCMAKE_OBJECT_PATH_MAX=240')
}
`;
    }

    c.modResults.contents = src;
    return c;
  });
};
