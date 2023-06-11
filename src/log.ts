import { basename, extname } from "https://deno.land/std@0.191.0/path/mod.ts";
import type { Debug } from "https://deno.land/x/quiet_debug@v1.0.0/mod.ts";
import { debug } from "https://deno.land/x/quiet_debug@v1.0.0/mod.ts";

export interface Logger extends Debug {
  sub(label: string): Logger;
}

type FileUrl = `file://${string}`;

function isFileUrl(url: string): url is FileUrl {
  return url.startsWith("file://");
}

function calculateLabel(labelOrMetaImportUrl: string): string {
  if (isFileUrl(labelOrMetaImportUrl)) {
    const url = labelOrMetaImportUrl;
    const ext = extname(url);
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

export function logger(labelOrMetaImportUrl: string): Logger {
  const label = calculateLabel(labelOrMetaImportUrl);
  return Object.assign(
    debug(`pid(${Deno.pid})/${label}/${countLabel(label)}`),
    {
      sub(subLabel: string): Logger {
        return logger(`${label}:${subLabel}`);
      },
    },
  );
}
