import { ContractGapPage } from "@/features/product/contract-gap-page";
export default function Page() {
  return <ContractGapPage titleKey="product.devices.title" subtitleKey="product.devices.subtitle" existingOperations={["POST /api/v1/mobile/devices/register/", "PATCH /api/v1/mobile/devices/{installation_id}/", "POST /api/v1/mobile/devices/{installation_id}/revoke/"]} missingOperations={["GET /api/v1/dashboard/devices/ with server pagination and filters", "GET /api/v1/dashboard/devices/{id}/", "POST /api/v1/dashboard/devices/{id}/revoke/ with audit reason", "GET /api/v1/dashboard/devices/stats/ by platform and build"]} />;
}
