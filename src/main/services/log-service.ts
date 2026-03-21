import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { createWriteStream } from "fs";
import { clawdeskLogDir, clawdeskDiagnosticsDir } from "../adapters/platform.js";
import { AppError, ErrorCode } from "../models/error.js";
import { ensureDir } from "../adapters/file-ops.js";

export enum LogSource {
  Install = "install",
  Startup = "startup",
  Gateway = "gateway",
}

export interface ReadLogsData {
  source: string;
  lines: string[];
  path: string;
  truncated: boolean;
  exists: boolean;
}

export type DiagnosticsExportFormat = "text" | "bundle";

export interface ExportDiagnosticsData {
  filePath: string;
  format: DiagnosticsExportFormat;
  includedFiles: string[];
}

export function logFilePath(source: LogSource): string {
  return path.join(clawdeskLogDir(), `${source}.log`);
}

export function appendLogLine(source: LogSource, line: string): void {
  try {
    const logDir = clawdeskLogDir();
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const filePath = logFilePath(source);
    const ts = new Date().toISOString();
    fs.appendFileSync(filePath, `${ts} ${line}\n`, "utf8");
  } catch {
    // log failures must never crash the main process
  }
}

export async function readLogs(source: LogSource, lineLimit: number): Promise<ReadLogsData> {
  if (source === LogSource.Gateway) {
    return readGatewayLogs(lineLimit);
  }

  const filePath = logFilePath(source);
  if (!fs.existsSync(filePath)) {
    return { source, lines: [], path: filePath, truncated: false, exists: false };
  }

  try {
    const raw = await fsp.readFile(filePath, "utf8");
    const allLines = raw.split("\n").filter((l) => l.trim().length > 0);
    const truncated = allLines.length > lineLimit;
    const lines = truncated ? allLines.slice(-lineLimit) : allLines;
    return { source, lines, path: filePath, truncated, exists: true };
  } catch (e: unknown) {
    throw new AppError(ErrorCode.LogReadFailed, "Failed to read log file.", "Check file permissions and whether the log file is accessible.", { path: filePath, osError: String(e) });
  }
}

async function readGatewayLogs(lineLimit: number): Promise<ReadLogsData> {
  // Try the file written by gateway service first, then fall back to startup log
  const gatewayPath = logFilePath(LogSource.Gateway);
  if (fs.existsSync(gatewayPath)) {
    return readLogs(LogSource.Gateway, lineLimit);
  }
  // Fall back to startup log which contains gateway output
  return readLogs(LogSource.Startup, lineLimit);
}

export async function exportDiagnostics(
  source: LogSource,
  keyword: string | undefined,
  content: string,
  archive: boolean,
): Promise<ExportDiagnosticsData> {
  const diagDir = clawdeskDiagnosticsDir();
  await ensureDir(diagDir);

  const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);

  if (!archive) {
    // Text export
    const filePath = path.join(diagDir, `diagnostics-${ts}.txt`);
    const lines: string[] = [];
    lines.push(`=== ClawDesk Diagnostics Export ===`);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Source: ${source}`);
    if (keyword) lines.push(`Keyword filter: ${keyword}`);
    lines.push("");

    // Include provided content
    if (content) {
      lines.push("=== Provided Content ===");
      lines.push(content);
      lines.push("");
    }

    // Include log file
    const logPath = logFilePath(source);
    if (fs.existsSync(logPath)) {
      lines.push(`=== Log: ${logPath} ===`);
      try {
        const logContent = await fsp.readFile(logPath, "utf8");
        const logLines = logContent.split("\n").filter(Boolean);
        const filtered = keyword
          ? logLines.filter((l) => l.toLowerCase().includes(keyword.toLowerCase()))
          : logLines;
        lines.push(...filtered);
      } catch {
        lines.push("[Failed to read log file]");
      }
      lines.push("");
    }

    const text = lines.join("\n");
    await fsp.writeFile(filePath, text, "utf8");

    return {
      filePath,
      format: "text",
      includedFiles: [filePath],
    };
  }

  // Bundle (ZIP) export
  const filePath = path.join(diagDir, `diagnostics-${ts}.zip`);

  const archiverLib = (await import("archiver")).default;
  const output = createWriteStream(filePath);
  const zip = archiverLib("zip", { zlib: { level: 6 } });

  const includedFiles: string[] = [];

  await new Promise<void>((resolve, reject) => {
    output.on("close", resolve);
    zip.on("error", reject);
    zip.pipe(output);

    // Manifest
    const manifest = {
      generatedAt: new Date().toISOString(),
      format: "bundle",
      source,
      keyword: keyword ?? null,
    };
    zip.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });

    // Provided content
    if (content) {
      zip.append(content, { name: "content.txt" });
      includedFiles.push("content.txt");
    }

    // Log files
    for (const src of [LogSource.Install, LogSource.Startup, LogSource.Gateway]) {
      const logPath = logFilePath(src);
      if (fs.existsSync(logPath)) {
        const logName = `logs/${src}.log`;
        zip.file(logPath, { name: logName });
        includedFiles.push(logName);
      }
    }

    zip.finalize();
  });

  return { filePath, format: "bundle", includedFiles };
}
