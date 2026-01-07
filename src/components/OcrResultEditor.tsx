import React, { useState } from "react";
import { ExtractedInvoiceData, OcrField } from "../lib/ocr/index";

interface EditableFieldProps {
  label: string;
  field: OcrField;
  onChange: (value: string) => void;
}

const EditableField: React.FC<EditableFieldProps> = ({ label, field, onChange }) => {
  const [editedValue, setEditedValue] = useState(field.value);
  const [isEdited, setIsEdited] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedValue(e.target.value);
    setIsEdited(true);
    onChange(e.target.value);
  };

  return (
    <div>
      <label>{label}</label>
      <input value={editedValue} onChange={handleChange} />
      <span>Confidence: {field.confidence}</span>
      {isEdited && <span> (edited)</span>}
    </div>
  );
};

// TODO: Render all fields and allow editing
export default EditableField;
