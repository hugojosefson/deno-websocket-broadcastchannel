import { basename, extname } from "https://deno.land/std@0.193.0/path/mod.ts";
import type { Debug } from "https://deno.land/x/quiet_debug@v1.0.0/mod.ts";
import { debug } from "https://deno.land/x/quiet_debug@v1.0.0/mod.ts";

/**
 * A {@link https://deno.land/x/quiet_debug} logger, with an extra method to create labelled sub-loggers.
 */
export interface Logger extends Debug {
  /**
   * Creates a sub-logger, with an extra label prefixed to all messages.
   * @param label The label to prefix to all messages.
   */
  sub(label: string): Logger;
}

type FileUrl = `file://${string}`;

function isFileUrl(url: string): url is FileUrl {
  return url.startsWith("file://");
}

function calculateLabel(labelOrMetaImportUrl: string): string {
  if (isFileUrl(labelOrMetaImportUrl)) {
    const url: FileUrl = labelOrMetaImportUrl;
    const ext: string = extname(url);
    return basename(url, ext);
  }
  return labelOrMetaImportUrl;
}

const labelCounts = new Map<string, number>();

function countLabel(label: string): number {
  const count = (labelCounts.get(label) ?? 0) + 1;
  labelCounts.set(label, count);
  return count;
}

/**
 * Creates a logger with a label. Can extract relevant label from {@link import.meta.url} if supplied.
 * @param labelOrMetaImportUrl The label, or the `import.meta.url` of the module.
 * @returns A {@link Logger}.
 */
export function logger(labelOrMetaImportUrl: string): Logger {
  const label: string = calculateLabel(labelOrMetaImportUrl);

  const debugLogger: Debug = debug(
    `pid(${Deno.pid})/${label}/${countLabel(label)}`,
  );
  const hasSub: Pick<Logger, "sub"> = {
    sub(subLabel: string): Logger {
      return logger(`${label}:${subLabel}`);
    },
  };
  return Object.assign(debugLogger, hasSub) as Logger;
}
