import React from "react";

interface DashboardStatsProps {
  total: number;
  valid: number;
  invalid: number;
  pending: number;
}

const DashboardStats: React.FC<DashboardStatsProps> = ({ total, valid, invalid, pending }) => (
  <div>
    <div>Total documents: {total}</div>
    <div>Valid: {valid}</div>
    <div>Invalid: {invalid}</div>
    <div>Pending review: {pending}</div>
  </div>
);

export default DashboardStats;
