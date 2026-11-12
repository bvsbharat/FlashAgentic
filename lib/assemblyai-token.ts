import { AssemblyAI } from "assemblyai";

/** Redemption window for one streaming token. A new token is minted per socket. */
export const TOKEN_EXPIRES_SECONDS = 60;
/** Session cap. The browser opens a new socket, with a new token, before this. */
export const MAX_SESSION_SECONDS = 480;

export type StreamingToken = {
  token: string;
  expires_in_seconds: number;
  max_session_duration_seconds: number;
};

export type TokenBody =
  | { assemblyai: false }
  | { assemblyai: boolean }
  | StreamingToken;

/**
 * Mint a temporary streaming token with the installed SDK.
 * `client.streaming.createTemporaryToken` calls
 * `GET https://streaming.assemblyai.com/v3/token` and sends the API key
 * only as the Authorization header. The returned value is the token string.
 */
export async function mintStreamingToken(apiKey: string): Promise<StreamingToken> {
  const client = new AssemblyAI({ apiKey });
  const token = await client.streaming.createTemporaryToken({
    expires_in_seconds: TOKEN_EXPIRES_SECONDS,
    max_session_duration_seconds: MAX_SESSION_SECONDS,
  });
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("AssemblyAI did not return a streaming token");
  }
  return {
    token,
    expires_in_seconds: TOKEN_EXPIRES_SECONDS,
    max_session_duration_seconds: MAX_SESSION_SECONDS,
  };
}

/**
 * Body of `GET /api/assemblyai-token`.
 * `probe` reports whether a key is configured and does not mint a token.
 * Failures are a generic `{ assemblyai: false }` so an error from the SDK
 * (which can echo the request) never reaches the browser.
 */
export async function assemblyaiTokenResponse(input: {
  apiKey: string | undefined;
  probe: boolean;
  mint?: (apiKey: string) => Promise<StreamingToken>;
}): Promise<{ status: number; body: TokenBody }> {
  const apiKey = input.apiKey?.trim() ?? "";
  if (input.probe) {
    return { status: 200, body: { assemblyai: Boolean(apiKey) } };
  }
  if (!apiKey) {
    return { status: 503, body: { assemblyai: false } };
  }
  try {
    const minted = await (input.mint ?? mintStreamingToken)(apiKey);
    return { status: 200, body: minted };
  } catch {
    return { status: 503, body: { assemblyai: false } };
  }
}
