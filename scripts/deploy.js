#!/usr/bin/env node
/**
 * Runs `yarn production:mac` and `yarn production:win`, then uploads only
 * the .dmg and .exe those scripts just wrote. Nothing else is published.
 * production:win reuses the version production:mac just saved so both
 * installers match. The next deploy bumps again inside production:mac.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const CLIENT = path.join(ROOT, 'client');
const DIST_DIR = path.join(CLIENT, 'dist');
const STAGING_DIR = path.join(ROOT, '.deploy-artifacts');
const REPO = 'appasaheb4/limsplus-desktop-app';

function die(msg, code = 1) {
  console.error(`deploy: ${msg}`);
  process.exit(code);
}

function log(msg) {
  console.log(`deploy: ${msg}`);
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    cwd: opts.cwd || ROOT,
    env: opts.env || process.env,
    stdio: opts.stdio || 'inherit',
    encoding: 'utf8',
    shell: opts.shell === true,
  });
}

function runCapture(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    cwd: opts.cwd || ROOT,
    env: opts.env || process.env,
    encoding: 'utf8',
    shell: opts.shell === true,
  });
}

function yarnShell() {
  return process.platform === 'win32';
}

function runOrDie(cmd, args, opts, label) {
  log(`running ${label}`);
  const result = run(cmd, args, opts);
  if (result.status !== 0) {
    const signal = result.signal ? `, signal ${result.signal}` : '';
    die(`${label} failed (exit ${result.status}${signal})`);
  }
}

function findGh() {
  const whichCmd = process.platform === 'win32' ? 'where' : 'which';
  const found = runCapture(whichCmd, ['gh']);
  if (found.status === 0 && found.stdout && found.stdout.trim()) {
    return found.stdout.trim().split(/\r?\n/)[0];
  }
  const candidates =
    process.platform === 'win32'
      ? ['gh', 'gh.exe']
      : ['/opt/homebrew/bin/gh', '/usr/local/bin/gh', 'gh'];
  for (const candidate of candidates) {
    const check = runCapture(candidate, ['--version']);
    if (check.status === 0) return candidate;
  }
  return null;
}

function readVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const version = String(pkg.version || '').trim();
  if (!version) die('could not read version from package.json');
  return version;
}

function headSha() {
  const result = runCapture('git', ['rev-parse', 'HEAD']);
  if (result.status !== 0) die('could not read git HEAD commit sha');
  return String(result.stdout || '').trim();
}

function collectArtifacts(version, dir) {
  if (!fs.existsSync(dir)) {
    log(`build output directory not found: ${dir}`);
    return [];
  }
  const names = fs.readdirSync(dir);
  const selected = names.filter((name) => {
    const lower = name.toLowerCase();
    return (
      name.includes(version) &&
      (lower.endsWith('.dmg') || lower.endsWith('.exe'))
    );
  });

  const paths = [];
  for (const name of selected) {
    const filePath = path.join(dir, name);
    const st = fs.statSync(filePath);
    if (!st.isFile() || st.size === 0) {
      log(`skipping missing or empty artifact: ${filePath}`);
      continue;
    }
    paths.push(filePath);
  }
  return paths;
}

/** electron:build-mac and electron:build-win each delete client/dist, so keep installers aside. */
function stashInstallers() {
  if (!fs.existsSync(DIST_DIR)) return;
  fs.mkdirSync(STAGING_DIR, { recursive: true });
  for (const name of fs.readdirSync(DIST_DIR)) {
    const lower = name.toLowerCase();
    if (!lower.endsWith('.dmg') && !lower.endsWith('.exe')) continue;
    const from = path.join(DIST_DIR, name);
    const to = path.join(STAGING_DIR, name);
    fs.copyFileSync(from, to);
    const size = fs.statSync(to).size;
    log(`kept ${name} (${size} bytes) — same file production:mac / production:win writes`);
  }
}

function releaseExistsGh(gh, tag) {
  const result = runCapture(gh, ['release', 'view', tag, '--repo', REPO]);
  return result.status === 0;
}

function publishWithGh(gh, tag, files, title, notes, target) {
  if (releaseExistsGh(gh, tag)) {
    die(
      `release ${tag} already exists. Re-run yarn deploy so it publishes the next version.`,
    );
  }
  log(`creating release ${tag} at ${target}`);
  const result = run(gh, [
    'release',
    'create',
    tag,
    ...files,
    '--repo',
    REPO,
    '--title',
    title,
    '--notes',
    notes,
    '--target',
    target,
  ]);
  if (result.status !== 0) die(`gh release create failed (exit ${result.status})`);
}

function getToken() {
  return String(process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '').trim();
}

function apiErrorMessage(response) {
  const message =
    response &&
    response.json &&
    typeof response.json.message === 'string' &&
    response.json.message;
  return message ? `HTTP ${response.status}: ${message}` : `HTTP ${response && response.status}`;
}

