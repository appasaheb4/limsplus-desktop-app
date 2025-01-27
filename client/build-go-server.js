const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Paths
const serverDir = path.resolve(__dirname, '../server'); // Go server folder
const outputDir = path.resolve(__dirname, 'electron/server'); // Output folder for production
const buildOutputDir = path.resolve(__dirname, 'build/electron/server'); // Output folder for development
const serverBinary = process.platform === 'win32' ? 'server.exe' : 'server';

// Ensure both output directories exist
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(buildOutputDir, { recursive: true });

try {
  console.log('Installing Go server dependencies...');
  // Ensure Go modules are tidy
  execSync('go mod tidy', { cwd: serverDir, stdio: 'inherit' });

  console.log('Building Go server...');
  // Build the Go server
  const buildCommand = `go build -o ${path.join(outputDir, serverBinary)} ${path.join(serverDir, 'main.go')}`;
  execSync(buildCommand, { cwd: serverDir, stdio: 'inherit' });

  // Copy binary to the `build` folder for development mode
  fs.copyFileSync(
    path.join(outputDir, serverBinary),
    path.join(buildOutputDir, serverBinary),
  );

  console.log(
    'Go server built successfully and copied to development and production folders!',
  );
} catch (error) {
  console.error('Failed to build Go server:', error.message);
  console.error('Full error output:', error.stderr?.toString());
  process.exit(1);
}
