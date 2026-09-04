#!/usr/bin/env bun

import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Initialize a freshly-created worktree.
 *
 * This script intentionally avoids external dependencies because it is expected
 * to run before `bun install`. Keep commands as argv arrays instead of shell
 * strings so they work on Linux, macOS, and Windows.
 */

type Command = {
  readonly label: string;
  readonly cmd: readonly string[];
  readonly ignoreExitCode?: boolean;
};

const commands: readonly Command[] = [
  {
    label: 'Fetch latest main from origin',
    cmd: ['git', 'fetch', 'origin', 'main:refs/remotes/origin/main'],
    ignoreExitCode: true,
  },
  {
    label: 'Rebase worktree onto origin/main',
    cmd: ['git', 'rebase', 'origin/main'],
    ignoreExitCode: true,
  },
  { label: 'Install Bun dependencies', cmd: ['bun', 'install'] },
  { label: 'Build application', cmd: ['bun', 'run', 'build'] },
  { label: 'Typecheck', cmd: ['bun', 'run', 'check'] },
  {
    label: 'Update Agent Skills',
    cmd: ['bunx', '--bun', 'skills', 'experimental_install'],
    ignoreExitCode: true,
  },
  {
    label: 'Auto-commit updated skills (if changed)',
    cmd: ['git', 'commit', '-m', 'chore(skills): auto-update agent skills'],
    ignoreExitCode: true,
  },
];

function quoteArg(arg: string): string {
  return /\s/.test(arg) ? JSON.stringify(arg) : arg;
}

function formatCommand(command: readonly string[]): string {
  return command.map(quoteArg).join(' ');
}

async function runCommand(command: Command): Promise<void> {
  // Handle git add for the auto-commit step
  if (command.label === 'Auto-commit updated skills (if changed)') {
    const addProc = Bun.spawn(['git', 'add', '.agents/skills/'], { env: Bun.env });
    await addProc.exited;

    // Check if there are changes
    const diffProc = Bun.spawn(['git', 'diff-index', '--quiet', 'HEAD'], { env: Bun.env });
    const diffExit = await diffProc.exited;
    if (diffExit === 0) {
      console.log(`\n==> ${command.label}`);
      console.log(`$ No changes to commit.`);
      return;
    }
  }

  console.log(`\n==> ${command.label}`);
  console.log(`$ ${formatCommand(command.cmd)}`);

  let proc: Bun.Subprocess<'inherit', 'inherit', 'inherit'>;
  try {
    proc = Bun.spawn([...command.cmd], {
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
      env: Bun.env,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!command.ignoreExitCode) {
      throw new Error(`Failed to start command: ${formatCommand(command.cmd)}\n${message}`);
    } else {
      console.warn(`Warning: Failed to start command: ${message}`);
      return;
    }
  }

  const exitCode = await proc.exited;
  if (exitCode !== 0 && !command.ignoreExitCode) {
    throw new Error(`Command failed with exit code ${exitCode}: ${formatCommand(command.cmd)}`);
  }
}

async function copyEnvFile() {
  console.log(`\n==> Copy .env from source checkout`);
  const sourcePath = process.env.PASEO_SOURCE_CHECKOUT_PATH;
  if (!sourcePath) {
    console.log(`$ PASEO_SOURCE_CHECKOUT_PATH not set, skipping.`);
    return;
  }

  const envSource = join(sourcePath, '.env');
  const envDest = join(process.cwd(), '.env');

  if (existsSync(envSource)) {
    copyFileSync(envSource, envDest);
    console.log(`$ Copied .env from ${envSource}`);
  } else {
    console.log(`$ No .env found at ${envSource}, skipping.`);
  }
}

async function main(): Promise<void> {
  await copyEnvFile();

  for (const command of commands) {
    await runCommand(command);
  }

  console.log('\nWorktree initialization complete.');
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n${message}`);
  process.exit(1);
}
