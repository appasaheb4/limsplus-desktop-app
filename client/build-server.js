const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const serverDir = path.resolve(__dirname, '../server');
const outputDir = path.resolve(__dirname, 'electron/server');
const buildOutputDir = path.resolve(__dirname, 'build/electron/server');
const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
const serverBinary = process.platform === 'win32' ? 'server.exe' : 'server';

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(buildOutputDir, { recursive: true });

try {
  console.log('Installing Python server dependencies...');
  execSync(`${pythonCmd} -m pip install -r requirements.txt`, {
    cwd: serverDir,
    stdio: 'inherit',
  });

  console.log('Installing PyInstaller...');
  execSync(`${pythonCmd} -m pip install pyinstaller`, {
    cwd: serverDir,
    stdio: 'inherit',
  });

  console.log('Building standalone server executable with PyInstaller...');
  // --onefile: single executable, no Python env needed on target machine
  // --hidden-import: aiohttp relies on these at runtime but PyInstaller can miss them
  const hiddenImports = [
    'aiohttp',
    'aiohttp.web',
    'aiohttp.web_runner',
    'aiohttp.web_request',
    'aiohttp.web_response',
    'aiohttp.web_ws',
    'multidict',
    'yarl',
    'aiosignal',
    'frozenlist',
    'async_timeout',
    'serial',
    'serial.tools',
    'serial.tools.list_ports',
  ]
    .map((m) => `--hidden-import=${m}`)
    .join(' ');

  execSync(
    `${pythonCmd} -m PyInstaller --onefile --clean --name server ${hiddenImports} main.py`,
    { cwd: serverDir, stdio: 'inherit' },
  );

  const builtBinary = path.join(serverDir, 'dist', serverBinary);

  if (!fs.existsSync(builtBinary)) {
    throw new Error(`PyInstaller build succeeded but binary not found at ${builtBinary}`);
  }

  fs.copyFileSync(builtBinary, path.join(outputDir, serverBinary));
  fs.copyFileSync(builtBinary, path.join(buildOutputDir, serverBinary));

  // Clean up PyInstaller artifacts from server directory
  const cleanDirs = ['build', 'dist', '__pycache__'];
  for (const dir of cleanDirs) {
    const dirPath = path.join(serverDir, dir);
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  }
  const specFile = path.join(serverDir, 'server.spec');
  if (fs.existsSync(specFile)) {
    fs.unlinkSync(specFile);
  }

  console.log(
    'Python server built successfully! The executable runs without Python installed.',
  );
} catch (error) {
  console.error('Failed to build Python server:', error.message);
  console.error('Full error output:', error.stderr?.toString());
  process.exit(1);
}
