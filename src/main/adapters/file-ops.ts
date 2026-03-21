import fs from "fs/promises";
import path from "path";

/**
 * Atomic file write using a temp-file + rename strategy.
 * Prevents partial writes from corrupting the target file.
 */
export async function safeWriteBytes(targetPath: string, content: string | Buffer): Promise<void> {
  const dir = path.dirname(targetPath);
  const base = path.basename(targetPath);
  const tempPath = path.join(dir, `${base}.tmp.${process.pid}.${Date.now()}`);

  const bytes = typeof content === "string" ? Buffer.from(content, "utf8") : content;

  await fs.writeFile(tempPath, bytes);

  try {
    await fs.rename(tempPath, targetPath);
  } catch {
    // On Windows, rename fails if target exists — fallback: swap then rename
    const swapPath = path.join(dir, `${base}.swap.${process.pid}.${Date.now()}`);
    try {
      await fs.rename(targetPath, swapPath);
      await fs.rename(tempPath, targetPath);
      await fs.unlink(swapPath).catch(() => undefined);
    } catch (rollbackError) {
      await fs.unlink(tempPath).catch(() => undefined);
      throw rollbackError;
    }
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}
