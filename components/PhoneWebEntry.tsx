"use client";

import { PHONE_VIEWPORT } from "../mobile/src/lib/phoneViewport";
import { useEffect, useState, type ReactNode } from "react";

// Decide before mounting either UI so calendar subscriptions and dialogs run only once.
export function PhoneWebEntry({ children }: { children: ReactNode }) {
  const [showWeb, setShowWeb] = useState(false);
  useEffect(() => {
    const phone = window.matchMedia(PHONE_VIEWPORT);
    const select = () => {
      const query = new URLSearchParams(location.search);
      if (phone.matches && query.get("view") !== "web" && !query.has("groupName") && !query.has("error")) {
        location.replace("/login-ui" + location.search);
      } else {
        setShowWeb(true);
      }
    };
    select();
    phone.addEventListener("change", select);
    return () => phone.removeEventListener("change", select);
  }, []);
  return showWeb ? children : null;
}
