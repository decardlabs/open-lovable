import { SandboxProvider, SandboxInfo, CommandResult } from '../types';
import { appConfig } from '@/config/app.config';
import { execSync, spawn, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);
const BASE_DIR = '/tmp/open-lovable-sandbox';

export class LocalProvider extends SandboxProvider {
  private sandboxDir: string = '';
  private viteProcess: any = null;
  private existingFiles: Set<string> = new Set();

  async createSandbox(): Promise<SandboxInfo> {
    // Kill any existing sandbox
    if (this.sandboxDir) {
      try {
        execSync(`rm -rf ${this.sandboxDir}`);
      } catch {}
    }
    this.existingFiles.clear();

    // Create unique sandbox directory
    this.sandboxDir = path.join(BASE_DIR, `sandbox-${Date.now()}`);
    fs.mkdirSync(this.sandboxDir, { recursive: true });

    const sandboxId = `local-${Date.now()}`;
    this.sandboxInfo = {
      sandboxId,
      url: 'http://localhost:5173',
      provider: 'e2b', // Keep 'e2b' for compatibility
      createdAt: new Date()
    };

    return this.sandboxInfo;
  }

  async setupViteApp(): Promise<void> {
    if (!this.sandboxDir) throw new Error('No sandbox directory');

    // Create src directory
    fs.mkdirSync(path.join(this.sandboxDir, 'src'), { recursive: true });

    // Write package.json
    const packageJson = {
      name: 'sandbox-app',
      version: '1.0.0',
      type: 'module',
      scripts: {
        dev: 'vite --host',
        build: 'vite build',
        preview: 'vite preview'
      },
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0'
      },
      devDependencies: {
        '@vitejs/plugin-react': '^4.0.0',
        vite: '^4.3.9',
        tailwindcss: '^3.3.0',
        postcss: '^8.4.31',
        autoprefixer: '^10.4.16'
      }
    };
    fs.writeFileSync(
      path.join(this.sandboxDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Write vite.config.js
    fs.writeFileSync(
      path.join(this.sandboxDir, 'vite.config.js'),
      `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    hmr: false,
    allowedHosts: ['localhost', '127.0.0.1']
  }
})`
    );

    // Write tailwind.config.js
    fs.writeFileSync(
      path.join(this.sandboxDir, 'tailwind.config.js'),
      `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: { extend: {} },
  plugins: [],
}`
    );

    // Write postcss.config.js
    fs.writeFileSync(
      path.join(this.sandboxDir, 'postcss.config.js'),
      `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`
    );

    // Write index.html
    fs.writeFileSync(
      path.join(this.sandboxDir, 'index.html'),
      `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sandbox App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`
    );

    // Write src/main.jsx
    fs.writeFileSync(
      path.join(this.sandboxDir, 'src', 'main.jsx'),
      `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`
    );

    // Write src/App.jsx
    fs.writeFileSync(
      path.join(this.sandboxDir, 'src', 'App.jsx'),
      `function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">Sandbox Ready</h1>
        <p className="text-lg text-gray-400">
          Start building your React app with Vite and Tailwind CSS!
        </p>
      </div>
    </div>
  )
}

export default App`
    );

    // Write src/index.css
    fs.writeFileSync(
      path.join(this.sandboxDir, 'src', 'index.css'),
      `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background-color: rgb(17 24 39);
}`
    );

    // Track initial files
    this.existingFiles.add('src/App.jsx');
    this.existingFiles.add('src/main.jsx');
    this.existingFiles.add('src/index.css');
    this.existingFiles.add('index.html');
    this.existingFiles.add('package.json');
    this.existingFiles.add('vite.config.js');
    this.existingFiles.add('tailwind.config.js');
    this.existingFiles.add('postcss.config.js');

    // Install dependencies
    console.log('[LocalProvider] Installing npm packages...');
    execSync('npm install', { cwd: this.sandboxDir, stdio: 'pipe' });

    // Start Vite dev server
    console.log('[LocalProvider] Starting Vite dev server...');
    this.viteProcess = spawn('npm', ['run', 'dev'], {
      cwd: this.sandboxDir,
      stdio: 'pipe',
      env: { ...process.env, FORCE_COLOR: '0' }
    });

    this.viteProcess.stdout?.on('data', (data: Buffer) => {
      console.log(`[Vite] ${data.toString().trim()}`);
    });
    this.viteProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[Vite] ${data.toString().trim()}`);
    });

    // Wait for Vite to start
    await new Promise(resolve => setTimeout(resolve, appConfig.e2b.viteStartupDelay));
  }

  // Remap sandbox absolute paths to local directory
  private resolvePath(input: string): string {
    // Handle /home/user/app/... paths from sandbox
    if (input.startsWith('/home/user/app/')) {
      return path.join(this.sandboxDir, input.replace('/home/user/app/', ''));
    }
    if (input.startsWith('/home/user/app')) {
      return this.sandboxDir;
    }
    // Already an absolute path
    if (input.startsWith('/')) {
      return input;
    }
    // Relative path - resolve relative to sandbox dir
    return path.join(this.sandboxDir, input);
  }

  async runCommand(command: string): Promise<CommandResult> {
    try {
      // Remap /home/user/app/ paths in the command to local sandbox dir
      const remapped = command.replace(/\/home\/user\/app\//g, this.sandboxDir + '/');
      const result = await execAsync(remapped, { cwd: this.sandboxDir });
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0,
        success: true
      };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.code || 1,
        success: false
      };
    }
  }

  async writeFile(path_str: string, content: string): Promise<void> {
    const fullPath = this.resolvePath(path_str);
    const dir = path.dirname(fullPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content);
    this.existingFiles.add(path_str);
  }

  async readFile(path_str: string): Promise<string> {
    const fullPath = this.resolvePath(path_str);
    return fs.readFileSync(fullPath, 'utf-8');
  }

  async listFiles(directory: string = ''): Promise<string[]> {
    const dir = directory || this.sandboxDir;
    const files: string[] = [];

    function walk(dirPath: string, relativePath: string) {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const fullPath = path.join(dirPath, entry.name);
        const relPath = relativePath ? path.join(relativePath, entry.name) : entry.name;
        if (entry.isDirectory()) {
          walk(fullPath, relPath);
        } else {
          files.push(relPath);
        }
      }
    }

    walk(dir, '');
    return files;
  }

  async installPackages(packages: string[]): Promise<CommandResult> {
    const packageList = packages.join(' ');
    const flags = appConfig.packages.useLegacyPeerDeps ? '--legacy-peer-deps' : '';
    const cmd = `npm install ${packageList} ${flags}`.trim();

    try {
      const result = await execAsync(cmd, { cwd: this.sandboxDir });

      if (appConfig.packages.autoRestartVite) {
        await this.restartViteServer();
      }

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0,
        success: true
      };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.code || 1,
        success: false
      };
    }
  }

  async restartViteServer(): Promise<void> {
    if (this.viteProcess) {
      this.viteProcess.kill();
      this.viteProcess = null;
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    this.viteProcess = spawn('npm', ['run', 'dev'], {
      cwd: this.sandboxDir,
      stdio: 'pipe',
      env: { ...process.env, FORCE_COLOR: '0' }
    });

    await new Promise(resolve => setTimeout(resolve, appConfig.e2b.viteStartupDelay));
  }

  getSandboxUrl(): string | null {
    return 'http://localhost:5173';
  }

  getSandboxInfo(): SandboxInfo | null {
    return this.sandboxInfo;
  }

  async terminate(): Promise<void> {
    if (this.viteProcess) {
      try {
        this.viteProcess.kill();
      } catch {}
      this.viteProcess = null;
    }
    if (this.sandboxDir) {
      try {
        execSync(`rm -rf ${this.sandboxDir}`);
      } catch {}
      this.sandboxDir = '';
    }
    this.sandboxInfo = null;
  }

  isAlive(): boolean {
    return !!this.sandboxDir && fs.existsSync(this.sandboxDir);
  }
}
