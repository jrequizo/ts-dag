import { describe, it, expect, expectTypeOf } from "vitest";

import Vertex from "@/Vertex";
import z from "zod/v4";

describe("Vertex< T, R > execute signature", () => {
  it("resolves the exact parameter and return types", () => {
    const v = new Vertex({
      input: z.string(),
      execute(input) {
        expectTypeOf(input).toEqualTypeOf<string>();
        return 123;
      },
    });

    v.execute("" as any);

    // The callable signature
    expectTypeOf(v.execute).parameters.toEqualTypeOf<[string]>();
    expectTypeOf(v.execute).parameter(0).toEqualTypeOf<string>();
    expectTypeOf(v.execute).returns.resolves.toEqualTypeOf<number>();
    // Shorthand assertions
    expectTypeOf(v.execute).toBeCallableWith("hello");
    // @ts-expect-error - should not accept number
    v.execute(42);
  });

  it("infers generic parameters from the provided function", () => {
    const v = new Vertex({
      input: z.number(),
      execute() {
        return "";
      },
    });

    // `v` should be Vertex<number, string>
    expectTypeOf(v).toEqualTypeOf<Vertex<z.ZodNumber, string>>();
    expectTypeOf(v.execute).parameters.toEqualTypeOf<[number]>();
    expectTypeOf(v.execute).returns.resolves.toEqualTypeOf<string>();
  });

  it("rejects mismatched generic arguments", async () => {
    new Vertex({
      // @ts-expect-error - execute is expecting a string
      input: z.number(),
      execute: (input: string) => {},
    });

    const resolvedInput: any[] = [];
    const vertex = new Vertex({
      input: z.void(),
      execute: (input) => {
        resolvedInput.push(input);
        return "";
      },
    });

    // @ts-expect-error - execute result must be string
    const result: number = await vertex.execute();
    expect(resolvedInput.at(0)).toBeUndefined();
  });

  //   it("Should check parent node's outputs for child execute", async () => {
  //     const parent = new Vertex(async (input: { value: number }) => {
  //       return {
  //         result: "test",
  //         next: input.value,
  //       } as const;
  //     });

  //     const child1 = new Vertex(async (input: string) => {});

  //     const child2 = new Vertex(
  //       async (input: { result: "test"; next: number }) => {}
  //     );

  //     let child3ResolvedInput;
  //     const child3 = new Vertex(async (input: { next: number }) => {
  //       child3ResolvedInput = input;
  //     });

  //     // This should throw an error as the inputs don't match
  //     // @ts-expect-error - child must accept the outputs of the parent
  //     parent.addChild(child1);

  //     // Working
  //     parent.addChild(child2);

  //     // Even partial is fine
  //     parent.addChild(child3);
  //   });

  //   it("Child should not contain polluted object", async () => {
  //     const parent = new Vertex(async (input: { value: number }) => {
  //       return {
  //         result: "test",
  //         next: input.value,
  //       } as const;
  //     });

  //     const resolvedInput: unknown[] = [];
  //     const child = new Vertex(async (input: { next: number }) => {
  //       resolvedInput.push(input);
  //     });

  //     parent.addChild(child);
  //     await parent.execute({ value: 67 });
  //     await new Promise((resolve) => setTimeout(resolve, 5));
  //     expect(resolvedInput.at(0)).not.toContain("result");
  //   });
});
