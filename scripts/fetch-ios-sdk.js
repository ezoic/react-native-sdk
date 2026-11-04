#!/usr/bin/env node
/**
 * Downloads the native iOS SDK (`EzoicAdsSDKBinary.xcframework`, CocoaPods
 * flavour) pinned in package.json `ezoic.iosSdk`, verifies its SHA-256 and
 * extracts it to ios/Frameworks, where the podspec vendors it from.
 *
 *   node scripts/fetch-ios-sdk.js          download if missing or out of date
 *   node scripts/fetch-ios-sdk.js --force  always re-download
 *   node scripts/fetch-ios-sdk.js --check  verify only, never download
 */
'use strict';

const { Buffer } = require('node:buffer');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const { version, sha256 } = require(path.join(root, 'package.json')).ezoic
  .iosSdk;

const frameworksDir = path.join(root, 'ios', 'Frameworks');
const frameworkDir = path.join(frameworksDir, 'EzoicAdsSDKBinary.xcframework');
// Dotfile, so it is excluded from the npm tarball by the `!**/.*` files entry.
const stampFile = path.join(frameworksDir, '.EzoicAdsSDKBinary.json');
const url =
  'https://github.com/ezoic/ezoic-swift-sdk-dist/releases/download/' +
  `${version}/EzoicAdsSDK-${version}-cocoapods.xcframework.zip`;

function missingSlices(dir) {
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
    const binary = path.join(
      dir,
      slice,
      'EzoicAdsSDKBinary.framework',
      'EzoicAdsSDKBinary'
    );
    if (!fs.existsSync(binary)) {
      missing.push(path.relative(dir, binary));
    }
  }
  return missing;
}

function isCurrent() {
  if (!fs.existsSync(stampFile)) {
    return false;
  }
  let stamp;
  try {
    stamp = JSON.parse(fs.readFileSync(stampFile, 'utf8'));
  } catch {
    return false;
  }
  return (
    stamp.version === version &&
    stamp.sha256 === sha256 &&
    missingSlices(frameworkDir).length === 0
  );
}

async function download() {
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

async function main() {
  const args = process.argv.slice(2);

  if (!/^[0-9a-f]{64}$/.test(sha256 || '')) {
    throw new Error(
      'package.json ezoic.iosSdk.sha256 must be a 64-char hex SHA-256'
    );
  }

  if (args.includes('--check')) {
    if (!isCurrent()) {
      throw new Error(
        `${path.relative(root, frameworkDir)} is missing or not EzoicAdsSDK ` +
          `${version} (${sha256}); run \`node scripts/fetch-ios-sdk.js\``
      );
    }
    console.log(`fetch-ios-sdk: EzoicAdsSDK ${version} present`);
    return;
  }

  if (!args.includes('--force') && isCurrent()) {
    console.log(`fetch-ios-sdk: EzoicAdsSDK ${version} already present`);
    return;
  }

  console.log(`fetch-ios-sdk: downloading ${url}`);
  const zip = await download();
  const actual = crypto.createHash('sha256').update(zip).digest('hex');
  if (actual !== sha256) {
    throw new Error(
      `SHA-256 mismatch for ${url}\n  expected ${sha256}\n  actual   ${actual}`
    );
  }

  fs.mkdirSync(frameworksDir, { recursive: true });
  // Stage inside ios/Frameworks so the final rename never crosses filesystems.
  const staging = fs.mkdtempSync(path.join(frameworksDir, '.staging-'));
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
    const extracted = path.join(extractDir, path.basename(frameworkDir));
    const missing = missingSlices(extracted);
    if (missing.length > 0) {
      throw new Error(
        `unexpected archive layout, missing: ${missing.join(', ')}`
      );
    }
    fs.rmSync(stampFile, { force: true });
    fs.rmSync(frameworkDir, { recursive: true, force: true });
    fs.renameSync(extracted, frameworkDir);
    fs.writeFileSync(
      stampFile,
      JSON.stringify({ version, sha256 }, null, 2) + '\n'
    );
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
  console.log(
    `fetch-ios-sdk: extracted EzoicAdsSDK ${version} to ` +
      path.relative(root, frameworkDir)
  );
}

main().catch((error) => {
  console.error(`fetch-ios-sdk: ${error.message}`);
  process.exit(1);
});
