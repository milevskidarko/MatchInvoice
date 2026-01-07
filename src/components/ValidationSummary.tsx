import React from "react";

export interface ValidationSummaryProps {
  status: "VALID" | "VALID_WITH_WARNINGS" | "INVALID";
  reason?: string;
}

const ValidationSummary: React.FC<ValidationSummaryProps> = ({ status, reason }) => (
  <div>
    <strong>Status:</strong> {status}
    {reason && <div><strong>Reason:</strong> {reason}</div>}
  </div>
);

export default ValidationSummary;
