#!/usr/bin/env bash
# Builds a throwaway React Native app that installs this repo's packages as
# npm tarballs, the way a publisher's app does:
#
#   scripts/smoke-app.sh <ads|cmp|both> <workdir> [android] [ios]
#
#   ads   @ezoic/react-native-sdk alone
#   cmp   @ezoic/react-native-cmp-sdk alone
#   both  both packages (one copy of each native framework expected)
#
# With no platform given it builds both. <workdir> is created (or reused) and
# holds the tarballs, the app and the iOS DerivedData. After each build it
# prints which native CMP copies ended up in the app.
#
# Environment:
#   EZOIC_IOS_SDK_ZIP_DIR=<dir>   passed to scripts/fetch-ios-sdk.js while packing
#                                 (local, unreleased XCFramework zips)
#   EZOIC_SMOKE_MAVEN_LOCAL=1     add mavenLocal() to the generated app's Android
#                                 repositories (local, unreleased Maven artifacts)
#   EZOIC_SMOKE_RN_VERSION=<v>    React Native version of the app (default: the
#                                 repo's react-native devDependency)
#   USE_FRAMEWORKS=static|dynamic Podfile linkage; defaults to static whenever the
#                                 ads package is installed (it requires it)
set -euo pipefail

variant="${1:-}"
workdir="${2:-}"
case "$variant" in ads | cmp | both) ;; *)
  echo "usage: $0 <ads|cmp|both> <workdir> [android] [ios]" >&2
  exit 2
  ;;
esac
[ -n "$workdir" ] || { echo "usage: $0 <ads|cmp|both> <workdir> [android] [ios]" >&2; exit 2; }
shift 2
platforms="${*:-android ios}"

repo="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$workdir"
workdir="$(cd "$workdir" && pwd)"
pkgs="$workdir/packages"
app="$workdir/EzoicSmoke"
rn_version="${EZOIC_SMOKE_RN_VERSION:-$(node -p "require('$repo/package.json').devDependencies['react-native']")}"

log() { printf '\n==> %s\n' "$*"; }

log "Packing ($variant)"
rm -rf "$pkgs" && mkdir -p "$pkgs"
tarballs=()
if [ "$variant" != cmp ]; then
  (cd "$repo" && npm pack --silent --pack-destination "$pkgs" >/dev/null)
  tarballs+=("$pkgs"/ezoic-react-native-sdk-*.tgz)
fi
if [ "$variant" != ads ]; then
  (cd "$repo/cmp" && npm pack --silent --pack-destination "$pkgs" >/dev/null)
  tarballs+=("$pkgs"/ezoic-react-native-cmp-sdk-*.tgz)
fi

if [ ! -d "$app" ]; then
  log "Creating a React Native $rn_version app"
  (cd "$workdir" && npx --yes @react-native-community/cli@latest init EzoicSmoke \
    --version "$rn_version" --pm npm --skip-install --skip-git-init --install-pods false)
fi

log "Installing ${tarballs[*]##*/}"
cd "$app"
npm uninstall --silent @ezoic/react-native-sdk @ezoic/react-native-cmp-sdk >/dev/null 2>&1 || true
npm install --silent --legacy-peer-deps "${tarballs[@]}"

{
  echo "import { useEffect, useState } from 'react';"
  echo "import { Button, SafeAreaView, Text } from 'react-native';"
  [ "$variant" != cmp ] && echo "import { EzoicAds } from '@ezoic/react-native-sdk';"
  [ "$variant" != ads ] && echo "import { EzoicCmp } from '@ezoic/react-native-cmp-sdk';"
  cat <<'EOF'

export default function App() {
  const [status, setStatus] = useState('starting');
  useEffect(() => {
EOF
  if [ "$variant" = cmp ]; then
    cat <<'EOF'
    EzoicCmp.initialize('example.com', { debugEnabled: true });
    EzoicCmp.presentConsentIfRequired().then((o) => setStatus(JSON.stringify(o)));
EOF
  else
    cat <<'EOF'
    EzoicAds.setAppContent({ language: 'en', genre: 'News' });
    EzoicAds.initialize({ domain: 'example.com', appPaid: false, debugEnabled: true })
      .then(() => EzoicAds.isPrivacyOptionsRequired())
      .then((v) => setStatus(`privacy options required: ${v}`))
      .catch((e) => setStatus(String(e)));
EOF
  fi
  cat <<'EOF'
  }, []);
  return (
    <SafeAreaView>
      <Text>{status}</Text>
EOF
  if [ "$variant" = cmp ]; then
    echo "      <Button title=\"Privacy choices\" onPress={() => EzoicCmp.presentConsentSettings()} />"
  else
    echo "      <Button title=\"Privacy choices\" onPress={() => EzoicAds.presentConsentSettings()} />"
  fi
  [ "$variant" = both ] && echo "      <Button title=\"Reset\" onPress={() => EzoicCmp.resetConsent()} />"
  cat <<'EOF'
    </SafeAreaView>
  );
}
EOF
} > App.tsx

