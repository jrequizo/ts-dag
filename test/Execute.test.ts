import { describe, it, expectTypeOf } from "vitest";

import Vertex from "@/Vertex";

describe("Vertex< T, R > execute signature", () => {
  it("resolves the exact parameter and return types", () => {
    const v = new Vertex<string, number>(async (input) => {
      // Inside the function, `input` should be `string`
      expectTypeOf(input).toEqualTypeOf<string>();
      return 123;
    });

    // The callable signature
    expectTypeOf(v.execute).parameters.toEqualTypeOf<[string]>();
    expectTypeOf(v.execute).parameter(0).toEqualTypeOf<string>();
    expectTypeOf(v.execute).returns.toEqualTypeOf<Promise<number>>();

    // Shorthand assertions
    expectTypeOf(v.execute).toBeCallableWith("hello");
    // @ts-expect-error - should not accept number
    v.execute(42);
  });

  it("infers generic parameters from the provided function", () => {
    const v = new Vertex(async (n: number) => n.toString());

    // `v` should be Vertex<number, string>
    expectTypeOf(v).toEqualTypeOf<Vertex<number, string>>();
    expectTypeOf(v.execute).parameters.toEqualTypeOf<[number]>();
    expectTypeOf(v.execute).returns.toEqualTypeOf<Promise<string>>();
  });

  it("rejects mismatched generic arguments", () => {
    // @ts-expect-error - execute must accept string when Vertex<string, number>
    new Vertex<string, number>(async (n: number) => n);

    // @ts-expect-error - return must be Promise<number>, not Promise<string>
    new Vertex<string, number>(async (_s: string) => "nope");
  });

  it("Should check parent node's outputs for child execute", async () => {
    const parent = new Vertex(async (input: { value: number }) => {
      return {
        result: "test",
        next: input.value,
      } as const;
    });

    const child1 = new Vertex(async (input: string) => {});

    const child2 = new Vertex(
      async (input: { result: "test"; next: number }) => {}
    );

    let child3ResolvedInput;
    const child3 = new Vertex(async (input: { next: number }) => {
      child3ResolvedInput = input;
    });

    // This should throw an error as the inputs don't match
    // @ts-expect-error - child must accept the outputs of the parent
    parent.addChild(child1);

    // Working
    parent.addChild(child2);

    // Even partial is fine
    parent.addChild(child3);
  });

  it("Child should not contain polluted object", async () => {
    const parent = new Vertex(async (input: { value: number }) => {
      return {
        result: "test",
        next: input.value,
      } as const;
    });

    const resolvedInput: unknown[] = [];
    const child = new Vertex(async (input: { next: number }) => {
      resolvedInput.push(input);
    });

    parent.addChild(child);
    await parent.execute({ value: 67 });
    await new Promise(resolve => setTimeout(resolve, 5))
    expect(resolvedInput.at(0)).not.toContain("result");
  });
});
