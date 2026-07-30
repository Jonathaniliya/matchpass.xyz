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

  // Circle uses this to bind user-controlled wallet challenges to the device.
  // Initialize it before authenticating and opening the PIN challenge.
  await sdk.getDeviceId();
  sdk.setAuthentication({
    userToken: credentials.userToken,
    encryptionKey: credentials.encryptionKey,
  });

  return new Promise((resolve, reject) => {
    sdk.execute(credentials.challengeId, (error, result) => {
      if (error) {
        reject(new Error(error.message || "PIN challenge failed"));
        return;
      }
      if (result?.status !== "COMPLETE") {
        reject(new Error(`Challenge ended: ${result?.status ?? "unknown"}`));
        return;
      }
      resolve({ type: result.type, status: "COMPLETE" });
    });
  });
}
