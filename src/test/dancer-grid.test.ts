import { describe, expect, it } from "vitest";
import { addableFromGrid, checkGrid, emptyRow, pasteIntoGrid } from "@/lib/dancer-grid";

const blank = (n: number) => Array.from({ length: n }, emptyRow);

describe("checkGrid", () => {
  it("skips blank rows and accepts a name alone", () => {
    const out = checkGrid([{ ...emptyRow(), name: "Asha Rao" }, emptyRow()]);
    expect(out).toHaveLength(1);
    expect(out[0]?.problem).toBeNull();
  });

  it("flags bad phone, email, date and fee in words", () => {
    const out = checkGrid([
      { ...emptyRow(), name: "A", phone: "123" },
      { ...emptyRow(), name: "B", email: "nope" },
      { ...emptyRow(), name: "C", joinedOn: "31/02/2026" },
      { ...emptyRow(), name: "D", fee: "abc" },
      { ...emptyRow(), phone: "98765 43210" },
    ]);
    expect(out.map((d) => d.problem)).toEqual([
      "That phone number does not look right",
      "That email does not look right",
      "Write the joining date as day/month/year",
      "That fee does not look right",
      "No name on this row",
    ]);
  });

  it("turns dd/mm/yyyy into a stored date and flags a repeat", () => {
    const row = { ...emptyRow(), name: "Asha", phone: "98765 43210", joinedOn: "05/09/2026" };
    const out = checkGrid([row, row]);
    expect(out[0]?.joinedOn).toBe("2026-09-05");
    expect(out[1]?.problem).toBe("Already on the list above");
    expect(addableFromGrid(out)).toHaveLength(1);
  });
});

describe("pasteIntoGrid", () => {
  it("fills a tab-separated paste across the shown columns", () => {
    const { rows } = pasteIntoGrid(blank(2), 0, "name", ["name", "phone"], "Asha\t98765 43210\nBela\t91234 56789");
    expect(rows[1]).toMatchObject({ name: "Bela", phone: "91234 56789" });
  });

  it("uses a heading row to place columns and shows them", () => {
    const { rows, shown } = pasteIntoGrid(blank(1), 0, "name", ["name"], "Name\tEmail\nAsha\ta@b.co");
    expect(shown).toContain("email");
    expect(rows[0]).toMatchObject({ name: "Asha", email: "a@b.co" });
  });

  it("reads a typed list and grows the table", () => {
    const { rows, shown } = pasteIntoGrid(blank(1), 0, "name", ["name"], "Asha Rao, 98765 43210\nBela Shah, 91234 56789, 1800");
    expect(rows).toHaveLength(2);
    expect(rows[1]?.fee).toBe("1800");
    expect(shown).toEqual(["name", "phone", "fee"]);
  });

  it("puts a single word in the clicked cell", () => {
    const { rows } = pasteIntoGrid(blank(2), 1, "name", ["name"], "Chirag");
    expect(rows[1]?.name).toBe("Chirag");
  });
});
