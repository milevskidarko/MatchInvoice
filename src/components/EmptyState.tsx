import React from "react";

interface EmptyStateProps {
  message: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ message }) => (
  <div style={{ color: '#888', textAlign: 'center', padding: '2em' }}>{message}</div>
);

export default EmptyState;
