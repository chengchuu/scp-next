/* eslint-disable @typescript-eslint/no-var-requires, no-undef */
const { release } = require("mazey/scripts/git-helper.js");

release(undefined, { defaultBranch: "main" });
