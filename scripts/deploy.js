#!/usr/bin/env node
/**
 * Builds the Electron app for Windows (.exe / NSIS) and macOS (.dmg)
 * in one run, then publishes the installers to a GitHub Release for
 * the current version. Signing is skipped when no certificate is present.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const CLIENT = path.join(ROOT, 'client');
const DIST_DIR = path.join(CLIENT, 'dist');
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

function collectArtifacts(version) {
  if (!fs.existsSync(DIST_DIR)) {
    log(`build output directory not found: ${DIST_DIR}`);
    return [];
  }
  const names = fs.readdirSync(DIST_DIR);
  const selected = [];

  const installers = names.filter((name) => {
    const lower = name.toLowerCase();
    return (
      name.includes(version) &&
      (lower.endsWith('.dmg') || lower.endsWith('.exe'))
    );
  });

  for (const name of installers) {
    selected.push(name);
    const blockmap = `${name}.blockmap`;
    if (names.includes(blockmap) && !selected.includes(blockmap)) {
      selected.push(blockmap);
    }
  }

  for (const name of names) {
    if (
      name.includes(version) &&
      name.toLowerCase().endsWith('.blockmap') &&
      !selected.includes(name)
    ) {
      selected.push(name);
    }
  }

  for (const name of names) {
    if (/^latest.*\.ya?ml$/i.test(name) && !selected.includes(name)) {
      selected.push(name);
    }
  }

  const paths = [];
  for (const name of selected) {
    const filePath = path.join(DIST_DIR, name);
    const st = fs.statSync(filePath);
    if (!st.isFile() || st.size === 0) {
      log(`skipping missing or empty artifact: ${filePath}`);
      continue;
    }
    paths.push(filePath);
  }
  return paths;
}

function releaseExistsGh(gh, tag) {
  const result = runCapture(gh, ['release', 'view', tag, '--repo', REPO]);
  return result.status === 0;
}

function publishWithGh(gh, tag, files, title, notes, target) {
  if (releaseExistsGh(gh, tag)) {
    log(`release ${tag} already exists; uploading artifacts with --clobber`);
    const result = run(gh, [
      'release',
      'upload',
      tag,
      ...files,
      '--repo',
      REPO,
      '--clobber',
    ]);
    if (result.status !== 0) die(`gh release upload failed (exit ${result.status})`);
  } else {
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
    log(`release ${tag} already exists; uploading artifacts (replacing if present)`);
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

function runSharedPrep(env) {
  const shell = yarnShell();
  runOrDie('yarn', ['run', 'bundle-lite-resources'], { env, shell }, 'bundle-lite-resources');
  runOrDie('yarn', ['run', 'build-server'], { env, shell }, 'build-server');
  runOrDie('node', ['scripts/sync-lite-product-name.js'], { env }, 'sync-lite-product-name');
  runOrDie('yarn', ['run', 'dump-database'], { env, shell }, 'dump-database');
}

function runClientCompile(env) {
  const shell = yarnShell();
  const clientOpts = { cwd: CLIENT, env, shell };
  runOrDie('yarn', ['install'], clientOpts, 'client yarn install');
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  log('cleared client/dist');
  runOrDie('yarn', ['build'], clientOpts, 'client yarn build');
  const tsc = path.join(CLIENT, 'node_modules', 'typescript', 'bin', 'tsc');
  runOrDie('node', [tsc, '-p', 'electron'], { cwd: CLIENT, env }, 'tsc -p electron');
  runOrDie('yarn', ['build:server'], clientOpts, 'client build:server');
  runOrDie(
    'node',
    [path.join(ROOT, 'scripts', 'sync-lite-product-name.js')],
    { cwd: CLIENT, env },
    'sync-lite-product-name (client)',
  );
  runOrDie(
    'node',
    [path.join(ROOT, 'scripts', 'write-install-identity.js')],
    { cwd: CLIENT, env },
    'write-install-identity',
  );
}

function runElectronBuilder(env) {
  log('running npx electron-builder --win --mac with CSC_IDENTITY_AUTO_DISCOVERY=false');
  const result = run('npx', ['electron-builder', '--win', '--mac'], {
    cwd: CLIENT,
    env,
    shell: yarnShell(),
  });
  if (result.status === 0 && !result.signal) return null;
  const signal = result.signal ? `, signal ${result.signal}` : '';
  return `electron-builder --win --mac failed (exit ${result.status}${signal})`;
}

async function main() {
  const version = readVersion();
  const tag = `v${version}`;
  const target = headSha();
  const title = tag;
  const notes = `LIMSPLUS Connect ${tag} (Windows NSIS installer and macOS DMG).`;
  const env = { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' };

  log(`version ${version}, host ${process.platform}, target ${target}`);
  log('building Windows .exe (nsis) and macOS .dmg in one run');

  runSharedPrep(env);
  runClientCompile(env);
  const buildError = runElectronBuilder(env);
  if (buildError) {
    log(`${buildError}. Will upload any artifacts that were produced.`);
  }

  const files = collectArtifacts(version);
  if (files.length === 0) {
    const listing = fs.existsSync(DIST_DIR)
      ? fs.readdirSync(DIST_DIR).join(', ') || '(empty)'
      : '(missing client/dist)';
    die(
      `${buildError ? `${buildError}; ` : ''}no .dmg or .exe artifact matching version ${version} found in ${DIST_DIR}. Files: ${listing}`,
    );
  }

  for (const filePath of files) {
    const st = fs.statSync(filePath);
    log(`artifact ${path.basename(filePath)} (${st.size} bytes)`);
  }

  await publish(tag, files, title, notes, target);

  const releaseUrl = `https://github.com/${REPO}/releases/tag/${tag}`;
  if (buildError) {
    log(`done with build errors. release: ${releaseUrl}`);
    console.error(`deploy: ${buildError}`);
    process.exit(1);
  }
  log(`done. release: ${releaseUrl}`);
}

main().catch((err) => {
  die(err && err.message ? err.message : String(err));
});
