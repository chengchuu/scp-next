/**
 * @jest-environment node
 */
/* eslint-disable no-undef */

test("Is foo() true?", () => {
  expect("foo".length === 3).toBe(true);
});
