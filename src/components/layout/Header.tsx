import { Eye, EyeOff, LogOut, Menu, Moon, Plus, PlayCircle, Sun, Trash2, WifiOff, X, Shield, ChevronDown } from 'lucide-react';
import { useEffect, useState, useRef, type ReactNode } from 'react';
import { NavLink, Link, useParams } from 'react-router-dom';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { useProfile } from '../../context/ProfileContext';
import type { TenantBranding } from '../../lib/tenantThemes';
import { INSTALL_VIDEOS, type InstallVideoKey } from '../../lib/installVideos';
import { InstallVideoQR } from '../calculator-v3/InstallVideoQR';
import { AmazingFencingLogo } from '../brand/AmazingFencingLogo';
import { GlassOutletLogo } from '../brand/GlassOutletLogo';
import { ByronBeyondFencingLogo } from '../brand/ByronBeyondFencingLogo';

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
  const { supplierSlug } = useParams<{ supplierSlug?: string }>();
  const [installVideosOpen, setInstallVideosOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [offline, setOffline] = useState(() => navigator.onLine === false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
    `text-xs font-bold px-3 py-1.5 rounded-lg border transition-all duration-200 ${isActive
      ? 'text-brand-text bg-brand-border/30 border-brand-border/60 shadow-sm'
      : 'text-brand-muted border-transparent hover:text-brand-text hover:bg-brand-border/20'
    }`;

  const newQuoteLinkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all duration-200 ml-1 ${isActive
      ? 'text-brand-accent bg-brand-accent/10 border-brand-accent/25 shadow-sm'
      : 'text-brand-accent border-transparent hover:bg-brand-accent/10 hover:border-brand-accent/25'
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
              {supplierSlug === "glass-outlet" ? (
                <GlassOutletLogo className="scale-75 origin-left" showThe={false} textClassName="text-white" />
              ) : supplierSlug === "byron-and-beyond-fencing" ? (
                <ByronBeyondFencingLogo className="scale-75 origin-left" />
              ) : _brandLogoSrc ? (
                <img src={_brandLogoSrc} alt={_brandLogoAlt} className="h-10 object-contain" />
              ) : (
                <AmazingFencingLogo className="scale-75 origin-left" />
              )}
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
        {user ? (
          <>
            {!showCypressMinimal && (
              <div className="relative hidden sm:block" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-1.5 rounded-xl border border-brand-border bg-brand-bg/40 px-2 py-1.5 hover:border-brand-primary/60 hover:bg-brand-bg/75 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  aria-haspopup="true"
                  aria-expanded={userMenuOpen}
                >
                  <div
                    title={user.email ?? ''}
                    className="h-7 w-7 select-none items-center justify-center rounded-full border border-brand-accent/30 bg-brand-accent/15 text-xs font-bold text-brand-accent flex transition-transform hover:scale-105"
                  >
                    {initials}
                  </div>
                  <ChevronDown size={14} className="text-brand-muted transition-transform duration-200" style={{ transform: userMenuOpen ? 'rotate(180deg)' : 'none' }} />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-brand-border/60 glass-panel py-2.5 shadow-2xl z-50 text-xs text-brand-text animate-fade-in-scale">
                    <div className="px-3 py-2 border-b border-brand-border/60 mb-1">
                      <p className="font-bold truncate text-brand-text" title={user.email}>{user.email}</p>
                      <p className="text-[10px] text-brand-muted uppercase font-extrabold tracking-wider mt-0.5">{role || 'User'}</p>
                    </div>

                    <div className="py-1 space-y-0.5 px-1">
                      {onCustomerModeChange && (
                        <button
                          type="button"
                          onClick={() => {
                            onCustomerModeChange(!customerMode);
                            setUserMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left rounded-lg text-brand-text hover:bg-brand-accent/10 hover:text-brand-accent transition-colors font-medium"
                        >
                          {customerMode ? <EyeOff size={15} className="text-brand-muted shrink-0" /> : <Eye size={15} className="text-brand-muted shrink-0" />}
                          <span>{customerMode ? "Switch to Cost Mode" : "Switch to Customer Mode"}</span>
                        </button>
                      )}

                      {isPrivileged && (
                        <button
                          type="button"
                          onClick={() => {
                            setInstallVideosOpen(true);
                            setUserMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left rounded-lg text-brand-text hover:bg-brand-accent/10 hover:text-brand-accent transition-colors font-medium"
                        >
                          <PlayCircle size={15} className="text-brand-muted shrink-0" />
                          <span>Install Videos</span>
                        </button>
                      )}

                      {isPrivileged && (
                        <button
                          type="button"
                          onClick={() => {
                            toggle();
                            setUserMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left rounded-lg text-brand-text hover:bg-brand-accent/10 hover:text-brand-accent transition-colors font-medium"
                        >
                          {theme === 'light' ? <Moon size={15} className="text-brand-muted shrink-0" /> : <Sun size={15} className="text-brand-muted shrink-0" />}
                          <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                        </button>
                      )}

                      {role === 'admin' && (
                        <Link
                          to="/admin/portal"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-2.5 py-2 text-left rounded-lg text-brand-accent hover:bg-brand-accent/15 transition-colors font-semibold"
                        >
                          <Shield size={15} className="text-brand-accent shrink-0" />
                          <span>Admin Portal</span>
                        </Link>
                      )}
                    </div>

                    <div className="border-t border-brand-border/60 mt-1.5 pt-1.5 px-1">
                      <button
                        type="button"
                        onClick={() => {
                          handleSignOut();
                          setUserMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left rounded-lg hover:bg-brand-danger/10 text-brand-danger transition-colors font-semibold"
                      >
                        <LogOut size={15} className="text-brand-danger shrink-0" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
