import type { SummaryCompany } from '../types';

// Why a matrix: the point of this endpoint is cross-company comparison over a common set of form
// types. One row per company and one column per form type makes a form a company never files
// show up as a gap ("—") in a column, instead of an absence the reader has to notice. Counts
// across a handful of companies are meant to be read, so there is deliberately no chart.

const PRIORITY_FORMS = ['10-K', '10-Q', '8-K', '20-F', '6-K'];

// Annual/quarterly/current forms lead; the noise (Form 4, 144, ...) follows alphabetically.
export const orderForms = (forms: Iterable<string>): string[] => {
  const unique = [...new Set(forms)];
  const priority = PRIORITY_FORMS.filter((form) => unique.includes(form));
  const rest = unique.filter((form) => !PRIORITY_FORMS.includes(form)).sort();
  return [...priority, ...rest];
};

type SummaryTableProps = {
  companies: SummaryCompany[];
};

const Latest10KCell = ({ company }: { company: SummaryCompany }) => {
  const { latest10K, latestAnnualReport } = company;
  if (latest10K !== null) {
    return (
      <a href={latest10K.documentUrl} target="_blank" rel="noopener noreferrer">
        {latest10K.filingDate}
      </a>
    );
  }
  // No 10-K (e.g. a foreign private issuer): say why instead of showing a blank or "null".
  if (latestAnnualReport !== null) {
    return (
      <span title={`Foreign private issuer: files ${latestAnnualReport.form} instead of a 10-K`}>
        —
        <small className="caption">
          Files {latestAnnualReport.form} instead (latest{' '}
          <a href={latestAnnualReport.documentUrl} target="_blank" rel="noopener noreferrer">
            {latestAnnualReport.filingDate}
          </a>
          )
        </small>
      </span>
    );
  }
  return (
    <span>
      —<small className="caption">No 10-K on record</small>
    </span>
  );
};

export const SummaryTable = ({ companies }: SummaryTableProps) => {
  const forms = orderForms(companies.flatMap((company) => Object.keys(company.countsByForm)));

  return (
    <div className="table-scroll">
      <table className="filings-table summary-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Latest 10-K</th>
            <th>Total (12 mo)</th>
            {forms.map((form) => (
              <th key={form}>{form}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr key={company.ticker}>
              <th scope="row">
                {company.ticker}
                <small className="caption">{company.name}</small>
              </th>
              <td>
                <Latest10KCell company={company} />
              </td>
              <td className="count">{company.totalLast12Months.toLocaleString('en-US')}</td>
              {forms.map((form) => {
                const count = company.countsByForm[form];
                return count === undefined ? (
                  <td key={form} className="count none" title="No filings of this form in the last 12 months">
                    —
                  </td>
                ) : (
                  <td key={form} className="count">
                    {count.toLocaleString('en-US')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
