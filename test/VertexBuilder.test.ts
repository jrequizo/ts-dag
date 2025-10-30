import z from "zod/v4";
import { describe, it } from "vitest";

import Vertex from "@/Vertex";

describe("Vertex constructor tests", () => {
    // it("Should chain parent outputs to child", () => {

  it("Should enforce child inputs when parent adds child", () => {
    const parent = new Vertex({
      input: z.void(),
      execute() {
        return {
          bar: "",
        };
      },
    });

    const child = new Vertex({
      input: z.object({
        bar: z.string(),
        baz: z.number()
      }),
      execute(_) {
        return false
      },
    });

    // @ts-expect-error - 'baz' required but not supplied by parent output
    parent.addChild(child);
  });
});
