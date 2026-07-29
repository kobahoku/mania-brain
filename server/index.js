export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;
    return env.ASSETS.fetch(new Request(new URL('/', request.url), request));
  }
};
