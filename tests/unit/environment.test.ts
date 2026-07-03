import { describe, expect, it } from "vitest";

import { readEnvironment } from "../../src/config/environment.js";

describe("readEnvironment", () => {
  it("parses SCP_NEXT environment variables", () => {
    expect(
      readEnvironment({
        SCP_NEXT_HOST: "example.com",
        SCP_NEXT_PORT: "2222",
        SCP_NEXT_USERNAME: "deploy",
        SCP_NEXT_PASSWORD: "secret",
        SCP_NEXT_PROFILE: "production",
        SCP_NEXT_TIMEOUT: "30000"
      })
    ).toMatchObject({
      host: "example.com",
      port: 2222,
      username: "deploy",
      password: "secret",
      profile: "production",
      timeout: 30000
    });
  });
});
