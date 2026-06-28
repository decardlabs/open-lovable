import { NextResponse } from 'next/server';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';

declare global {
  var activeSandbox: any;
  var activeSandboxProvider: any;
}

// Helper to run commands via provider
async function runCommand(cmd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const provider = sandboxManager.getActiveProvider() || global.activeSandboxProvider;

  if (provider && typeof provider.runCommand === 'function') {
    return await provider.runCommand(cmd);
  }

  if (global.activeSandbox?.runCommand) {
    // Legacy SDK interface - call with args format but handle response
    const res = await global.activeSandbox.runCommand({ cmd: 'bash', args: ['-c', cmd] });
    return {
      stdout: typeof res.stdout === 'function' ? await res.stdout() : (res.stdout || ''),
      stderr: typeof res.stderr === 'function' ? await res.stderr() : (res.stderr || ''),
      exitCode: res.exitCode || 0
    };
  }

  return { stdout: '', stderr: 'No command interface available', exitCode: 1 };
}

export async function POST() {
  try {
    const provider = sandboxManager.getActiveProvider() || global.activeSandboxProvider;
    if (!provider && !global.activeSandbox) {
      return NextResponse.json({
        success: false,
        error: 'No active sandbox'
      }, { status: 400 });
    }

    console.log('[create-zip] Creating project zip...');

    // Create zip file using bash -c for proper glob expansion
    const zipResult = await runCommand(
      `bash -c 'cd . && zip -r /tmp/project.zip . -x "node_modules/*" ".git/*" ".next/*" "dist/*" "build/*" "*.log"'`
    );

    if (zipResult.exitCode !== 0) {
      const error = zipResult.stderr || 'Unknown error';
      throw new Error(`Failed to create zip: ${error}`);
    }

    const sizeResult = await runCommand(
      `bash -c 'ls -la /tmp/project.zip | awk "{print \$5}"'`
    );

    const fileSize = sizeResult.stdout.trim();
    console.log(`[create-zip] Created project.zip (${fileSize} bytes)`);

    // Read the zip file and convert to base64
    const readResult = await runCommand(
      `bash -c 'base64 /tmp/project.zip'`
    );

    if (readResult.exitCode !== 0) {
      const error = readResult.stderr || 'Unknown error';
      throw new Error(`Failed to read zip file: ${error}`);
    }

    const base64Content = readResult.stdout.trim();

    // Create a data URL for download
    const dataUrl = `data:application/zip;base64,${base64Content}`;

    return NextResponse.json({
      success: true,
      dataUrl,
      fileName: 'vercel-sandbox-project.zip',
      message: 'Zip file created successfully'
    });

  } catch (error) {
    console.error('[create-zip] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message
      },
      { status: 500 }
    );
  }
}
