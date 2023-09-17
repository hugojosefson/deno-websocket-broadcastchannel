#!/usr/bin/env -S deno run --allow-read=.
import {
  dirname,
  relative,
  resolve,
} from "https://deno.land/std@0.201.0/path/mod.ts";

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
  const forDenoLintComments = processLineForDenoLintComments();
  return (await Promise.all(lines.map(
    async function (line: string) {
      const lines1: string[] = await forInclude(line);
      const lines2: string[] = lines1.flatMap(forImport);
      const lines3: string[] = lines2.flatMap(forDenoLintComments);
      return lines3.join("\n");
    },
  ))).join("\n");
}

/**
 * Replaces any line with `@@include(...)`, with the contents of the file.
 * @param inputFilePath
 * @param publishUrl
 */
function processLineForInclude(
  inputFilePath: string,
  publishUrl: string,
): (line: string) => Promise<string[]> {
  return async (line: string): Promise<string[]> => {
    const match = line.match(/@@include\((.*)\)/);
    if (match) {
      const matchedPath = match[1];
      const includeFilePath = resolve(dirname(inputFilePath), matchedPath);
      const resolvedIncludeFilePath = await Deno.realPath(includeFilePath);
      return (await processText(
        await Deno.readTextFile(resolvedIncludeFilePath),
        resolvedIncludeFilePath,
        publishUrl,
      )).split("\n");
    }
    return [line];
  };
}

/**
 * Updates import statements to point to the published version of the file.
 * @param inputFilePath
 * @param publishUrl
 */
function processLineForImport(
  inputFilePath: string,
  publishUrl: string,
): (line: string) => string[] {
  return (line: string): string[] => {
    const importRegex = /((\sfrom|\bimport)\s+)"(\..*)"/;
    const match: string[] | null = line.match(importRegex);
    if (match) {
      const importFrom = match[1];
      const importPath = match[3];
      const step1: string =
        (new URL(importPath, `file://${inputFilePath}`)).pathname;
      const gitRoot: string = (new URL("../", import.meta.url)).pathname;
      const step2: string = relative(gitRoot, step1);
      return [line.replace(
        importRegex,
        `${importFrom}"${publishUrl}/${step2}"`,
      )];
    }
    return [line];
  };
}

/**
 * Removes any deno-lint comments, and the whole line if that's all there is on a line.
 */
function processLineForDenoLintComments(): (line: string) => string[] {
  return (line: string): string[] => {
    if (line.trim().startsWith("// deno-lint")) {
      return [];
    }
    return [line];
  };
}

/**
 * Run the program.
 */
if (import.meta.main) {
  await main();
}
