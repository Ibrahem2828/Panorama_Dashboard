"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { KEYS } from "@/features/store/catalog-api";
import { Field, useServerFieldErrors, useStoreErrorText } from "@/features/store/store-ui";
import { STOCK_MOVEMENTS, STOCK_NOTE_MAX, movementLabelKey, stockAfter, stockBody, stockProblem, storePath, type StockMovement } from "@/features/store/store-rules";
import { useIdempotencyKey } from "@/hooks/use-idempotency-key";
import { useI18n } from "@/i18n/provider";
import { apiFetch } from "@/lib/api/browser-client";
import { payloadSignature } from "@/lib/api/idempotency";

/** Book a stock movement (purchase, signed adjustment or waste) on one variant; shows the shelf before and after. */
export function StockDialog({ variant, onClose }: { variant: { id: number; label: string; productName: string; stock: number }; onClose: () => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const errorText = useStoreErrorText();
  const serverFields = useServerFieldErrors();
  const key = useIdempotencyKey();
  const [type, setType] = useState<StockMovement>("purchase");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [show, setShow] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  const problem = stockProblem(type, quantity);
  const after = stockAfter(variant.stock, type, quantity);
  const negative = after !== null && after < 0;

  const save = useMutation({
    mutationFn: async () => {
      const body = stockBody(type, quantity, note);
      await apiFetch(storePath("variants", variant.id, "stock"), { method: "POST", body, idempotencyKey: key.get(payloadSignature("store-stock", variant.id, body)) });
    },
    onSuccess() {
      key.reset();
      toast.success(t("store.stock.saved"));
      for (const name of [KEYS.variants, "store-summary", "finance-stock", "quick-access"]) void queryClient.invalidateQueries({ queryKey: [name] });
      onClose();
    },
    onError(error) { key.reset(); setServerErrors(serverFields(error, ["quantity", "movement_type", "note"])); toast.error(errorText(error)); },
  });

  const submit = () => { setShow(true); if (problem === null && !negative) save.mutate(); };
  const quantityError = show && problem ? t(`store.stock.problem.${problem}` as "store.stock.problem.invalid") : show && negative ? t("store.stock.problem.negativeResult") : serverErrors.quantity ?? null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="pe-10">
          <DialogTitle>{t("store.stock.title")}</DialogTitle>
          <DialogDescription><span dir="auto">{variant.productName}{variant.label ? ` — ${variant.label}` : ""}</span></DialogDescription>
        </DialogHeader>
        <form className="space-y-4" noValidate onSubmit={(event) => { event.preventDefault(); submit(); }}>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">{t("store.stock.current")}</p><p className="mt-1 text-2xl font-black tabular-nums"><bdi>{variant.stock}</bdi></p></div>
            <div className={`rounded-xl border p-3 ${negative ? "border-destructive/40 bg-destructive/5" : "bg-muted/30"}`}><p className="text-xs text-muted-foreground">{t("store.stock.after")}</p><p className="mt-1 text-2xl font-black tabular-nums"><bdi>{after ?? "—"}</bdi></p></div>
          </div>
          <Field label={t("store.stock.type")} htmlFor="stock-type" hint={t(`store.stock.typeHint.${type}` as "store.stock.typeHint.purchase")}>
            <Select value={type} onValueChange={(value) => setType(value as StockMovement)}>
              <SelectTrigger id="stock-type" className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{STOCK_MOVEMENTS.map((value) => <SelectItem key={value} value={value}>{t(movementLabelKey(value))}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label={t("store.stock.quantity")} htmlFor="stock-quantity" error={quantityError}>
            <Input id="stock-quantity" dir="ltr" inputMode="numeric" className="h-11 text-center text-lg font-bold tabular-nums" value={quantity} placeholder={type === "adjustment" ? "+5 / -3" : "10"} onChange={(event) => setQuantity(event.target.value.replace(/[^\d-]/gu, "").replace(/(?!^)-/gu, ""))} aria-invalid={Boolean(quantityError)} />
          </Field>
          <Field label={t("store.stock.note")} htmlFor="stock-note" optional={t("counter.optional")}>
            <Textarea id="stock-note" value={note} maxLength={STOCK_NOTE_MAX} dir="auto" rows={2} onChange={(event) => setNote(event.target.value)} />
          </Field>
          <DialogFooter className="gap-2"><Button type="button" variant="ghost" onClick={onClose}>{t("common.cancel")}</Button><Button type="submit" disabled={save.isPending}>{t("store.stock.record")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
