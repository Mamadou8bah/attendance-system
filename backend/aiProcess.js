const { spawn } = require('child_process');
const path = require('path');

let aiProc = null;

function startAI(options = {}) {
  if (aiProc) {
    console.log('[aiProcess] AI engine already running');
    return;
  }

  const scriptPath = path.resolve(__dirname, '..', 'ai-engine', 'main_phone.py');
  const pythonCmd = process.env.PYTHON || 'python';

  const env = { ...process.env };
  if (options.backendUrl) {
    env.BACKEND_URL = options.backendUrl;
  }
  if (options.videoUrl) {
    env.VIDEO_URL = options.videoUrl;
  }

  console.log('[aiProcess] Starting AI engine:', pythonCmd, scriptPath);

  aiProc = spawn(pythonCmd, [scriptPath], {
    env,
    stdio: 'inherit'
  });

  aiProc.on('exit', (code, signal) => {
    console.log(`[aiProcess] AI engine exited with code ${code}, signal ${signal}`);
    aiProc = null;
  });

  aiProc.on('error', (err) => {
    console.error('[aiProcess] Failed to start AI engine:', err.message);
    aiProc = null;
  });
}

function stopAI() {
  if (!aiProc) {
    console.log('[aiProcess] No AI engine process to stop');
    return;
  }

  console.log('[aiProcess] Stopping AI engine...');
  // Try graceful shutdown first
  aiProc.kill('SIGINT');
}

function isRunning() {
  return !!aiProc;
}

module.exports = {
  startAI,
  stopAI,
  isRunning
};
