import { expectDefined } from "@openclaw/normalization-core";
import { describe, expect, it, vi } from "vitest";
import { createDeferred } from "../../test/helpers/promise.js";
import { revokePluginRecord } from "./registry-lifecycle.js";
import {
  createOwnershipRecord,
  createOwnershipSubagent,
} from "./registry-ownership.test-support.js";
import { createRuntimeTestRegistry } from "./registry-runtime.test-helpers.js";
import { createPluginRuntime } from "./runtime/index.js";
import {
  nativeSubagentRuntime,
  withNativeSubagentRequest,
} from "./runtime/native-subagent-context.js";
import type { NativeSubagentRuntime } from "./runtime/types-native-subagent.js";

const request = { requestId: "review", task: "Review this change" };
const listed = {
  runId: "child",
  childSessionKey: "agent:main:subagent:child",
  requestId: "review",
  status: "running" as const,
};

function fixture(native: NativeSubagentRuntime = nativeSubagentRuntime) {
  const runtime = createPluginRuntime();
  runtime.subagent = { ...createOwnershipSubagent("legacy"), native };
  const builder = createRuntimeTestRegistry(runtime);
  const record = createOwnershipRecord("controller");
  const backend = {
    spawn: vi.fn<NativeSubagentRuntime["spawn"]>(async () => ({
      runId: "child",
      childSessionKey: "agent:main:subagent:child",
      completionMode: "collect",
    })),
    collect: vi.fn(async () => ({ completed: [], pending: ["child"] })),
    list: vi.fn(async () => [listed]),
  } satisfies NativeSubagentRuntime;
  return { builder, record, backend };
}

describe("plugin native subagent admission", () => {
  it.each(["discovery", "tool-discovery", "setup-runtime"] as const)(
    "rejects %s mode without entering the native backend",
    async (registrationMode) => {
      const { builder, record, backend } = fixture();
      const api = builder.createApi(record, { config: {}, registrationMode });
      await withNativeSubagentRequest(
        () => backend,
        async () => {
          await expect(api.runtime.subagent.native!.spawn(request)).rejects.toThrow(
            "full registration mode",
          );
          await expect(api.runtime.subagent.native!.collect({ ids: ["child"] })).rejects.toThrow(
            "full registration mode",
          );
          await expect(api.runtime.subagent.native!.list!()).rejects.toThrow(
            "full registration mode",
          );
        },
      );
      expect(backend.spawn).not.toHaveBeenCalled();
      expect(backend.collect).not.toHaveBeenCalled();
      expect(backend.list).not.toHaveBeenCalled();
      expect(await api.runtime.subagent.waitForRun({ runId: "legacy" })).toEqual({ status: "ok" });
    },
  );

  it("lists the plugin's native children through the scoped runtime", async () => {
    const { builder, record, backend } = fixture();
    const api = builder.createApi(record, { config: {} });
    const list = expectDefined(api.runtime.subagent.native?.list, "native list");
    const create = vi.fn(() => backend);
    await withNativeSubagentRequest(create, async () => {
      await expect(list({ status: "running" })).resolves.toEqual([listed]);
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ pluginId: "controller" }));
    expect(backend.list).toHaveBeenCalledWith({ status: "running" });
  });

  it("omits listing when the host native runtime has none", () => {
    const { builder, record } = fixture({
      spawn: vi.fn<NativeSubagentRuntime["spawn"]>(),
      collect: vi.fn<NativeSubagentRuntime["collect"]>(),
    });
    const native = builder.createApi(record, { config: {} }).runtime.subagent.native;
    expect(native?.spawn).toBeTypeOf("function");
    expect(native?.list).toBeUndefined();
  });

  it("rechecks the actual registry owner after asynchronous preparation", async () => {
    const { builder, record, backend } = fixture();
    const api = builder.createApi(record, { config: {} });
    const entered = createDeferred();
    const resume = createDeferred<NativeSubagentRuntime>();
    const pending = withNativeSubagentRequest(
      () => {
        entered.resolve();
        return resume.promise;
      },
      () => api.runtime.subagent.native!.spawn(request),
    );
    await entered.promise;
    revokePluginRecord(builder.registry, record);
    resume.resolve(backend);
    await expect(pending).rejects.toThrow("no longer active");
    expect(backend.spawn).not.toHaveBeenCalled();
  });
});
