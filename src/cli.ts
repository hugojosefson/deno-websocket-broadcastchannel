#!/bin/sh
// 2>/dev/null;export DEBUG='*';DENO_VERSION_RANGE="^1.34.2";DENO_RUN_ARGS="--allow-net --allow-env=DEBUG";set -e;V="$DENO_VERSION_RANGE";A="$DENO_RUN_ARGS";h(){ [ -x "$(command -v $1 2>&1)" ];};g(){ u="$([ $(id -u) != 0 ]&&echo sudo||:)";if h brew;then echo "brew install $1";elif h apt;then echo "($u apt update && $u DEBIAN_FRONTEND=noninteractive apt install -y $1)";elif h yum;then echo "$u yum install -y $1";elif h pacman;then echo "$u pacman -yS --noconfirm $1";elif h opkg-install;then echo "$u opkg-install $1";fi;};p(){ q="$(g $1)";if [ -z "$q" ];then echo "Please install '$1' manually, then try again.">&2;exit 1;fi;eval "o=\"\$(set +o)\";set -x;$q;set +x;eval \"\$o\"">&2;};f(){ h "$1"||p "$1";};U="$(printf "%s" "$V"|xxd -p|tr -d '\n'|sed 's/\(..\)/%\1/g')";D="$(command -v deno||true)";t(){ d="$(mktemp)";rm "${d}";dirname "${d}";};a(){ [ -n $D ];};s(){ a&&[ -x "$R/deno" ]&&[ "$R/deno" = "$D" ]&&return;deno eval "import{satisfies as e}from'https://deno.land/x/semver@v1.4.1/mod.ts';Deno.exit(e(Deno.version.deno,'$V')?0:1);">/dev/null 2>&1;};e(){ R="$(t)/deno-range-$V/bin";mkdir -p "$R";export PATH="$R:$PATH";[ -x "$R/deno" ]&&return;a&&s&&([ -L "$R/deno" ]||ln -s "$D" "$R/deno")&&return;f curl;v="$(curl -sSfL "https://semver-version.deno.dev/api/github/denoland/deno/$U")";i="$(t)/deno-$v";[ -L "$R/deno" ]||ln -s "$i/bin/deno" "$R/deno";s && return;f unzip;([ "${A#*-q}" != "$A" ]&&exec 2>/dev/null;curl -fsSL https://deno.land/install.sh|DENO_INSTALL="$i" sh -s $DENO_INSTALL_ARGS "$v">&2);};e;exec "$R/deno" run $A "$0" "$@"

import { Logger, logger } from "./log.ts";
import { DEFAULT_LISTEN_OPTIONS, ListenOptions } from "./types.ts";
import { beServer } from "./server.ts";
import { beClient } from "./client.ts";
import { alternatingLoop } from "./alternating-loop.ts";

const log0: Logger = logger(import.meta.url);

async function main(options: ListenOptions = DEFAULT_LISTEN_OPTIONS) {
  const listenOptions: ListenOptions = {
    ...DEFAULT_LISTEN_OPTIONS,
    ...options,
  };
  const log: Logger = log0.sub(main.name);

  const messageGenerator: EventTarget = new EventTarget();
  const abortController = new AbortController();

  log("starting alternating loop");
  const resultPromise = alternatingLoop(
    listenOptions,
    [beServer, beClient],
    log.sub("alternatingLoop").sub("onmessage"),
    messageGenerator,
    abortController.signal,
  );

  log("continuously reading from stdin");
  const decoder = new TextDecoder();
  for await (const chunk of Deno.stdin.readable) {
    const text = decoder.decode(chunk);
    log("stdin text =", text);
    messageGenerator.dispatchEvent(new MessageEvent("message", { data: text }));
  }

  log("stdin closed, aborting");
  abortController.abort();

  log("waiting for alternating loop to end");
  const result = await resultPromise;
  log("alternating loop ended: ", result);
}

if (import.meta.main) {
  await main();
}
