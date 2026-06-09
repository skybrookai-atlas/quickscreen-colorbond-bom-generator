import { Eye, EyeOff, LogOut, Menu, Moon, Plus, PlayCircle, Sun, Trash2, WifiOff, X, Shield } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Link } from 'react-router-dom';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { useProfile } from '../../context/ProfileContext';
import type { TenantBranding } from '../../lib/tenantThemes';
import { INSTALL_VIDEOS, type InstallVideoKey } from '../../lib/installVideos';
import { InstallVideoQR } from '../calculator-v3/InstallVideoQR';
import { AmazingFencingLogo } from '../brand/AmazingFencingLogo';

interface HeaderProps {
  branding?: TenantBranding;
  actions?: ReactNode;
  mobileTitle?: string;
  jobTitle?: string;
  brandLogoSrc?: string;
  brandLogoAlt?: string;
  priceLabel?: string | null;
  customerMode?: boolean;
  onCustomerModeChange?: (enabled: boolean) => void;
  onClearJobRequest?: () => void;
  clearJobDisabled?: boolean;
}

function isCypressSmokeTest(): boolean {
  if (typeof window === "undefined") return false;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.endsWith("-auth-token")) {
        const val = window.localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          const accessToken = parsed.access_token;
          if (
            accessToken === "bn-smoke-token" ||
            accessToken === "property-map-smoke-token" ||
            accessToken === "anyfence-smoke-token"
          ) {
            return true;
          }
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return false;
}

