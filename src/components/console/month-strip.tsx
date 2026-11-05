import { Link } from "@tanstack/react-router";
import { formatRupees } from "@/lib/money";

export type StripNumbers = {
  missing_paise: number;
  overdue_paise: number;
  billed_paise: number;
  collected_paise: number;
  paid_students: number;
  charged_students: number;
  active_students: number;
  ongoing_batches: number;
};

/** The month in one line above the table: what is owed (the only red figure), what came in, and the headcount. */
export function MonthStrip({
  numbers,
  arrearsPaise,
  arrearsLink = true,
}: {
  numbers: StripNumbers;
  arrearsPaise: number;
  arrearsLink?: boolean;
}) {
  const share =
    numbers.billed_paise > 0
      ? Math.min(100, Math.round((numbers.collected_paise / numbers.billed_paise) * 100))
      : 0;
  return (
    <div className="strip" data-tour="totals">
      <div className="strip-cell">
        <span className="strip-label">Owed this month</span>
        <strong className="strip-big" data-tone={numbers.missing_paise > 0 ? "warn" : "good"}>
          {formatRupees(numbers.missing_paise)}
        </strong>
      </div>
      <div className="strip-cell">
        <span className="strip-label">
          Collected · {formatRupees(numbers.collected_paise)} of{" "}
          {formatRupees(numbers.billed_paise)}
        </span>
        <span
          className="strip-bar"
          role="img"
          aria-label={`${share} percent of this month's fees collected`}
        >
          <span style={{ width: `${share}%` }} />
        </span>
      </div>
      <div className="strip-cell">
        <span className="strip-label">Paid</span>
        <strong className="strip-mid">
          {numbers.paid_students} of {numbers.charged_students}
        </strong>
      </div>
      <div className="strip-cell">
        <span className="strip-label">Dancers · Batches</span>
        <strong className="strip-mid">
          {numbers.active_students} · {numbers.ongoing_batches}
        </strong>
      </div>
      <div className="strip-cell">
        <span className="strip-label">Earlier months</span>
        {arrearsPaise > 0 ? (
          arrearsLink ? (
            <Link to="/app/billing" className="strip-link">
              {formatRupees(arrearsPaise)} still unpaid →
            </Link>
          ) : (
            <span className="strip-link">{formatRupees(arrearsPaise)} still unpaid</span>
          )
        ) : (
          <span className="strip-quiet">Nothing carried over</span>
        )}
      </div>
    </div>
  );
}
