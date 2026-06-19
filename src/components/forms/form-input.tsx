"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FormInputProps<TFieldValues extends FieldValues> extends Omit<InputProps, "name"> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export function FormInput<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  leftIcon,
  rightElement,
  className,
  ...props
}: FormInputProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className="relative">
              {leftIcon ? <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{leftIcon}</span> : null}
              <Input className={cn(leftIcon && "pl-9", rightElement && "pr-10", className)} {...props} {...field} />
              {rightElement ? <span className="absolute right-1 top-1/2 -translate-y-1/2">{rightElement}</span> : null}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
