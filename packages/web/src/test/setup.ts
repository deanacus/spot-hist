// fallow-ignore-file unused-file

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { clearTestHarnessState } from "./harness";

afterEach(() => {
  cleanup();
  clearTestHarnessState();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
