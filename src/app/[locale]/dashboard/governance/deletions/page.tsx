import { ContractGapPage } from "@/features/product/contract-gap-page";
export default function Page() {
  return <ContractGapPage titleKey="governance.deletions.title" subtitleKey="governance.deletions.subtitle" existingOperations={["POST /api/v1/account/deletion/request/", "POST /api/v1/account/deletion/cancel/", "GET /api/v1/account/deletion/status/"]} missingOperations={["GET /api/v1/dashboard/account-deletions/ with status/date filters", "GET /api/v1/dashboard/account-deletions/{id}/ timeline", "POST /api/v1/dashboard/account-deletions/{id}/approve/", "POST /api/v1/dashboard/account-deletions/{id}/cancel/", "POST /api/v1/dashboard/account-deletions/{id}/execute/ with retention controls"]} />;
}
