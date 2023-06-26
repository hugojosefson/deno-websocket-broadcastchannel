#!/usr/bin/env -S deno run --allow-net --allow-env=PORT --watch
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createBroadcastChannel } from "../mod.ts";

const messages: string[] = [];
// Create a new broadcast channel named earth.
const channel = await createBroadcastChannel("earth");
// Set onmessage event handler.
channel.onmessage = (event: MessageEvent) => {
  // Update the local state when other instances
  // send us a new message.
  messages.push(event.data);
};

function handler(req: Request): Response {
  const { pathname, searchParams } = new URL(req.url);

  // Handle /send?message=<message> endpoint.
  if (pathname.startsWith("/send")) {
    const message = searchParams.get("message");
    if (!message) {
      return new Response("?message not provided", { status: 400 });
    }

    // Update local state.
    messages.push(message);
    // Inform all other active instances of the deployment
    // about the new message.
    channel.postMessage(message);
    return new Response("message sent");
  }

  // Handle /messages request.
  if (pathname.startsWith("/messages")) {
    return new Response(
      JSON.stringify(messages),
      {
        headers: { "content-type": "application/json" },
      },
    );
  }

  return new Response("not found", { status: 404 });
}

serve(handler, { port: parseInt(Deno.env.get("PORT") ?? "8080", 10) });
