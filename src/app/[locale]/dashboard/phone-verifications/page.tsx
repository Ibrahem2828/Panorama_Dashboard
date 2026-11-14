import { CapabilityGate } from "@/components/feedback/capability-gate";
import { PhoneVerificationPage } from "@/features/phone-verifications/phone-verification-page";
import { CAPABILITIES } from "@/lib/auth/capabilities";

export default function Page() {
  return <CapabilityGate capability={CAPABILITIES.verification}><PhoneVerificationPage /></CapabilityGate>;
}
