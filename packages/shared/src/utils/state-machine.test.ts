import { describe, expect, it } from "vitest";
import { createStatusMachine } from "./state-machine";

type Light = "red" | "green" | "off";

const machine = createStatusMachine<Light>({
  red: ["green"],
  green: ["red", "off"],
  off: [],
});

describe("createStatusMachine", () => {
  it("permits declared transitions", () => {
    expect(machine.canTransition("red", "green")).toBe(true);
    expect(machine.canTransition("green", "off")).toBe(true);
  });

  it("forbids undeclared transitions", () => {
    expect(machine.canTransition("red", "off")).toBe(false);
  });

  it("reports terminal states", () => {
    expect(machine.isTerminal("off")).toBe(true);
    expect(machine.isTerminal("red")).toBe(false);
  });

  it("exposes next states", () => {
    expect(machine.nextStates("green")).toEqual(["red", "off"]);
    expect(machine.nextStates("off")).toEqual([]);
  });

  it("exposes the underlying transition table", () => {
    expect(machine.transitions.red).toEqual(["green"]);
  });
});
