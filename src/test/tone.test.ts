import { describe, expect, it } from "vitest";
import { registerTones, toneOf } from "@/lib/tone";

describe("batch colours", () => {
  it("gives different batches different colours, and the same batch the same one", () => {
    registerTones(["Under 10", "Adults", "Hip-hop"]);
    const tones = ["Adults", "Hip-hop", "Under 10"].map(toneOf);
    expect(new Set(tones).size).toBe(3);
    expect(toneOf("Adults")).toBe(tones[0]);
  });
});
