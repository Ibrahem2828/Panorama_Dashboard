"use client";

import { FileUp, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface FormFileUploadProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  accept?: string;
  disabled?: boolean;
}

export function FormFileUpload<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  accept,
  disabled,
}: FormFileUploadProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field: { onChange, value, ...field } }) => {
        const rawValue = value as unknown;
        const file = typeof File !== "undefined" && rawValue instanceof File ? rawValue : null;

        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              <div className="rounded-md border border-dashed p-4">
                <div className="flex items-center gap-3">
                  <FileUp className="size-5 text-muted-foreground" aria-hidden="true" />
                  <Input
                    {...field}
                    value=""
                    type="file"
                    accept={accept}
                    disabled={disabled}
                    onChange={(event) => onChange(event.target.files?.[0] ?? null)}
                  />
                </div>
                {file ? (
                  <div className="mt-3 flex items-center justify-between rounded-md bg-muted p-2 text-sm">
                    <span className="truncate">{file.name}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onChange(null)}>
                      <X />
                      <span className="sr-only">Clear selected file</span>
                    </Button>
                  </div>
                ) : null}
                <FilePreview file={file} />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

function FilePreview({ file }: { file: File | null }) {
  const previewUrl = useMemo(() => {
    if (!file || !file.type.startsWith("image/")) {
      return null;
    }

    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!previewUrl) {
    return null;
  }

  return (
    <Image
      src={previewUrl}
      alt=""
      width={240}
      height={160}
      className="mt-3 max-h-40 rounded-md border object-contain"
      unoptimized
    />
  );
}
