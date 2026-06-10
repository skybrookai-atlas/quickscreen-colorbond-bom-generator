/**
 * Extracts the subdomain from the current window location hostname.
 * Returns null if no subdomain is present, or if it is a common system subdomain like 'www' or 'admin'.
 */
export function getSubdomain(): string | null {
  if (typeof window === "undefined") return null;
  const hostname = window.location.hostname;

  // Split hostname into parts
  const parts = hostname.split(".");

  if (parts.length <= 1) return null;

  // Handle localhost (e.g. byron-and-beyond-fencing.localhost)
  if (parts.includes("localhost")) {
    if (parts.length > 1 && parts[0] !== "localhost" && parts[0] !== "www" && parts[0] !== "admin") {
      return parts[0];
    }
    return null;
  }

  // Handle Anyfence domain specifically (e.g., xxx.anyfence.com.au)
  const isAnyfence = hostname.endsWith("anyfence.com.au");
  if (isAnyfence) {
    if (parts.length > 3) {
      const sub = parts.slice(0, parts.length - 3).join(".");
      if (sub !== "www" && sub !== "admin") return sub;
    }
    return null;
  }

  // Fallback for standard domains (e.g. sub.domain.com)
  if (parts.length > 2) {
    const sub = parts.slice(0, parts.length - 2).join(".");
    if (sub !== "www" && sub !== "admin") return sub;
  }

  return null;
}