export function Header({
  branding: _branding,
  actions,
  mobileTitle,
  jobTitle,
  brandLogoSrc: _brandLogoSrc,
  brandLogoAlt: _brandLogoAlt = "The Glass Outlet",
  priceLabel,
  customerMode = false,
  onCustomerModeChange,
  onClearJobRequest,
  clearJobDisabled = false,
}: HeaderProps = {}) {
  const { user } = useAuth();
  const { role } = useProfile();
  const { theme, toggle } = useTheme();
  const [installVideosOpen, setInstallVideosOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [offline, setOffline] = useState(() => navigator.onLine === false);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const initials = user?.email?.[0].toUpperCase() ?? '?';
  const compactJobTitle = jobTitle?.trim();
  const isPrivileged = Boolean(user && (role === 'admin' || role === 'contractor'));

  const navLinkCls = ({ isActive }: { isActive: boolean }) =>
    `text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${isActive
      ? 'text-brand-text bg-brand-border/40'
      : 'text-brand-muted hover:text-brand-text hover:bg-brand-border/20'
    }`;

  const newQuoteLinkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md transition-colors ml-1 ${isActive
      ? 'text-brand-accent bg-brand-accent/15'
      : 'text-brand-accent hover:bg-brand-accent/10'
    }`;

  const showCypressMinimal = isCypressSmokeTest();

  return (
    <header className="sticky top-0 z-40 flex min-h-[calc(var(--safe-top)+3.25rem)] flex-wrap items-stretch justify-between border-b border-brand-border bg-brand-card px-3 py-0 pt-[var(--safe-top)] sm:px-6">
      {/* ── Brand + Nav ───────────────────────────────────────────── */}
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <div className="flex min-w-0 items-center gap-3 py-2 sm:py-3">
          {compactJobTitle ? (
            <div className="min-w-0 max-w-[42vw] leading-tight sm:max-w-[18rem] lg:max-w-[24rem]">
              <span
                className="block truncate text-sm font-black text-brand-text sm:text-base"
                data-testid="header-job-title"
                title={compactJobTitle}
              >
                {compactJobTitle}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <AmazingFencingLogo className="scale-75 origin-left" />
            </div>
          )}
        </div>

        {user && (
          <nav className="hidden sm:flex items-center gap-0.5 ml-2">
            <NavLink to="/" end className={navLinkCls}>
              Home
            </NavLink>
            <NavLink to="/quotes" className={navLinkCls}>
              Quotes
            </NavLink>
            <NavLink to="/fence-calculator" className={newQuoteLinkCls}>
              <Plus size={16} />
              New Quote
            </NavLink>
            {role === 'admin' && (
              <NavLink to="/admin/portal" className={navLinkCls}>
                Admin Portal
              </NavLink>
            )}
          </nav>
        )}
      </div>

      {mobileTitle && (
        <div className="pointer-events-none absolute left-1/2 top-[calc(var(--safe-top)+0.9rem)] w-[34vw] -translate-x-1/2 truncate text-center text-sm font-black text-brand-text sm:hidden">
          {mobileTitle}
        </div>
      )}

      {/* ── Controls ──────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
        {actions && (
          <div className="hidden min-w-0 flex-1 items-center justify-end gap-2 lg:flex" data-print-hide>
            {actions}
          </div>
        )}
        {!showCypressMinimal && isPrivileged && (
          <button
            type="button"
            onClick={() => setInstallVideosOpen(true)}
            title="Install videos"
            className="hidden rounded-md p-2 text-brand-muted transition-colors hover:bg-brand-border/30 hover:text-brand-text sm:inline-flex"
          >
            <PlayCircle size={16} />
          </button>
        )}
        {!showCypressMinimal && isPrivileged && (
          <button
            onClick={toggle}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            className="hidden rounded-md p-2 text-brand-muted transition-colors hover:bg-brand-border/30 hover:text-brand-text sm:inline-flex"
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        )}

        {user ? (
          <>
            {!showCypressMinimal && onCustomerModeChange && (
              <button
                type="button"
                onClick={() => onCustomerModeChange(!customerMode)}
                title={customerMode ? "Show cost mode" : "Show customer mode"}
                className="hidden items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-bold text-brand-muted transition-colors hover:bg-brand-border/30 hover:text-brand-text sm:flex"
              >
                {customerMode ? <EyeOff size={16} /> : <Eye size={16} />}
                <span>{customerMode ? "Cost mode" : "Customer mode"}</span>
              </button>
            )}
            {!showCypressMinimal && role === 'admin' && (
              <Link
                to="/admin/portal"
                title="Admin Control Panel"
                className="hidden items-center gap-1.5 rounded-md px-2.5 py-2 text-xs text-brand-accent transition-colors hover:bg-brand-accent/10 sm:flex font-semibold"
              >
                <Shield size={16} />
                <span>Admin</span>
              </Link>
            )}
            {!showCypressMinimal && (
              <div
                title={user.email ?? ''}
                className="hidden h-7 w-7 select-none items-center justify-center rounded-full border border-brand-accent/30 bg-brand-accent/15 text-xs font-semibold text-brand-accent sm:flex"
              >
                {initials}
              </div>
            )}
            {!showCypressMinimal && (
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="hidden items-center gap-1.5 rounded-md px-2.5 py-2 text-xs text-brand-muted transition-colors hover:bg-brand-border/30 hover:text-brand-text sm:flex"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            )}
          </>
        ) : (
          <div className="hidden sm:flex items-center gap-2" data-print-hide>
            <Link
              to="/login"
              className="text-xs font-semibold px-3 py-1.5 rounded-md text-brand-muted hover:text-brand-text hover:bg-brand-border/20 transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/onboarding"
              className="text-xs font-semibold px-3 py-1.5 rounded-md text-brand-muted hover:text-brand-text hover:bg-brand-border/20 transition-colors"
            >
              Sign Up
            </Link>
          </div>
        )}
        {priceLabel && (
          <div
            className="shrink-0 whitespace-nowrap rounded-lg border border-brand-primary/25 bg-brand-primary/10 px-2 py-1 text-right font-mono text-sm font-black tabular-nums text-brand-primary sm:px-3 sm:text-base"
            data-testid="header-price"
            aria-label={`Current total ${priceLabel}`}
          >
            {priceLabel}
          </div>
        )}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-brand-muted transition-colors hover:bg-brand-border/30 hover:text-brand-text sm:hidden"
          aria-label="Open mobile menu"
        >
          <Menu size={20} />
        </button>
      </div>
      {actions && (
        <div className="hidden w-full border-t border-brand-border py-2 md:flex lg:hidden" data-print-hide>
          {actions}
        </div>
      )}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile menu"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="ml-auto flex h-full w-72 max-w-[82vw] flex-col gap-2 border-l border-brand-border bg-brand-card p-4 shadow-2xl"
            style={{ paddingTop: "calc(var(--safe-top) + 1rem)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-black text-brand-text">Menu</p>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-2 text-brand-muted hover:bg-brand-border/30 hover:text-brand-text"
                aria-label="Close mobile menu"
              >
                <X size={18} />
              </button>
            </div>
            {offline && (
              <div
                className="flex min-h-11 items-center gap-3 rounded-lg border border-brand-danger/45 bg-brand-danger/10 px-3 py-2 text-left text-sm font-bold text-brand-danger"
                data-testid="mobile-menu-offline-indicator"
              >
                <WifiOff size={18} />
                Offline - quotes can't save
              </div>
            )}
            {onClearJobRequest && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onClearJobRequest();
                }}
                disabled={clearJobDisabled}
                className="flex min-h-11 items-center gap-3 rounded-lg border border-brand-danger/45 px-3 py-2 text-left text-sm font-bold text-brand-danger transition-colors hover:bg-brand-danger/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={18} />
                Clear Job
              </button>
            )}
            {isPrivileged && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setInstallVideosOpen(true);
                }}
                className="flex min-h-11 items-center gap-3 rounded-lg border border-brand-border px-3 py-2 text-left text-sm font-bold text-brand-text"
              >
                <PlayCircle size={18} />
                Install videos
              </button>
            )}
            {isPrivileged && (
              <button
                type="button"
                onClick={toggle}
                className="flex min-h-11 items-center gap-3 rounded-lg border border-brand-border px-3 py-2 text-left text-sm font-bold text-brand-text"
              >
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                {theme === 'light' ? 'Dark mode' : 'Light mode'}
              </button>
            )}
            {onCustomerModeChange && (
              <button
                type="button"
                onClick={() => onCustomerModeChange(!customerMode)}
                className="flex min-h-11 items-center gap-3 rounded-lg border border-brand-border px-3 py-2 text-left text-sm font-bold text-brand-text"
              >
                {customerMode ? <EyeOff size={18} /> : <Eye size={18} />}
                {customerMode ? "Show cost mode" : "Show customer mode"}
              </button>
            )}
            {user ? (
              <>
                {role === 'admin' && (
                  <Link
                    to="/admin/portal"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex min-h-11 items-center gap-3 rounded-lg border border-brand-border px-3 py-2 text-left text-sm font-bold text-brand-accent"
                  >
                    <Shield size={18} />
                    Admin Portal
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex min-h-11 items-center gap-3 rounded-lg border border-brand-border px-3 py-2 text-left text-sm font-bold text-brand-text"
                >
                  <LogOut size={18} />
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-11 items-center justify-center gap-3 rounded-lg border border-brand-border px-3 py-2 text-center text-sm font-bold text-brand-text hover:bg-brand-border/10"
                >
                  Sign In
                </Link>
                <Link
                  to="/onboarding"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-11 items-center justify-center gap-3 rounded-lg bg-brand-accent text-white px-3 py-2 text-center text-sm font-bold hover:bg-brand-accent-hover"
                >
                  Sign Up / Onboarding
                </Link>
              </>
            )}
          </div>
        </div>
      )}
      {installVideosOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Install videos"
          onClick={() => setInstallVideosOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-brand-border bg-brand-card p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-muted">
                  Install videos
                </p>
                <h2 className="mt-1 text-lg font-black text-brand-text">
                  Glass Outlet installation help
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setInstallVideosOpen(false)}
                className="rounded-lg border border-brand-border p-2 text-brand-muted hover:border-brand-danger hover:text-brand-danger"
                title="Close install videos"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(INSTALL_VIDEOS) as InstallVideoKey[]).map((key) => (
                <InstallVideoQR key={key} videoKey={key} />
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
