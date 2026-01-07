import React, { useState } from "react";

interface ValidationResultProps {
  summary: React.ReactNode;
  details: React.ReactNode;
}

const ValidationResult: React.FC<ValidationResultProps> = ({ summary, details }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <div onClick={() => setExpanded((e) => !e)} style={{ cursor: 'pointer' }}>
        {summary}
        <button>{expanded ? 'Collapse' : 'Expand'}</button>
      </div>
      {expanded && <div>{details}</div>}
    </div>
  );
};

export default ValidationResult;
