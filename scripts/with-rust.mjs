import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

function buildEnvWithRustPath(baseEnv) {
  const env = { ...baseEnv };
  const currentPath = env.PATH ?? env.Path ?? "";

  const candidates = [];
  if (process.env.CARGO_HOME) {
    candidates.push(join(process.env.CARGO_HOME, "bin"));
  }

  if (process.platform === "win32") {
    const userProfile = process.env.USERPROFILE ?? homedir();
    candidates.push(join(userProfile, ".cargo", "bin"));
  } else {
    const home = process.env.HOME ?? homedir();
    candidates.push(join(home, ".cargo", "bin"));
  }

  const valid = candidates.filter((item) => existsSync(item));
  if (valid.length === 0) {
    return env;
  }

  const unique = [...new Set(valid)];
  const prepended = unique.join(delimiter);
  env.PATH = currentPath ? `${prepended}${delimiter}${currentPath}` : prepended;
  return env;
}

function run() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: node scripts/with-rust.mjs <command> [...args]");
    process.exit(1);
  }

  const [command, ...commandArgs] = args;
  const env = buildEnvWithRustPath(process.env);
  const vsDevCmd = process.platform === "win32" ? findVsDevCmd(env) : null;
  const windowsHelperPath = fileURLToPath(new URL("./with-rust-win.cmd", import.meta.url));

  const child =
    process.platform === "win32"
      ? spawn("cmd.exe", ["/d", "/c", windowsHelperPath, command, ...commandArgs], {
          stdio: "inherit",
          env: {
            ...env,
            CLAWDESK_VSDEVCMD: vsDevCmd ?? "",
            VSCMD_SKIP_SENDTELEMETRY: "1",
          },
          shell: false,
        })
      : spawn(command, commandArgs, {
          stdio: "inherit",
          env,
          shell: false,
        });

  child.on("error", (error) => {
    console.error(`[with-rust] Failed to start command: ${command}`);
    console.error(error.message);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

function findVsDevCmd(env) {
  const programFilesX86 = env["ProgramFiles(x86)"] ?? process.env["ProgramFiles(x86)"];
  const candidates = [];

  if (programFilesX86) {
    const baseDir = join(programFilesX86, "Microsoft Visual Studio", "2022");
    for (const edition of ["BuildTools", "Community", "Professional", "Enterprise"]) {
      candidates.push(join(baseDir, edition, "Common7", "Tools", "VsDevCmd.bat"));
    }
  }

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

run();
