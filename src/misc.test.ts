export const NotHere = () => expect("").toMatch(`Code should not run here`);

describe("misc tests", () => {
  it("noop", () => {
    // noop
  });
});
