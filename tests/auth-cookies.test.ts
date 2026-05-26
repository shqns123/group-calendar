import test from "node:test";
import assert from "node:assert/strict";

import {
  getSessionCookieCandidates,
  isSecureAuthRequest,
} from "../lib/authCookies.ts";

test("treats forwarded https requests as secure auth requests", () => {
  assert.equal(
    isSecureAuthRequest({
      protocol: "http:",
      forwardedProto: "https",
    }),
    true,
  );
});

test("prefers secure session cookies when forwarded proto is https", () => {
  assert.deepEqual(
    getSessionCookieCandidates({
      protocol: "http:",
      forwardedProto: "https",
    }).slice(0, 4),
    [
      "__Secure-authjs.session-token",
      "__Secure-next-auth.session-token",
      "authjs.session-token",
      "next-auth.session-token",
    ],
  );
});

test("prefers non-secure cookie names for plain http requests", () => {
  assert.deepEqual(
    getSessionCookieCandidates({
      protocol: "http:",
      forwardedProto: null,
    }).slice(0, 4),
    [
      "authjs.session-token",
      "next-auth.session-token",
      "__Secure-authjs.session-token",
      "__Secure-next-auth.session-token",
    ],
  );
});
