export function createGoogleProviderOptions() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    authorization: { params: { prompt: "select_account" } },
    allowDangerousEmailAccountLinking: true,
  };
}
