import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getVisitorCountry } from "@/lib/country.functions";
import { bandFor, countryName, DEFAULT_COUNTRY, pickerCountries, type PriceBand } from "@/lib/ppp";

/** The country prices are shown for: the visitor's own once the server reports it, and changeable by hand. */
export function usePriceCountry(): { country: string; band: PriceBand; setCountry: (code: string) => void } {
  const detect = useServerFn(getVisitorCountry);
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  useEffect(() => {
    let cancelled = false;
    detect()
      .then((result) => {
        if (!cancelled && result.country) setCountry(result.country);
      })
      .catch(() => {
        // Without a reported country the rupee prices stay.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { country, band: bandFor(country), setCountry };
}

/** A small country chooser for the prices, so anyone can see the price for where their studio is. */
export function PriceCountryPicker({ country, onChange }: { country: string; onChange: (code: string) => void }) {
  const codes = pickerCountries.includes(country) ? pickerCountries : [country, ...pickerCountries];
  const options = codes.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <label className="price-country">
      Prices for{" "}
      <select value={country} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}
