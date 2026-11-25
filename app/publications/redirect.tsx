"use client";

import { useEffect } from "react";

import { withBasePath } from "@/lib/base-path";

/** Carries an old /publications?theme=… link over to /research with its filter intact. */
export function PublicationsRedirect() {
  useEffect(() => {
    window.location.replace(withBasePath(`/research/${window.location.search}#publications`));
  }, []);
  return null;
}
