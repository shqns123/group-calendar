import test from "node:test";
import assert from "node:assert/strict";

import { createGoogleProviderOptions } from "../lib/googleAuthOptions.ts";

test("allows trusted Google accounts to link by verified email", () => {
  const options = createGoogleProviderOptions();

  assert.equal(options.allowDangerousEmailAccountLinking, true);
});