build_android() {
  log "Android: assembleDebug"
  local gradle=android/build.gradle
  # The Ezoic SDKs need the Kotlin 2.2 Gradle plugin (see README "Android").
  sed -i.bak -E 's/kotlinVersion = "[^"]+"/kotlinVersion = "2.2.21"/' "$gradle"
  sed -i.bak -E 's/classpath\("org\.jetbrains\.kotlin:kotlin-gradle-plugin"\)/classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.21")/' "$gradle"
  if [ "${EZOIC_SMOKE_MAVEN_LOCAL:-}" = 1 ] && ! grep -q mavenLocal "$gradle"; then
    printf '\nallprojects {\n    repositories {\n        mavenLocal()\n    }\n}\n' >> "$gradle"
  fi
  rm -f "$gradle.bak"
  (cd android && ./gradlew --quiet assembleDebug)
  log "Android: Ezoic dependencies of the app"
  (cd android && ./gradlew --quiet :app:dependencies --configuration debugRuntimeClasspath) |
    grep -E 'ezoic' || true
  log "Android: EzoicCmp class definitions in the APK"
  local apk dex dexdump count=0
  apk="$(ls android/app/build/outputs/apk/debug/*.apk | head -1)"
  dexdump="$(ls -d "${ANDROID_HOME:?set ANDROID_HOME}"/build-tools/*/ | tail -1)dexdump"
  dex="$(mktemp -d)"
  unzip -q -o "$apk" 'classes*.dex' -d "$dex"
  for f in "$dex"/*.dex; do
    count=$((count + $("$dexdump" "$f" 2>/dev/null | grep -c "Class descriptor  : 'Lcom/ezoic/ads/sdk/privacy/cmp/EzoicCmp;'" || true)))
  done
  rm -rf "$dex"
  echo "$apk: $count"
}

build_ios() {
  local linkage="${USE_FRAMEWORKS:-}"
  if [ -z "$linkage" ] && [ "$variant" != cmp ]; then linkage=static; fi
  log "iOS: pod install (USE_FRAMEWORKS=${linkage:-<unset>})"
  if [ -n "$linkage" ]; then
    (cd ios && USE_FRAMEWORKS="$linkage" RCT_NEW_ARCH_ENABLED=1 pod install)
  else
    (cd ios && unset USE_FRAMEWORKS && RCT_NEW_ARCH_ENABLED=1 pod install)
  fi
  log "iOS: simulator build"
  local dd="$workdir/DerivedData"
  xcodebuild -quiet -workspace ios/EzoicSmoke.xcworkspace -scheme EzoicSmoke \
    -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath "$dd" build
  log "iOS: pods vendoring an Ezoic framework"
  grep -l 'Ezoic[A-Za-z]*SDKBinary' ios/Pods/Target\ Support\ Files/*/*-xcframeworks.sh |
    while read -r script; do
      echo "$(basename "$(dirname "$script")"): $(grep -oE 'Ezoic[A-Za-z]*SDKBinary\.xcframework' "$script" | sort -u | tr '\n' ' ')"
    done
  log "iOS: EzoicCmpSDKBinary.framework copies in the build"
  find "$dd/Build/Products" -type d -name 'EzoicCmpSDKBinary.framework' | sed "s#$dd/##"
  local binary="$dd/Build/Products/Debug-iphonesimulator/EzoicSmoke.app/EzoicSmoke.debug.dylib"
  [ -f "$binary" ] || binary="$dd/Build/Products/Debug-iphonesimulator/EzoicSmoke.app/EzoicSmoke"
  echo "CmpController class definitions in the app binary: $(nm -U "$binary" | grep -c '__DATA__TtC17EzoicCmpSDKBinary13CmpController$' || true)"
}

for platform in $platforms; do
  case "$platform" in
    android) build_android ;;
    ios) build_ios ;;
    *) echo "unknown platform $platform" >&2; exit 2 ;;
  esac
done
log "Done: $variant ($platforms)"
