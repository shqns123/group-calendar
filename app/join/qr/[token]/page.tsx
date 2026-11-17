import { peekQr } from "@/lib/qrInvite";
import JoinOnboardingClient from "./JoinOnboardingClient";

type Props = {
  params: Promise<{ token: string }>;
};

/** Opened by scanning a group QR code with a phone camera. Rendering doesn't use the code up. */
export default async function JoinQrPage({ params }: Props) {
  const { token } = await params;
  const qr = await peekQr(token);
  return <JoinOnboardingClient token={token} groupName={qr?.group.name ?? null} />;
}
