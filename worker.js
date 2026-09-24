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

    // Iniciar conexão com Mercado Livre
    if (url.pathname === "/api/ml/connect") {
      const state = crypto.randomUUID();

      await env.ML_TOKENS.put(
        `oauth_state:${state}`,
        "valid",
        { expirationTtl: 600 }
      );

      const redirectUri =
        "https://ofertas-afiliados.llulucass.workers.dev/oauth/callback";

      const authUrl = new URL(
        "https://auth.mercadolivre.com.br/authorization"
      );

      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("client_id", env.ML_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("state", state);

      return Response.redirect(authUrl.toString(), 302);
    }

    // Retorno do Mercado Livre após autorização
    if (url.pathname === "/oauth/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        return new Response(
          `Erro na autorização do Mercado Livre: ${error}`,
          { status: 400 }
        );
      }

      if (!code || !state) {
        return new Response(
          "Código ou estado não recebido.",
          { status: 400 }
        );
      }

      const stateKey = `oauth_state:${state}`;
      const validState = await env.ML_TOKENS.get(stateKey);

      if (!validState) {
        return new Response(
          "Solicitação OAuth inválida ou expirada.",
          { status: 400 }
        );
      }

      await env.ML_TOKENS.delete(stateKey);

      const redirectUri =
        "https://ofertas-afiliados.llulucass.workers.dev/oauth/callback";

      const body = new URLSearchParams();

      body.set("grant_type", "authorization_code");
      body.set("client_id", env.ML_CLIENT_ID);
      body.set("client_secret", env.ML_CLIENT_SECRET);
      body.set("code", code);
      body.set("redirect_uri", redirectUri);

      const tokenResponse = await fetch(
        "https://api.mercadolibre.com/oauth/token",
        {
          method: "POST",
          headers: {
            "accept": "application/json",
            "content-type": "application/x-www-form-urlencoded"
          },
          body
        }
      );

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Não foi possível obter o token.",
            details: tokenData
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
      }

      const expiresAt =
        Date.now() + ((tokenData.expires_in || 21600) * 1000);

      await env.ML_TOKENS.put(
        "ml_tokens",
        JSON.stringify({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          user_id: tokenData.user_id,
          expires_at: expiresAt
        })
      );

      return new Response(
        `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <title>LCS_achados</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 60px 20px;
              background: #111;
              color: white;
            }
            .box {
              max-width: 500px;
              margin: auto;
              padding: 30px;
              border-radius: 15px;
              background: #1d1d1d;
            }
            h1 {
              color: #ffd400;
            }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>✅ Mercado Livre conectado!</h1>
            <p>Sua conta foi autorizada com sucesso.</p>
            <p>O LCS_achados já possui os tokens necessários para acessar a API.</p>
          </div>
        </body>
        </html>
        `,
        {
          headers: {
            "Content-Type": "text/html; charset=UTF-8"
          }
        }
      );
    }

    // Mantém o site normal funcionando
    return env.ASSETS.fetch(request);
  }
};
