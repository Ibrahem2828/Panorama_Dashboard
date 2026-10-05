export type FieldInput = "text" | "textarea" | "number" | "switch" | "select" | "file" | "date" | "datetime-local" | "json";

export interface ContractField {
  name: string;
  type: string;
  input: FieldInput;
  format: string | null;
  required: boolean;
  nullable: boolean;
  readOnly: boolean;
  writeOnly: boolean;
  minLength: number | null;
  maxLength: number | null;
  minimum: number | null;
  maximum: number | null;
  pattern: string | null;
  enum: readonly (string | number | boolean | null)[] | null;
  defaultValue: unknown;
  description: string | null;
}

export interface ResourceDefinition {
  key: string;
  collectionPath: string;
  detailPath: string | null;
  collectionMethods: readonly string[];
  detailMethods: readonly string[];
  operationIds: {
    list: string | null;
    create: string | null;
    retrieve: string | null;
    update: string | null;
    partialUpdate: string | null;
    destroy: string | null;
  };
  fields: readonly ContractField[];
}
