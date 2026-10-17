import { RouteLoader } from "@/components/feedback/route-loader";
import { DEFAULT_LOCALE } from "@/config/constants";
import { getServerTranslator } from "@/i18n/server";

export default function Loading() {
  return <RouteLoader label={getServerTranslator(DEFAULT_LOCALE)("app.loading")} />;
}
