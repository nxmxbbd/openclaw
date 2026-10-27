import { describe, expect, it } from "vitest";
import { useDoctorLegacyConfigFixture } from "./doctor/shared/legacy-config-fixture.test-support.js";

describe("legacy agent config repairs", () => {
  useDoctorLegacyConfigFixture();

  it.each(["entries", "list"] as const)(
    "removes null workspace values from agents.%s",
    async (kind) => {
      const { normalizeCompatibilityConfigValues } =
        await import("./doctor/shared/legacy-config-core-migrate.js");
      const entries = {
        main: { workspace: null },
        beta: { workspace: "/beta" },
        gamma: {},
      };
      const res = normalizeCompatibilityConfigValues({
        agents: {
          [kind]: kind === "entries" ? entries : Object.values(entries),
        },
      });

      expect(res.config.agents?.[kind]).toEqual(
        kind === "entries"
          ? { main: {}, beta: { workspace: "/beta" }, gamma: {} }
          : [{}, { workspace: "/beta" }, {}],
      );
      expect(res.changes).toContain(`Removed null workspace value from agents.${kind} entry.`);
    },
  );

  it.each([
    {
      name: "malformed",
      defaults: { start: "99:99", end: "17:00" },
      agent: { start: "09:00", end: "not-a-time" },
    },
    {
      name: "valid",
      defaults: { start: "09:00", end: "24:00", timezone: "user" },
      agent: { start: "22:00", end: "06:00" },
    },
  ])(
    "preserves $name heartbeat hours for durable Doctor migration",
    async ({ defaults, agent }) => {
      const { normalizeCompatibilityConfigValues } =
        await import("./doctor/shared/legacy-config-core-migrate.js");
      const res = normalizeCompatibilityConfigValues({
        agents: {
          defaults: { heartbeat: { every: "30m", activeHours: defaults } },
          entries: { ops: { heartbeat: { prompt: "Check alerts", activeHours: agent } } },
        },
      });

      expect(res.config.agents?.defaults?.heartbeat).toEqual({
        every: "30m",
        activeHours: defaults,
      });
      expect(res.config.agents?.entries?.ops?.heartbeat).toEqual({
        prompt: "Check alerts",
        activeHours: agent,
      });
      expect(res.changes).toEqual([]);
    },
  );
});
