import React from "react";

interface ProcessingIndicatorProps {
  message?: string;
}

const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({ message }) => (
  <div style={{ color: '#007bff', textAlign: 'center', padding: '1em' }}>
    <span className="spinner" style={{ marginRight: 8 }}>🔄</span>
    {message || 'Processing...'}
  </div>
);

export default ProcessingIndicator;
