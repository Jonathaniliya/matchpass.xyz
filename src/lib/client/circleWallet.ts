type CircleChallengeCredentials = {
  userToken: string;
  encryptionKey: string;
  challengeId: string;
};

export type CircleChallengeResult = {
  type?: string;
  status: "COMPLETE";
};

const APP_ID = process.env.NEXT_PUBLIC_CIRCLE_APP_ID;

export async function executeCircleChallenge(
  credentials: CircleChallengeCredentials,
): Promise<CircleChallengeResult> {
  if (!APP_ID) {
    throw new Error("Wallet not configured: NEXT_PUBLIC_CIRCLE_APP_ID is missing.");
  }

  // Dynamic import keeps Circle's browser-only SDK out of server bundles.
  const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");
  const sdk = new W3SSdk({ appSettings: { appId: APP_ID } });

  try {
    sdk.setAuthentication({
      userToken: credentials.userToken,
      encryptionKey: credentials.encryptionKey,
    });

    return await new Promise((resolve, reject) => {
      sdk.execute(credentials.challengeId, (error, result) => {
        if (error) {
          reject(normalizeCircleBrowserError(error));
          return;
        }
        if (result?.status !== "COMPLETE") {
          reject(new Error(`Challenge ended: ${result?.status ?? "unknown"}`));
          return;
        }
        resolve({ type: result.type, status: "COMPLETE" });
      });
    });
  } catch (error) {
    throw normalizeCircleBrowserError(error);
  }
}

function normalizeCircleBrowserError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string" && error.trim()) return new Error(error);
  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      message?: unknown;
      code?: unknown;
      errorCode?: unknown;
    };
    const message =
      typeof candidate.message === "string" && candidate.message.trim()
        ? candidate.message
        : "Circle wallet challenge failed";
    const code = candidate.code ?? candidate.errorCode;
    return new Error(code === undefined ? message : `${message} (${String(code)})`);
  }
  return new Error("Circle wallet challenge failed");
}
