#!/usr/bin/env node
/**
 * Downloads the native iOS SDK XCFrameworks (CocoaPods flavour) pinned in a
 * package's package.json `ezoic.iosSdk`, verifies each one's SHA-256 and
 * extracts them to <package>/ios/Frameworks, where the podspec vendors them.
 *
 * `ezoic.iosSdk.sha256` maps each framework (`EzoicAdsSDKBinary`,
 * `EzoicCmpSDKBinary`) to the SHA-256 of its dist release asset
 * `<framework without "Binary">-<version>-cocoapods.xcframework.zip`.
 *
 *   node scripts/fetch-ios-sdk.js          download if missing or out of date
 *   node scripts/fetch-ios-sdk.js --force  always re-download
 *   node scripts/fetch-ios-sdk.js --check  verify only, never download
 *   node scripts/fetch-ios-sdk.js --pin    download the release assets and
 *                                          write their SHA-256s to package.json
 *   --package <dir>                        the package to act on (default: the
 *                                          repo root, @ezoic/react-native-sdk)
 *
 * EZOIC_IOS_SDK_ZIP_DIR=<dir> reads the zips from <dir> instead of the release,
 * checked against their `<zip>.sha256` sidecar files. For local builds of an
 * unreleased native SDK only. Such frameworks are stamped `local`, and
 * `--check` (run before publishing) ignores the variable and rejects them.
 */
'use strict';

const { Buffer } = require('node:buffer');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PLACEHOLDER = 'TODO-RELEASE';
/** Stamp sha256 of a framework extracted from EZOIC_IOS_SDK_ZIP_DIR; never a pin. */
const LOCAL = 'local';
const RELEASES =
  'https://github.com/ezoic/ezoic-swift-sdk-dist/releases/download';

function assetName(framework) {
  return framework.replace(/Binary$/, '');
}

function zipName(version, framework) {
  return `${assetName(framework)}-${version}-cocoapods.xcframework.zip`;
}

function assetUrl(version, framework) {
  return `${RELEASES}/${version}/${zipName(version, framework)}`;
}

function readPins(packageDir) {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')
  );
  const { version, sha256, podDependencies } = pkg.ezoic.iosSdk;
  if (!sha256 || typeof sha256 !== 'object' || Array.isArray(sha256)) {
    throw new Error(
      'package.json ezoic.iosSdk.sha256 must map each framework to its SHA-256'
    );
  }
  const frameworks = Object.entries(sha256).map(([name, sha]) => ({
    name,
    sha256: sha,
  }));
  return { version, frameworks, podDependencies: podDependencies || {} };
}

function missingSlices(dir, framework) {
  if (!fs.existsSync(path.join(dir, 'Info.plist'))) {
    return ['Info.plist'];
  }
  const slices = fs.readdirSync(dir).filter((name) => name.startsWith('ios-'));
  const missing = [];
  if (!slices.includes('ios-arm64')) {
    missing.push('ios-arm64');
  }
  if (!slices.some((name) => name.endsWith('-simulator'))) {
    missing.push('ios-*-simulator');
  }
  for (const slice of slices) {
    const binary = path.join(dir, slice, `${framework}.framework`, framework);
    if (!fs.existsSync(binary)) {
      missing.push(path.relative(dir, binary));
    }
  }
  return missing;
}

/** Where the zip comes from and the SHA-256 it must have. */
function source(version, pin, localDir) {
  if (!localDir) {
    if (pin.sha256 === PLACEHOLDER) {
      throw new Error(
        `ezoic.iosSdk.sha256.${pin.name} is the ${PLACEHOLDER} placeholder; ` +
          'once the dist release exists run `node scripts/fetch-ios-sdk.js ' +
          '--pin` (add `--package cmp` for the CMP package)'
      );
    }
    if (!/^[0-9a-f]{64}$/.test(pin.sha256 || '')) {
      throw new Error(
        `ezoic.iosSdk.sha256.${pin.name} must be a 64-char hex SHA-256`
      );
    }
    return { location: assetUrl(version, pin.name), sha256: pin.sha256 };
  }
  const zip = path.join(path.resolve(localDir), zipName(version, pin.name));
  const sidecar = `${zip}.sha256`;
  if (!fs.existsSync(sidecar)) {
    throw new Error(`EZOIC_IOS_SDK_ZIP_DIR: ${sidecar} not found`);
  }
  const sha256 = fs.readFileSync(sidecar, 'utf8').trim().split(/\s+/)[0];
  return { location: zip, sha256, local: true };
}

function isCurrent(paths, version, sha256) {
  if (!fs.existsSync(paths.stamp)) {
    return false;
  }
  let stamp;
  try {
    stamp = JSON.parse(fs.readFileSync(paths.stamp, 'utf8'));
  } catch {
    return false;
  }
  return (
    stamp.version === version &&
    stamp.sha256 === sha256 &&
    missingSlices(paths.framework, paths.name).length === 0
  );
}

async function download(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      lastError = error;
      console.warn(
        `fetch-ios-sdk: attempt ${attempt} failed: ${error.message}`
      );
    }
  }
  throw new Error(`could not download ${url}: ${lastError.message}`);
}

