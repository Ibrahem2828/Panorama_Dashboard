"use client";

import { Button, type ButtonProps } from "@/components/ui/button";

interface FormSubmitButtonProps extends ButtonProps {
  loading?: boolean;
}

export function FormSubmitButton({ loading, children, ...props }: FormSubmitButtonProps) {
  return (
    <Button type="submit" isLoading={loading} {...props}>
      {children}
    </Button>
  );
}
