// No-op service worker. Prevents 404 noise from browsers/extensions probing /sw.js.
// Returns an empty worker that unregisters itself, so nothing is cached.
export function GET() {
  const body = `self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    self.registration.unregister().then(() => self.clients.claim()),
  );
});
`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
