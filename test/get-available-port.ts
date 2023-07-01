/**
 * Returns a TCP port number, that at the time of running this function, is
 * available to listen on.
 */
export function getAvailablePort(): number {
  let listener: Deno.Listener | undefined;
  try {
    listener = Deno.listen({
      hostname: "localhost",
      port: 0,
      transport: "tcp",
    });
    const addr: Deno.NetAddr = listener.addr as Deno.NetAddr;
    return addr.port;
  } finally {
    listener?.close();
  }
}
