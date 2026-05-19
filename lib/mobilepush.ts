import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

type MobilePayload = {
  title: string;
  body: string;
  url?: string;
};

function getServiceAccount() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (rawJson) return JSON.parse(rawJson);

  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
  if (base64) {
    return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  }

  return null;
}

function ensureFirebaseApp() {
  if (getApps().length > 0) return getApps()[0];

  const serviceAccount = getServiceAccount();
  if (serviceAccount) {
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id ?? process.env.FIREBASE_PROJECT_ID,
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_PROJECT_ID) {
    return initializeApp({
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }

  return null;
}

export async function sendMobilePushToTokens(
  tokens: string[],
  payload: MobilePayload,
) {
  const app = ensureFirebaseApp();
  if (!app || tokens.length == 0) return { sent: 0, failed: 0 };

  const uniqueTokens = [...new Set(tokens.filter(Boolean))];
  if (uniqueTokens.length == 0) return { sent: 0, failed: 0 };

  const response = await getMessaging(app).sendEachForMulticast({
    tokens: uniqueTokens,
    data: {
      title: payload.title,
      body: payload.body,
      link: payload.url ?? "",
    },
    android: {
      priority: "high",
    },
  });

  return {
    sent: response.successCount,
    failed: response.failureCount,
  };
}
