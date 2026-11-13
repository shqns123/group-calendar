import type { useRouter } from "expo-router";

type Router = ReturnType<typeof useRouter>;

/**
 * Close the current screen: back if there is a screen behind it, otherwise go to `fallback`.
 * A screen opened straight from a link (a widget tap that cold-starts the app, a typed URL on the
 * web preview) has nothing behind it, and a plain back() would leave you stuck there.
 */
export function closeScreen(router: Router, fallback: "/" | "/settings" = "/") {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