function githubRequest(method, requestPath, { token, body, hostname, headers } = {}) {
  return new Promise((resolve, reject) => {
    const payload =
      body == null ? null : Buffer.isBuffer(body) ? body : JSON.stringify(body);
    const reqHeaders = {
      'User-Agent': 'limsplus-desktop-app-deploy',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(headers || {}),
    };
    if (token) reqHeaders.Authorization = `Bearer ${token}`;
    if (payload) {
      reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = https.request(
      {
        hostname: hostname || 'api.github.com',
        path: requestPath,
        method,
        headers: reqHeaders,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks);
          const text = raw.toString('utf8');
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, json, text, raw });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function publishWithApi(tag, files, title, notes, target) {
  const token = getToken();
  if (!token) {
    die(
      'gh CLI not found and neither GH_TOKEN nor GITHUB_TOKEN is set. Cannot publish the release.',
    );
  }

  log('gh CLI not found; using GitHub API');
  const list = await githubRequest(
    'GET',
    `/repos/${REPO}/releases/tags/${encodeURIComponent(tag)}`,
    { token },
  );
  let release = list.status === 200 ? list.json : null;

  if (!release) {
    const created = await githubRequest('POST', `/repos/${REPO}/releases`, {
      token,
      body: {
        tag_name: tag,
        target_commitish: target,
        name: title,
        body: notes,
        draft: false,
        prerelease: false,
      },
    });
    if (created.status !== 201) {
      die(`GitHub API failed to create release ${tag} (${apiErrorMessage(created)})`);
    }
    release = created.json;
    log(`created release ${tag}`);
  } else {
    die(
      `release ${tag} already exists. Re-run yarn deploy so it publishes the next version.`,
    );
  }

  const releaseId = release.id;
  const existingAssets = Array.isArray(release.assets) ? release.assets : [];

  for (const filePath of files) {
    const name = path.basename(filePath);
    const existing = existingAssets.find((asset) => asset.name === name);
    if (existing && existing.id) {
      const del = await githubRequest(
        'DELETE',
        `/repos/${REPO}/releases/assets/${existing.id}`,
        { token },
      );
      if (del.status !== 204 && del.status !== 200) {
        die(
          `GitHub API failed to replace existing asset ${name} (${apiErrorMessage(del)})`,
        );
      }
    }
    const data = fs.readFileSync(filePath);
    const uploadPath = `/repos/${REPO}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`;
    const uploaded = await githubRequest('POST', uploadPath, {
      token,
      body: data,
      hostname: 'uploads.github.com',
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    if (uploaded.status !== 201) {
      die(`GitHub API failed to upload ${name} (${apiErrorMessage(uploaded)})`);
    }
    log(`uploaded ${name}`);
  }
}

async function publish(tag, files, title, notes, target) {
  const gh = findGh();
  if (gh) {
    log(`publishing with gh (${gh})`);
    publishWithGh(gh, tag, files, title, notes, target);
  } else {
    await publishWithApi(tag, files, title, notes, target);
  }
}

function runProductionInstallers() {
  const shell = yarnShell();
  fs.rmSync(STAGING_DIR, { recursive: true, force: true });
  fs.mkdirSync(STAGING_DIR, { recursive: true });

  log('running yarn production:mac');
  runOrDie('yarn', ['run', 'production:mac'], { cwd: ROOT, env: process.env, shell }, 'production:mac');
  stashInstallers();

  log('running yarn production:win with the same version as the mac installer');
  runOrDie(
    'yarn',
    ['run', 'production:win'],
    {
      cwd: ROOT,
      env: { ...process.env, SKIP_VERSION_BUMP: '1' },
      shell,
    },
    'production:win',
  );
  stashInstallers();
}

async function main() {
  log('build with production:mac and production:win, then upload only those .dmg and .exe files');
  runProductionInstallers();

  const version = readVersion();
  const tag = `v${version}`;
  const target = headSha();
  const title = tag;
  const notes = [
    `LIMSPLUS Connect ${tag} (Windows NSIS installer and macOS DMG).`,
    '',
    'macOS: if Gatekeeper says the app is damaged or from an unidentified developer, quit the installer, then run:',
    `xattr -dr com.apple.quarantine "/Applications/LIMSPLUS Connect ${version}.app"`,
    'A paid Apple Developer ID and notarization are required for a normal double-click open after download.',
  ].join('\n');

  const files = collectArtifacts(version, STAGING_DIR);
  if (files.length === 0) {
    const listing = fs.existsSync(STAGING_DIR)
      ? fs.readdirSync(STAGING_DIR).join(', ') || '(empty)'
      : '(missing .deploy-artifacts)';
    die(
      `no .dmg or .exe artifact matching version ${version} found in ${STAGING_DIR}. Files: ${listing}`,
    );
  }

  for (const filePath of files) {
    const st = fs.statSync(filePath);
    log(`artifact ${path.basename(filePath)} (${st.size} bytes)`);
  }

  const hasDmg = files.some((filePath) => filePath.toLowerCase().endsWith('.dmg'));
  const hasExe = files.some((filePath) => filePath.toLowerCase().endsWith('.exe'));
  if (!hasDmg || !hasExe) {
    die(
      `expected both a .dmg (production:mac) and a .exe (production:win) for ${version}. Found: ${files.map((filePath) => path.basename(filePath)).join(', ') || '(none)'}`,
    );
  }

  await publish(tag, files, title, notes, target);

  const releaseUrl = `https://github.com/${REPO}/releases/tag/${tag}`;
  log(`uploaded the production:mac .dmg and production:win .exe for ${version}`);
  log(`next yarn deploy starts by bumping ${version} inside production:mac`);
  log(`done. release: ${releaseUrl}`);
}

main().catch((err) => {
  die(err && err.message ? err.message : String(err));
});
