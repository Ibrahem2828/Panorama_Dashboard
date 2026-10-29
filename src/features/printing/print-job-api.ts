import { JOB_PATHS } from "@/features/printing/print-queue-rules";
import { downloadFromBackend } from "@/lib/api/browser-client";

/**
 * Fetches a job's print-ready PDF and shows it in a new tab, where the browser's print dialog (Ctrl+P) takes over.
 * Returns false when the file could not be prepared. The blank tab is opened first so the pop-up blocker allows it.
 */
export async function openJobPdf(jobId: number): Promise<boolean> {
  const tab = window.open("", "_blank");
  try {
    const response = await downloadFromBackend(JOB_PATHS.file(jobId));
    const url = URL.createObjectURL(new Blob([await response.arrayBuffer()], { type: "application/pdf" }));
    if (tab) tab.location.href = url; else window.open(url, "_blank");
    window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    return true;
  } catch {
    tab?.close();
    return false;
  }
}
