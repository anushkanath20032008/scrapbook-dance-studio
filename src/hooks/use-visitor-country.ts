import { useEffect, useState } from "react";
import { getVisitorCountry } from "@/lib/visitor-country.functions";

/** The visitor's country code once known (null while loading, unknown, or if the lookup fails). */
export function useVisitorCountry(): string | null {
  const [country, setCountry] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getVisitorCountry()
      .then((result) => alive && setCountry(result.country))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return country;
}
