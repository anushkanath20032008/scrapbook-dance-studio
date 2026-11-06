import { describe, expect, it } from "vitest";
import {
  buildImport,
  guessColumns,
  needsAnswer,
  parseCsv,
  recommendations,
  targetFromHeader,
  toSheet,
} from "@/lib/import-mapping";

const sheetOf = (text: string) => toSheet(parseCsv(text));

describe("headings", () => {
  it.each([
    ["Student Name", "name"],
    ["Mobile No.", "phone"],
    ["Monthly Fee (₹)", "fee"],
    ["Dance Class", "batch"],
    ["Father's Name", "parent"],
    ["Father Mobile", "phone"],
    ["Email ID", "email"],
    ["Date of Joining", "joinedOn"],
    ["Emergency Contact", "emergencyName"],
    ["Emergency Phone", "emergencyPhone"],
    ["Remarks", "note"],
    ["Blood group", null],
  ])("%s", (header, target) => expect(targetFromHeader(header)).toBe(target));
});

describe("reading a sheet", () => {
  const csv = [
    "Name,Mobile,Fee,Class,Parent,Blood group,Joined",
    "Anaya Rao,98765 43210,3000,Hip-hop,,B+,01/04/2025",
    'Diya Shah,9876543211,2500,"Under 10, Ballet",Meena Shah,O+,2025-05-02',
    "Kabir Jain,9876543212,2500,Under 10,Sunil Jain,A+,",
    "Meera Nair,9876543213,3000,Hip-hop,,B-,",
  ].join("\n");

  it("recognises what it can and asks only about the rest", () => {
    const guesses = guessColumns(sheetOf(csv));
    expect(guesses.map((g) => g.target)).toEqual([
      "name",
      "phone",
      "fee",
      "batch",
      "parent",
      "ignore",
      "joinedOn",
    ]);
    expect(guesses.filter(needsAnswer).map((g) => g.header)).toEqual(["Blood group"]);
  });

  it("builds dancers with several classes, a parent and a clean date", () => {
    const sheet = sheetOf(csv);
    const plan = buildImport(sheet, guessColumns(sheet));
    expect(plan.problems).toEqual([]);
    const diya = plan.dancers[1]!;
    expect(diya.batches).toEqual(["Under 10", "Ballet"]);
    expect(diya.parentName).toBe("Meena Shah");
    expect(diya.feePaise).toBe(250000);
    expect(plan.dancers[0]!.joinedOn).toBe("2025-04-01");
    expect(plan.batchNames.sort()).toEqual(["Ballet", "Hip-hop", "Under 10"]);
  });

  it("keeps a chosen unknown column in the notes with its heading", () => {
    const sheet = sheetOf(csv);
    const guesses = guessColumns(sheet).map((g) =>
      g.header === "Blood group" ? { ...g, target: "note" as const } : g,
    );
    expect(buildImport(sheet, guesses).dancers[0]!.note).toBe("Blood group: B+");
  });

  it("works out columns with no useful headings from what is inside", () => {
    const sheet = sheetOf(
      [
        "Col1,Col2,Col3",
        "Anaya,9876543210,3000",
        "Diya,9876543211,2500",
        "Kabir,9876543212,2500",
      ].join("\n"),
    );
    expect(guessColumns(sheet).map((g) => g.target)).toEqual(["name", "phone", "fee"]);
  });

  it("flags bad rows with the sheet's row number", () => {
    const sheet = sheetOf("Name,Phone\nAnaya,12345\nDiya,9876543211");
    const plan = buildImport(sheet, guessColumns(sheet));
    expect(plan.problems).toEqual([
      { sheetRow: 2, name: "Anaya", problem: "That phone number does not look right" },
    ]);
  });

  it("treats a first row of data as data", () => {
    const sheet = sheetOf("9876543210,3000\n9876543211,2500");
    expect(sheet.hadHeader).toBe(false);
    expect(sheet.rows).toHaveLength(2);
  });

  it("recommends what is missing", () => {
    const sheet = sheetOf("Name\nAnaya\nDiya");
    const guesses = guessColumns(sheet);
    const ids = recommendations(guesses, buildImport(sheet, guesses)).map((s) => s.id);
    expect(ids).toEqual(["phone", "fee", "batch"]);
  });
});

describe("csv", () => {
  it("handles quotes, semicolons and a byte-order mark", () => {
    expect(parseCsv('﻿a;b\n"x;y";"he said ""hi"""')).toEqual([
      ["a", "b"],
      ["x;y", 'he said "hi"'],
    ]);
  });
});
