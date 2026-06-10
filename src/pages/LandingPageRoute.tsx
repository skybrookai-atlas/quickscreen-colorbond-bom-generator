import { getSubdomain } from "../lib/subdomain";
import { SupplierPortalPage } from "./SupplierPortalPage";
import { LandingPage } from "./LandingPage";

export function LandingPageRoute() {
  const subdomain = getSubdomain();

  if (subdomain) {
    return <SupplierPortalPage />;
  }

  return <LandingPage />;
}
