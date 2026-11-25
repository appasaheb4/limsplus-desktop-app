/**
 * electron-builder skips signing when no Developer ID is available and leaves
 * the linker ad-hoc signature. That signature fails `codesign --verify`
 * ("code has no resources but signature indicates they must be present").
 * macOS then reports a quarantined GitHub download as damaged.
 *
 * Seal a real ad-hoc signature after pack, before the DMG is built.
 * Hardened runtime stays off: there is no Developer ID, and the bundled
 * Node backend would be killed by library validation.
 */
const path = require('path');
const { signAsync } = require('@electron/osx-sign');
const { rewriteSymlinksInside } = require('../../scripts/rewrite-bundle-symlinks');

exports.default = async function macAdhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);

  const links = rewriteSymlinksInside(appPath);
  console.info(
    `[mac-adhoc-sign] symlinks rewritten=${links.rewritten} removed=${links.removed} unmapped=${links.unmapped.length}`,
  );
  if (links.unmapped.length) {
    throw new Error(
      `symlinks still point outside the app:\n${links.unmapped.slice(0, 20).join('\n')}`,
    );
  }

  console.info(`[mac-adhoc-sign] ad-hoc signing ${appPath}`);
  await signAsync({
    app: appPath,
    identity: '-',
    identityValidation: false,
    gatekeeperAssess: false,
    preAutoEntitlements: false,
    // Top-level hardenedRuntime is ignored; optionsForFile is what osx-sign reads.
    optionsForFile() {
      return { hardenedRuntime: false };
    },
  });
  console.info('[mac-adhoc-sign] ad-hoc signature sealed');
};
