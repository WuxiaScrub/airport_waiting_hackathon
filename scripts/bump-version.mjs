// Raises the app's version everywhere it is written, so the stores accept the
// next upload:
//
//   npm run bump          build number +1, same version (another TestFlight /
//                         Play upload of the release being tested)
//   npm run bump patch    1.0.0 → 1.0.1, and build number +1
//   npm run bump minor    1.0.0 → 1.1.0, and build number +1
//   npm run bump major    1.0.0 → 2.0.0, and build number +1
//
// The version lives in package.json, CFG.online.gameVersion (sent with each
// run and checked against app_config.min_game_version), Android's
// versionName and Xcode's MARKETING_VERSION. The build number is Android's
// versionCode and Xcode's CURRENT_PROJECT_VERSION; both stores need it to
// rise on every upload.
import { readFileSync, writeFileSync } from 'node:fs';

const FILES = {
  pkg: 'package.json',
  cfg: 'src/config.js',
  gradle: 'android/app/build.gradle',
  xcode: 'ios/App/App.xcodeproj/project.pbxproj',
};

const part = process.argv[2] || 'build';
if (!['build', 'patch', 'minor', 'major'].includes(part)) {
  console.error(`Unknown "${part}". Use: npm run bump [patch|minor|major]`);
  process.exit(1);
}

const text = {};
for (const [k, f] of Object.entries(FILES)) text[k] = readFileSync(f, 'utf8');

/** Replace every match of `re` (which must match at least once) with `to`. */
function set(key, re, to) {
  if (!re.test(text[key])) throw new Error(`${FILES[key]}: no match for ${re}`);
  text[key] = text[key].replace(new RegExp(re.source, 'g'), to);
}

// The version: package.json's is the reference.
const pkg = JSON.parse(text.pkg);
const [major, minor, patch] = pkg.version.split('.').map(Number);
const version = {
  build: [major, minor, patch],
  patch: [major, minor, patch + 1],
  minor: [major, minor + 1, 0],
  major: [major + 1, 0, 0],
}[part].join('.');

// The build number: one past the highest either platform has used.
const code = (re, key) => Math.max(...[...text[key].matchAll(new RegExp(re.source, 'g'))].map(m => Number(m[1])));
const build = Math.max(code(/versionCode (\d+)/, 'gradle'), code(/CURRENT_PROJECT_VERSION = (\d+);/, 'xcode')) + 1;

set('pkg', /"version": "[^"]*"/, `"version": "${version}"`);
set('cfg', /gameVersion: '[^']*'/, `gameVersion: '${version}'`);
set('gradle', /versionCode \d+/, `versionCode ${build}`);
set('gradle', /versionName "[^"]*"/, `versionName "${version}"`);
set('xcode', /CURRENT_PROJECT_VERSION = \d+;/, `CURRENT_PROJECT_VERSION = ${build};`);
set('xcode', /MARKETING_VERSION = [^;]*;/, `MARKETING_VERSION = ${version};`);

for (const [k, f] of Object.entries(FILES)) writeFileSync(f, text[k]);
console.log(`version ${version} (build ${build})`);
console.log('Next: npm run sync, then archive / bundle. Commit the version change.');
