#!/usr/bin/env -S deno run --allow-read=.
import {
  dirname,
  relative,
  resolve,
} from "https://deno.land/std@0.191.0/path/mod.ts";

/**
 * This program generates the README.md for the root directory.
 *
 * It reads from the file referred to by this program's first argument, and writes to stdout.
 *
 * Based on what it sees when it reads from the file, it may also read files from
 * the filesystem.
 *
 * It reads text, and writes text. The only syntax it understands is the
 * following directives:
 * - Any line that includes the text `@@include(filename)` will be replaced
 *   with the contents of the file, relative to the currently parsed file. The
 *   whole line will be replaced.
 * - Any shebang line at the start of any input file, will be removed.
 * - For any occurrence of /\sfrom\s+"(\..*)"/ the path will be extracted and resolved from the currently parsed file, and then resolved to a relative path from the root of the git repo, then the whole `from` clause will be replaced with `from "${publishUrl}/${relativePathFromGitRoot}"`.
 * - The resulting text will be written to stdout.
 */
async function main() {
  const inputFilePath =
    (new URL(Deno.args[0], `file://${Deno.cwd()}/`)).pathname;
  const publishUrl = Deno.args[1];
  if (!inputFilePath) throw new Error("Missing inputFilePath argument");
  if (!publishUrl) throw new Error("Missing publishUrl argument");

  const inputText = await Deno.readTextFile(inputFilePath);
  const outputText = await processText(inputText, inputFilePath, publishUrl);
  console.log(outputText);
}

async function processText(
  inputText: string,
  inputFilePath: string,
  publishUrl: string,
): Promise<string> {
  const lines = inputText.split("\n");
  // skip any first line with shebang
  if (lines[0]?.startsWith("#!")) {
    lines.shift();
  }
  const forInclude = processLineForInclude(inputFilePath, publishUrl);
  const forImport = processLineForImport(inputFilePath, publishUrl);
  return (await Promise.all(lines.map(
    async function (line: string) {
      const lines1: string[] = (await forInclude(line)).split("\n");
      const lines2: string[] = lines1.map(forImport);
      return lines2.join("\n");
    },
  ))).join("\n");
}

function processLineForInclude(
  inputFilePath: string,
  publishUrl: string,
): (line: string) => Promise<string> {
  return async (line: string): Promise<string> => {
    const match = line.match(/@@include\((.*)\)/);
    if (match) {
      const matchedPath = match[1];
      const includeFilePath = resolve(dirname(inputFilePath), matchedPath);
      const resolvedIncludeFilePath = await Deno.realPath(includeFilePath);
      return await processText(
        await Deno.readTextFile(resolvedIncludeFilePath),
        resolvedIncludeFilePath,
        publishUrl,
      );
    }
    return line;
  };
}

function processLineForImport(
  inputFilePath: string,
  publishUrl: string,
): (line: string) => string {
  return (line: string): string => {
    const match = line.match(/\sfrom\s+"(\..*)"/);
    if (match) {
      const importPath = match[1];
      const step1: string =
        (new URL(importPath, `file://${inputFilePath}`)).pathname;
      const gitRoot = (new URL("../", import.meta.url)).pathname;
      const step2: string = relative(gitRoot, step1);
      return line.replace(
        /\sfrom\s+"(\..*)"/,
        ` from "${publishUrl}/${step2}"`,
      );
    }
    return line;
  };
}

if (import.meta.main) {
  await main();
}
