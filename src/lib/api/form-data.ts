type FormDataValue = string | number | boolean | File | null | undefined;

export function toFormData(values: Record<string, FormDataValue>) {
  const formData = new FormData();

  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    formData.append(key, value instanceof File ? value : String(value));
  });

  return formData;
}
