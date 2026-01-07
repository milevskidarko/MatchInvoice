// Validation summary logic
export type ValidationStatus = "VALID" | "VALID_WITH_WARNINGS" | "INVALID";

export interface ValidationSummaryTLDR {
  status: ValidationStatus;
  reason?: string;
}

// TODO: Implement validation summary logic
