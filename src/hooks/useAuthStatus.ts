"use client";

import { useEffect, useState } from "react";

// Whether the visitor has a valid session. `checked` flips to true once
// /api/auth/me has answered, so public pages can avoid flashing the
// logged-out UI at signed-in users.
export function useAuthStatus() {
  const [state, setState] = useState({ checked: false, isLoggedIn: false });

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((res) => active && setState({ checked: true, isLoggedIn: res.ok }))
      .catch(() => active && setState({ checked: true, isLoggedIn: false }));
    return () => {
      active = false;
    };
  }, []);

  return state;
}
