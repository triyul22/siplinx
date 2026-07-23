#!/usr/bin/env node
/**
 * Auto-detect GPU and run Tauri with appropriate features
 */

const { execSync, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Get the command (dev or build)
const command = process.argv[2];
if (!command || !['dev', 'build'].includes(command)) {
  console.error('Usage: node tauri-auto.js [dev|build] [...tauri args]');
  process.exit(1);
}
const passthroughArgs = process.argv.slice(3);

const frontendDir = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(frontendDir, '..');

function detectTargetTriple() {
  try {
    return execFileSync('rustc', ['--print', 'host-tuple'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
    }).trim();
  } catch {
    const verbose = execFileSync('rustc', ['-vV'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
    });
    const hostLine = verbose.split(/\r?\n/).find((line) => line.startsWith('host:'));
    if (!hostLine) {
      throw new Error('Failed to determine Rust target triple');
    }
    return hostLine.split(/\s+/)[1];
  }
}

function prepareLlamaHelper(buildCommand, detectedFeature, env) {
  if (process.env.SKIP_LLAMA_HELPER_BUILD === '1') {
    console.log('Skipping llama-helper build because SKIP_LLAMA_HELPER_BUILD=1');
    return;
  }

  // The desktop release is currently cloud-summary-only, so llama-helper is
  // not bundled unless it is explicitly listed in Tauri's externalBin.
  // Keep this guard in sync with tauri.conf.json instead of making every
  // Windows release depend on the optional local summary sidecar.
  try {
    const tauriConfigPath = path.join(frontendDir, 'src-tauri', 'tauri.conf.json');
    const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
    const externalBins = tauriConfig?.bundle?.externalBin ?? [];
    if (!externalBins.some((binary) => String(binary).includes('llama-helper'))) {
      console.log('Skipping llama-helper build because it is not configured in Tauri externalBin');
      return;
    }
  } catch (err) {
    throw new Error(`Could not inspect Tauri externalBin configuration: ${err.message}`);
  }

  const helperDir = path.join(workspaceRoot, 'llama-helper');
  if (!fs.existsSync(helperDir)) {
    throw new Error(`Could not find llama-helper directory at ${helperDir}`);
  }

  const profile = buildCommand === 'build' ? 'release' : 'debug';
  const cargoArgs = ['build', '-p', 'llama-helper'];

  if (profile === 'release') {
    cargoArgs.push('--release');
  }

  // llama-cpp-2 does not support CoreML. Keep Windows sidecar CPU-only by
  // default because Vulkan/CUDA llama-helper builds are much more fragile than
  // the main whisper-rs build, and the helper is only used for summaries.
  let helperFeature = '';
  if (os.platform() === 'darwin' && detectedFeature) {
    helperFeature = detectedFeature === 'coreml' ? 'metal' : detectedFeature;
  }

  if (helperFeature) {
    cargoArgs.push('--features', helperFeature);
  }

  console.log(`Building llama-helper sidecar (${profile}${helperFeature ? `, ${helperFeature}` : ', cpu'})...`);
  execFileSync('cargo', cargoArgs, {
    cwd: workspaceRoot,
    stdio: 'inherit',
    env,
  });

  const targetTriple = detectTargetTriple();
  const extension = os.platform() === 'win32' ? '.exe' : '';
  const sourcePath = path.join(workspaceRoot, 'target', profile, `llama-helper${extension}`);
  const binariesDir = path.join(frontendDir, 'src-tauri', 'binaries');
  const destinationPath = path.join(binariesDir, `llama-helper-${targetTriple}${extension}`);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Built llama-helper was not found at ${sourcePath}`);
  }

  fs.mkdirSync(binariesDir, { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);

  if (os.platform() !== 'win32') {
    fs.chmodSync(destinationPath, 0o755);
  }

  console.log(`Copied llama-helper sidecar to ${destinationPath}`);
}

// Detect GPU feature
let feature = '';

// Check for environment variable override first
if (process.env.TAURI_GPU_FEATURE) {
  feature = process.env.TAURI_GPU_FEATURE;
  console.log(`🔧 Using forced GPU feature from environment: ${feature}`);
} else {
  try {
    const result = execFileSync(process.execPath, [path.join(frontendDir, 'scripts', 'auto-detect-gpu.js')], {
      cwd: frontendDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'inherit']
    });
    feature = result.trim();
  } catch (err) {
    // If detection fails, continue with no features
  }
}

console.log(''); // Empty line for spacing

// Platform-specific environment variables
const platform = os.platform();
const env = { ...process.env };

if (platform === 'linux' && feature === 'cuda') {
  console.log('🐧 Linux/CUDA detected: Setting CMAKE flags for NVIDIA GPU');
  env.CMAKE_CUDA_ARCHITECTURES = '75';
  env.CMAKE_CUDA_STANDARD = '17';
  env.CMAKE_POSITION_INDEPENDENT_CODE = 'ON';
}

try {
  prepareLlamaHelper(command, feature, env);
} catch (err) {
  console.error(`Failed to prepare llama-helper sidecar: ${err.message}`);
  process.exit(1);
}

// Build the tauri command
let tauriCmd = `tauri ${command}`;
if (passthroughArgs.length > 0) {
  tauriCmd += ` ${passthroughArgs.join(' ')}`;
}
if (feature && feature !== 'none') {
  tauriCmd += passthroughArgs.includes('--')
    ? ` --features ${feature}`
    : ` -- --features ${feature}`;
  console.log(`🚀 Running: tauri ${command} with features: ${feature}`);
} else {
  console.log(`🚀 Running: tauri ${command} (CPU-only mode)`);
}
console.log('');

// Execute the command
try {
  execSync(tauriCmd, { cwd: frontendDir, stdio: 'inherit', env });
} catch (err) {
  process.exit(err.status || 1);
}
