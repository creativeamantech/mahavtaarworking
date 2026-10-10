// @ts-nocheck
// Thin compatibility layer that maps the react-router-dom API used by the
// original Mahavtaar-Ledger code onto TanStack Router.
import { forwardRef, useEffect, type AnchorHTMLAttributes, type ReactNode } from "react";
import { useRouter, useRouterState, useParams as useTsParams } from "@tanstack/react-router";

type NavOpts = { replace?: boolean; state?: unknown };

export function useNavigate() {
  const router = useRouter();
  return (to: string | number, opts?: NavOpts) => {
    if (typeof to === "number") {
      router.history.go(to);
      return;
    }
    router.navigate({ href: to, replace: opts?.replace });
  };
}

export function useLocation() {
  const loc = useRouterState({ select: (s) => s.location });
  const searchStr = loc.searchStr ?? "";
  return {
    pathname: loc.pathname,
    search: searchStr && !searchStr.startsWith("?") ? `?${searchStr}` : searchStr,
    hash: loc.hash ? `#${loc.hash}` : "",
    state: loc.state as unknown,
    key: loc.pathname,
  };
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>() {
  return useTsParams({ strict: false }) as T;
}

type SetParams = (
  next: URLSearchParams | Record<string, string> | ((prev: URLSearchParams) => URLSearchParams | Record<string, string>),
  opts?: NavOpts,
) => void;

export function useSearchParams(): [URLSearchParams, SetParams] {
  const { pathname, search } = useLocation();
  const router = useRouter();
  const params = new URLSearchParams(search);
  const set: SetParams = (next, opts) => {
    const value = typeof next === "function" ? next(new URLSearchParams(search)) : next;
    const sp = value instanceof URLSearchParams ? value : new URLSearchParams(value);
    const qs = sp.toString();
    router.navigate({ href: qs ? `${pathname}?${qs}` : pathname, replace: opts?.replace });
  };
  return [params, set];
}

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to]);
  return null;
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
  replace?: boolean;
  state?: unknown;
  children?: ReactNode;
};

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(({ to, replace, state: _s, onClick, target, ...rest }, ref) => {
  const navigate = useNavigate();
  return (
    <a
      ref={ref}
      href={to}
      target={target}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to, { replace });
      }}
      {...rest}
    />
  );
});
Link.displayName = "Link";

export type NavLinkProps = Omit<LinkProps, "className" | "children"> & {
  className?: string | ((s: { isActive: boolean; isPending: boolean }) => string | undefined);
  children?: ReactNode | ((s: { isActive: boolean; isPending: boolean }) => ReactNode);
  end?: boolean;
};

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(({ className, children, end, to, ...rest }, ref) => {
  const { pathname } = useLocation();
  const isActive = end ? pathname === to : pathname === to || pathname.startsWith(to.endsWith("/") ? to : `${to}/`);
  const s = { isActive, isPending: false };
  return (
    <Link ref={ref} to={to} className={typeof className === "function" ? className(s) : className} {...rest}>
      {typeof children === "function" ? children(s) : children}
    </Link>
  );
});
NavLink.displayName = "NavLink";
