import React from "react";

interface ValidationDiffRowProps {
  label: string;
  orderValue: string | number;
  invoiceValue: string | number;
  isMismatch: boolean;
}

const ValidationDiffRow: React.FC<ValidationDiffRowProps> = ({ label, orderValue, invoiceValue, isMismatch }) => (
  <div>
    <span>{label}:</span>
    <span style={{ color: isMismatch ? 'red' : 'inherit' }}>Order: {orderValue}</span>
    <span style={{ color: isMismatch ? 'red' : 'inherit' }}>Invoice: {invoiceValue}</span>
  </div>
);

export default ValidationDiffRow;
