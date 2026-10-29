import type { PreviewGroup, WhatsappGroup } from "@/features/academic-term/api";

/** The word the admin types (Arabic UI) to confirm ending the term, besides the student count. */
export const CONFIRM_WORD = "إنهاء";

/** The accepted confirmations: the word, or the number of students (Western or Arabic-Indic digits). */
export function confirmationMatches(input: string, totalStudents: number): boolean {
  const typed = input.trim().replace(/[٠-٩]/gu, (digit) => String(digit.charCodeAt(0) - 0x0660));
  if (!typed) return false;
  return typed === CONFIRM_WORD || typed.toLowerCase() === "end" || typed === String(totalStudents);
}

/** Groups that need manual work in WhatsApp: an active invite link and someone to remove. */
export function groupsNeedingWhatsappWork(groups: readonly PreviewGroup[]): PreviewGroup[] {
  return groups.filter((group) => group.whatsapp_active && group.members_to_remove > 0);
}

export function previewTotals(groups: readonly PreviewGroup[]) {
  return {
    groups: groups.length,
    whatsappGroups: groups.filter((group) => group.whatsapp_active).length,
    members: groups.reduce((sum, group) => sum + group.members_to_remove, 0),
  };
}

/** One member per line: easy to paste into a notes app and to tick off while removing people from WhatsApp. */
export function whatsappCopyText(group: WhatsappGroup): string {
  return [group.name, ...group.members.map((member) => `${member.full_name}\t${member.phone_number}`)].join("\n");
}

/** A label is required and kept to a sane length (the backend stores it on the term and the rollover). */
export function termLabelProblem(label: string): "required" | "tooLong" | null {
  const value = label.trim();
  if (!value) return "required";
  return value.length > 120 ? "tooLong" : null;
}
