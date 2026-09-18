// Tesla Fleet API code exchange 프록시.
//
// 안드로이드 앱은 client_secret 없이 이 함수에 "code" 만 보낸다.
// 이 함수만 client_secret 을 알고 있고(Vercel 환경변수), 대신
// Tesla /oauth2/v3/token 을 호출해 access_token/refresh_token 을 받아
// 그대로 앱에 돌려준다. client_secret 은 절대 응답에 포함하지 않는다.
//
// 필요 환경변수 (Vercel 프로젝트 설정 → Environment Variables):
//   TESLA_CLIENT_ID     : Tesla Developer 포털에서 발급받은 Client ID
//   TESLA_CLIENT_SECRET : 같은 포털에서 발급받은 Client Secret
//   TESLA_AUDIENCE      : https://fleet-api.prd.na.vn.cloud.tesla.com (지역별 base URL)

module.exports = async function handler(req, res) {
  // 앱(Android)에서만 호출하지만, 브라우저 프리플라이트 대비로 기본 CORS 허용.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST 요청만 허용됩니다." });
    return;
  }

  const { code, redirect_uri } = req.body || {};
  if (!code || !redirect_uri) {
    res.status(400).json({ error: "code 와 redirect_uri 가 필요합니다." });
    return;
  }

  const clientId = process.env.TESLA_CLIENT_ID;
  const clientSecret = process.env.TESLA_CLIENT_SECRET;
  const audience = process.env.TESLA_AUDIENCE;

  if (!clientId || !clientSecret || !audience) {
    res.status(500).json({ error: "서버에 Tesla 환경변수가 설정되지 않았습니다." });
    return;
  }

  try {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      audience,
      redirect_uri,
    });

    const teslaRes = await fetch(
      "https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      }
    );

    const text = await teslaRes.text();
    if (!teslaRes.ok) {
      res.status(teslaRes.status).json({ error: `Tesla 토큰 발급 실패: ${text}` });
      return;
    }

    const json = JSON.parse(text);
    // access_token / refresh_token / expires_in 만 앱에 전달한다.
    res.status(200).json({
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expires_in: json.expires_in,
    });
  } catch (e) {
    res.status(500).json({ error: `프록시 처리 중 오류: ${e.message}` });
  }
}