async function load(src) {
  return src.local ? fs.readFileSync(src.location) : download(src.location);
}

function sha256Of(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function extract(zip, paths, version, sha256) {
  fs.mkdirSync(paths.dir, { recursive: true });
  // Stage inside ios/Frameworks so the final rename never crosses filesystems.
  const staging = fs.mkdtempSync(path.join(paths.dir, '.staging-'));
  try {
    const zipPath = path.join(staging, 'sdk.zip');
    fs.writeFileSync(zipPath, zip);
    const extractDir = path.join(staging, 'out');
    // Info-ZIP `unzip` (macOS and ubuntu-latest) restores symlinks.
    const unzip = spawnSync('unzip', ['-q', zipPath, '-d', extractDir], {
      stdio: 'inherit',
    });
    if (unzip.error || unzip.status !== 0) {
      throw new Error(
        `unzip failed: ${unzip.error ? unzip.error.message : `exit ${unzip.status}`}`
      );
    }
    const extracted = path.join(extractDir, path.basename(paths.framework));
    const missing = missingSlices(extracted, paths.name);
    if (missing.length > 0) {
      throw new Error(
        `unexpected ${paths.name} archive layout, missing: ${missing.join(', ')}`
      );
    }
    fs.rmSync(paths.stamp, { force: true });
    fs.rmSync(paths.framework, { recursive: true, force: true });
    fs.renameSync(extracted, paths.framework);
    fs.writeFileSync(
      paths.stamp,
      JSON.stringify({ version, sha256 }, null, 2) + '\n'
    );
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

function frameworkPaths(packageDir, name) {
  const dir = path.join(packageDir, 'ios', 'Frameworks');
  return {
    name,
    dir,
    framework: path.join(dir, `${name}.xcframework`),
    // Dotfile, so it is excluded from the npm tarball by the `!**/.*` files entry.
    stamp: path.join(dir, `.${name}.json`),
  };
}

async function pinRelease(packageDir, version, frameworks) {
  if (process.env.EZOIC_IOS_SDK_ZIP_DIR) {
    throw new Error('--pin pins release assets; unset EZOIC_IOS_SDK_ZIP_DIR');
  }
  const pkgPath = path.join(packageDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  for (const { name } of frameworks) {
    const url = assetUrl(version, name);
    console.log(`fetch-ios-sdk: downloading ${url}`);
    pkg.ezoic.iosSdk.sha256[name] = sha256Of(await download(url));
    console.log(`fetch-ios-sdk: ${name} ${pkg.ezoic.iosSdk.sha256[name]}`);
  }
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

function parseArgs(argv) {
  const args = { packageDir: path.resolve(__dirname, '..'), flags: new Set() };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--package') {
      if (!argv[i + 1]) throw new Error('--package needs a directory');
      args.packageDir = path.resolve(argv[++i]);
    } else {
      args.flags.add(argv[i]);
    }
  }
  return args;
}

async function main() {
  const { packageDir, flags } = parseArgs(process.argv.slice(2));
  const { version, frameworks } = readPins(packageDir);
  const rel = (p) => path.relative(process.cwd(), p) || '.';

  if (flags.has('--pin')) {
    await pinRelease(packageDir, version, frameworks);
    return;
  }

  const checking = flags.has('--check');
  const localDir = checking ? '' : process.env.EZOIC_IOS_SDK_ZIP_DIR || '';
  for (const entry of frameworks) {
    const paths = frameworkPaths(packageDir, entry.name);
    const src = source(version, entry, localDir);
    const label = `${assetName(entry.name)} ${version}`;

    if (checking) {
      if (!isCurrent(paths, version, src.sha256)) {
        throw new Error(
          `${rel(paths.framework)} is missing, locally built or not ${label} ` +
            `(${src.sha256}); run \`node scripts/fetch-ios-sdk.js\` without ` +
            'EZOIC_IOS_SDK_ZIP_DIR'
        );
      }
      console.log(`fetch-ios-sdk: ${label} present`);
      continue;
    }

    if (
      !src.local &&
      !flags.has('--force') &&
      isCurrent(paths, version, src.sha256)
    ) {
      console.log(`fetch-ios-sdk: ${label} already present`);
      continue;
    }

    if (src.local) {
      console.warn(
        `fetch-ios-sdk: using local ${src.location} (not a release asset)`
      );
    } else {
      console.log(`fetch-ios-sdk: downloading ${src.location}`);
    }
    const zip = await load(src);
    const actual = sha256Of(zip);
    if (actual !== src.sha256) {
      throw new Error(
        `SHA-256 mismatch for ${src.location}\n  expected ${src.sha256}\n  actual   ${actual}`
      );
    }
    extract(zip, paths, version, src.local ? LOCAL : src.sha256);
    console.log(`fetch-ios-sdk: extracted ${label} to ${rel(paths.framework)}`);
  }
}

module.exports = {
  assetName,
  assetUrl,
  readPins,
  missingSlices,
  isCurrent,
  frameworkPaths,
  LOCAL,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(`fetch-ios-sdk: ${error.message}`);
    process.exit(1);
  });
}
