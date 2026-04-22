import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import * as crypto from "crypto";
import * as https from "https";
import { IncomingMessage } from "http";

const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION ?? "us-west-2",
});

function base64url(data: Buffer | string): string {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return buf.toString("base64url");
}

function makeJwt(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iat: now - 60,
      exp: now + 540,
      iss: Number(appId),
    }),
  );
  const signingInput = `${header}.${payload}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signingInput);
  return `${signingInput}.${base64url(sign.sign(privateKey))}`;
}

function request(
  options: https.RequestOptions & { method: string },
  body?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res: IncomingMessage) => {
      let data = "";
      res.on("data", (chunk: Buffer) => (data += chunk.toString()));
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
          reject(
            new Error(
              `Unexpected redirect HTTP ${res.statusCode} to ${res.headers.location ?? "(unknown)"}`,
            ),
          );
        } else if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve(data);
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function githubHeaders(jwt: string): Record<string, string> {
  return {
    Authorization: `Bearer ${jwt}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "noxx-hal",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export const handler = async (): Promise<{ token: string }> => {
  const result = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: "/openclaw/github-app" }),
  );
  const { app_id, private_key } = JSON.parse(result.SecretString!);
  const jwt = makeJwt(String(app_id), private_key as string);
  const headers = githubHeaders(jwt);

  const installationRaw = await request({
    hostname: "api.github.com",
    path: "/orgs/knot-inc/installation",
    method: "GET",
    headers,
  });

  const installation = JSON.parse(installationRaw) as { id: number };

  const tokenRaw = await request(
    {
      hostname: "api.github.com",
      path: `/app/installations/${installation.id}/access_tokens`,
      method: "POST",
      headers: { ...headers, "Content-Length": "0" },
    },
    "",
  );

  const { token } = JSON.parse(tokenRaw) as { token: string };
  return { token };
};
