export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Teste do Worker
    if (url.pathname === "/api/test") {
      return new Response(
        JSON.stringify({
          ok: true,
          message: "Worker LCS_achados funcionando!"
        }),
        {
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    // Mantém o site index.html funcionando
    return env.ASSETS.fetch(request);
  }
};
