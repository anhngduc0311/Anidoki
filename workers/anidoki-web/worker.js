const siteHost = 'anidoki.com';
const workerHost = 'anidoki-web.akzan0311.workers.dev';

export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    if (incoming.hostname !== siteHost && incoming.hostname !== workerHost) {
      return new Response('Not found', { status: 404 });
    }

    const fromWorkerDomain = incoming.hostname === workerHost;
    let originRequest = request;
    if (fromWorkerDomain) {
      const upstream = new URL(incoming);
      upstream.hostname = siteHost;
      upstream.protocol = 'https:';
      upstream.port = '';
      originRequest = new Request(upstream, request);
      originRequest.headers.delete('Host');
    }

    const response = await fetch(originRequest, { redirect: 'manual' });
    if (response.status === 101) return response;

    const result = new Response(response.body, response);
    result.headers.set('X-Anidoki-Worker', 'web');
    const location = result.headers.get('Location');
    if (fromWorkerDomain && location) {
      const next = new URL(location, originRequest.url);
      if (next.hostname === siteHost) {
        next.hostname = workerHost;
        result.headers.set('Location', next.href);
      }
    }
    return result;
  },
};
