import React from "react";

interface RecentDocument {
  name: string;
  type: string;
  status: string;
  date: string;
}

interface RecentDocumentsProps {
  documents: RecentDocument[];
}

const RecentDocuments: React.FC<RecentDocumentsProps> = ({ documents }) => (
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Type</th>
        <th>Status</th>
        <th>Date</th>
      </tr>
    </thead>
    <tbody>
      {documents.map((doc, i) => (
        <tr key={i}>
          <td>{doc.name}</td>
          <td>{doc.type}</td>
          <td>{doc.status}</td>
          <td>{doc.date}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

export default RecentDocuments;
