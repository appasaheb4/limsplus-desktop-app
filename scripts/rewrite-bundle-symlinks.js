/**
 * codesign rejects a bundle that contains a symlink whose target is outside
 * the bundle ("invalid destination for symbolic link in bundle"). npm .bin
 * links copied from limsplus-service are absolute and point back at that
 * checkout, so Gatekeeper reports the downloaded app as damaged.
 *
 * Rewrite those links to a relative path inside this tree. Drop a .bin link
 * only when the target was not copied.
 */
const fs = require('fs');
const path = require('path');

function isInside(root, target) {
  return target === root || target.startsWith(`${root}${path.sep}`);
}

function mapIntoTree(root, linkPath, absoluteTarget) {
  const marker = `${path.sep}node_modules${path.sep}`;
  const idx = absoluteTarget.lastIndexOf(marker);
  if (idx === -1) return null;
  const rest = absoluteTarget.slice(idx + marker.length);
  let dir = path.dirname(linkPath);
  while (isInside(root, dir)) {
    const candidate = path.join(dir, 'node_modules', rest);
    try {
      fs.lstatSync(candidate);
      return candidate;
    } catch {
      /* keep walking up */
    }
    if (dir === root) break;
    dir = path.dirname(dir);
  }
  return null;
}

function walk(dir, visit) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) visit(full);
    else if (entry.isDirectory()) walk(full, visit);
  }
}

function rewriteSymlinksInside(root) {
  let rewritten = 0;
  let removed = 0;
  const unmapped = [];

  walk(root, (linkPath) => {
    let raw;
    try {
      raw = fs.readlinkSync(linkPath);
    } catch {
      return;
    }
    const absoluteTarget = path.resolve(path.dirname(linkPath), raw);
    if (isInside(root, absoluteTarget)) {
      if (path.isAbsolute(raw)) {
        const rel = path.relative(path.dirname(linkPath), absoluteTarget);
        fs.unlinkSync(linkPath);
        fs.symlinkSync(rel, linkPath);
        rewritten += 1;
      }
      return;
    }

    const mapped = mapIntoTree(root, linkPath, absoluteTarget);
    if (mapped) {
      const rel = path.relative(path.dirname(linkPath), mapped);
      fs.unlinkSync(linkPath);
      fs.symlinkSync(rel, linkPath);
      rewritten += 1;
      return;
    }

    const inBin = linkPath.split(path.sep).includes('.bin');
    if (inBin) {
      fs.unlinkSync(linkPath);
      removed += 1;
      return;
    }
    unmapped.push(`${linkPath} -> ${raw}`);
  });

  return { rewritten, removed, unmapped };
}

module.exports = { rewriteSymlinksInside };
