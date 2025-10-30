import z from "zod/v4";
import { describe, it, expect, vi } from "vitest";

import Vertex from "@/Vertex";

describe("Vertex constructor tests", () => {
  it("Should chain parent outputs to child", () => {
    const parent = new Vertex({
      input: z.object({
        foo: z.string(),
      }),
      execute(input) {
        return {
          bar: z.string(),
        };
      },
    });

    const child = new Vertex({
      input: z.object({
        bar: z.string(),
      }),
      execute(input) {},
    });

    parent.addChild(child);
  });
});
