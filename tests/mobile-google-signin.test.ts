import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Run the actual native wrapper against a Google SDK double. Native modules
// cannot load in Node, and account selection must be tested without real accounts.
const source = readFileSync(new URL("../mobile/src/lib/google.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;

function fixture(choices: (string | null)[], failSignOut = false) {
  let cached: string | null = "test-account";
  let chooserCount = 0;
  let signOutCount = 0;
  let configureCount = 0;
  const sdk = {
    GoogleSignin: {
      configure() { configureCount++; },
      async hasPlayServices() { return true; },
      async signOut() {
        signOutCount++;
        if (failSignOut) throw new Error("SDK sign-out failed");
        cached = null;
      },
      async signIn() {
        // A remembered account skips the chooser, matching the reported bug.
        if (cached) return { type: "success", data: { idToken: `token:${cached}` } };
        chooserCount++;
        cached = choices.shift() ?? null;
        return cached ? { type: "success", data: { idToken: `token:${cached}` } } : { type: "cancelled" };
      },
    },
    isSuccessResponse: (response: { type: string }) => response.type === "success",
  };
  const nativeModule = { exports: {} as { getGoogleIdToken: () => Promise<string | null>; googleSignOut: () => Promise<void> } };
  vm.runInNewContext(compiled, {
    module: nativeModule, exports: nativeModule.exports,
    process: { env: { EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: "test-web-client", EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: "test-ios-client" } },
    require(name: string) {
      if (name === "react-native") return { Platform: { OS: "android" } };
      if (name === "@react-native-google-signin/google-signin") return sdk;
      throw new Error(`Unexpected module: ${name}`);
    },
  });
  return { api: nativeModule.exports, counts: () => ({ chooserCount, signOutCount, configureCount }) };
}

test("a remembered test account can be replaced with the main Google account", async () => {
  const f = fixture(["main-account"]);
  assert.equal(await f.api.getGoogleIdToken(), "token:main-account");
  assert.equal(f.counts().chooserCount, 1);
});

test("every login/signup attempt can choose a different account", async () => {
  const f = fixture(["test-account", "main-account", "signup-account"]);
  assert.equal(await f.api.getGoogleIdToken(), "token:test-account");
  assert.equal(await f.api.getGoogleIdToken(), "token:main-account");
  assert.equal(await f.api.getGoogleIdToken(), "token:signup-account");
  assert.deepEqual(f.counts(), { chooserCount: 3, signOutCount: 3, configureCount: 1 });
});

test("cancelling the chooser does not reuse the previous token and permits retry", async () => {
  const f = fixture([null, "main-account"]);
  assert.equal(await f.api.getGoogleIdToken(), null);
  assert.equal(await f.api.getGoogleIdToken(), "token:main-account");
  assert.equal(f.counts().chooserCount, 2);
});

test("reset failure never silently signs in as the cached account", async () => {
  const f = fixture(["main-account"], true);
  await assert.rejects(f.api.getGoogleIdToken(), /SDK sign-out failed/);
  assert.equal(f.counts().chooserCount, 0);
});

test("logout clears the Google SDK selection and tolerates SDK logout errors", async () => {
  const f = fixture(["test-account", "main-account"]);
  await f.api.getGoogleIdToken();
  await f.api.googleSignOut();
  assert.equal(await f.api.getGoogleIdToken(), "token:main-account");
  assert.equal(f.counts().signOutCount, 3);
  await fixture([], true).api.googleSignOut();
});
