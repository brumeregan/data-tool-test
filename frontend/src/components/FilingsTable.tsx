import type { Filing } from '../types';

type FilingsTableProps = {
  filings: Filing[];
};

export const FilingsTable = ({ filings }: FilingsTableProps) => (
  <table className="filings-table">
    <thead>
      <tr>
        <th>Form</th>
        <th>Filing date</th>
        <th>Report date</th>
        <th>Accession number</th>
        <th>Document</th>
      </tr>
    </thead>
    <tbody>
      {filings.map((filing) => (
        <tr key={filing.accessionNumber}>
          <td>{filing.form}</td>
          <td>{filing.filingDate}</td>
          <td>{filing.reportDate ?? '—'}</td>
          <td>{filing.accessionNumber}</td>
          <td>
            <a href={filing.documentUrl} target="_blank" rel="noopener noreferrer">
              View
            </a>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);
