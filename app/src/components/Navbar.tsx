import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { getCategories, getPrograms } from "../services/programService";

function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [programsOpen, setProgramsOpen] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [activeCategoryIds, setActiveCategoryIds] = useState<Set<string>>(new Set());

  const userMenuRef = useRef<HTMLDivElement>(null);
  const programsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isLoggedIn } = useAuth();
  const { itemCount } = useCart();

  // Load categories + figure out which ones have at least 1 program
  useEffect(() => {
    const load = async () => {
      try {
        const [cats, programs] = await Promise.all([getCategories(), getPrograms()]);
        setCategories(cats ?? []);
        // Build a set of category IDs that have programs
        const ids = new Set<string>(
          (programs ?? []).map((p: any) =>
            typeof p.category === "object" ? p.category?._id : p.category
          ).filter(Boolean)
        );
        setActiveCategoryIds(ids);
      } catch {
        setCategories([]);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (programsRef.current && !programsRef.current.contains(e.target as Node)) {
        setProgramsOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleNav = (href: string) => {
    setOpen(false);
    if (href.startsWith("#")) {
      if (location.pathname !== "/") {
        navigate("/");
        setTimeout(() => { document.querySelector(href)?.scrollIntoView({ behavior: "smooth" }); }, 200);
      } else {
        document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      navigate(href);
    }
  };

  const handleProgramCategory = (cat: any) => {
    const hasPrograms = activeCategoryIds.has(cat._id);
    if (!hasPrograms) return; // Coming Soon — not clickable
    setProgramsOpen(false);
    setOpen(false);
    navigate(`/programs?category=${cat._id}`);
  };

  const links = [
    { label: "Home", href: "/" },
    { label: "Locations", href: "#locations" },
    { label: "Media", href: "/media" },
    { label: "About", href: "/about" },
    { label: "FAQ", href: "/faq" },
    { label: "Donate Now", href: "/donate" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 w-full z-50 transition-all duration-300 ${scrolled ? "bg-white shadow-lg shadow-black/5" : "bg-white/95 backdrop-blur-md"}`}
      style={{ borderBottom: scrolled ? "1px solid var(--pitch-deep)" : "1px solid transparent" }}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="h-20 flex items-center justify-between">

          {/* Logo */}
          <button onClick={() => handleNav("/")} className="flex items-center gap-3 group">
            <img src="/logo.svg" alt="CCA - California Cricket Academy" className="h-11 rounded-full object-cover" />
            {/* <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm text-white border-2 group-hover:scale-105 transition-transform" style={{ background: "var(--outfield)", borderColor: "var(--gold)" }}>CCA</div> */}
            <div className="text-left">
              <p className="font-display font-semibold text-[var(--outfield)] text-base leading-tight">California Cricket Academy</p>
              <p className="text-xs text-[var(--ink-400)] font-medium tracking-wide">501(c)(3) Nonprofit</p>
            </div>
          </button>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">

            {/* Home */}
            <button onClick={() => handleNav("/")} className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--ink-500)] hover:text-[var(--outfield)] hover:bg-[var(--pitch-soft)] transition-all">
              Home
            </button>

            {/* Training Programs Dropdown */}
            <div className="relative" ref={programsRef}>
              <button
                onClick={() => setProgramsOpen((v) => !v)}
                className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium text-[var(--ink-500)] hover:text-[var(--outfield)] hover:bg-[var(--pitch-soft)] transition-all"
              >
                Training Programs
                <svg className={`w-3.5 h-3.5 transition-transform ${programsOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <div
                className={`absolute left-0 mt-2 w-72 rounded-2xl bg-white shadow-xl overflow-hidden transition-all duration-150 origin-top-left ${
                  programsOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
                }`}
                style={{ border: "1px solid var(--pitch-deep)" }}
              >
                {/* All Programs option */}
                <button
                  onClick={() => { setProgramsOpen(false); setOpen(false); navigate("/programs"); }}
                  className="block w-full text-left px-5 py-3 text-sm font-medium text-[var(--ink-600)] hover:bg-[var(--pitch-soft)] hover:text-[var(--outfield)] transition"
                >
                  All Programs
                </button>

                {categories.map((cat, i) => {
                  const hasPrograms = activeCategoryIds.has(cat._id);
                  return (
                    <button
                      key={cat._id}
                      onClick={() => handleProgramCategory(cat)}
                      disabled={!hasPrograms}
                      className={`w-full text-left px-5 py-3 text-sm font-medium transition flex items-center justify-between gap-2 ${
                        hasPrograms
                          ? "text-[var(--ink-600)] hover:bg-[var(--pitch-soft)] hover:text-[var(--outfield)] cursor-pointer"
                          : "text-[var(--ink-400)] cursor-not-allowed"
                      }`}
                      style={{ borderTop: "1px solid var(--pitch-deep)" }}
                    >
                      <span>{cat.title}</span>
                      {!hasPrograms && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: "var(--pitch-soft)", color: "var(--ink-400)" }}>
                          Coming Soon
                        </span>
                      )}
                    </button>
                  );
                })}

                {categories.length === 0 && (
                  <p className="px-5 py-3 text-sm text-[var(--ink-400)]">Loading...</p>
                )}
              </div>
            </div>

            {/* Rest of nav links */}
            {links.slice(1).map((link) => (
              <button key={link.label} onClick={() => handleNav(link.href)} className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--ink-500)] hover:text-[var(--outfield)] hover:bg-[var(--pitch-soft)] transition-all">
                {link.label}
              </button>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Cart Icon */}
            <button
              onClick={() => navigate("/cart")}
              className="relative flex items-center justify-center w-10 h-10 rounded-full transition hover:bg-[var(--pitch-soft)]"
              style={{ border: "1px solid var(--pitch-deep)" }}
              aria-label="View cart"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5" style={{ color: "var(--outfield)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
              {itemCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1"
                  style={{ background: "var(--leather)" }}
                >
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </button>
            {isLoggedIn ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 text-sm font-medium text-[var(--ink-500)] hover:text-[var(--outfield)] px-4 py-2 transition rounded-full"
                  style={{ border: "1px solid var(--pitch-deep)" }}
                >
                  Hi, {user?.firstName}
                  <svg className={`w-3.5 h-3.5 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div
                  className={`absolute right-0 mt-2 w-48 rounded-2xl bg-white shadow-lg overflow-hidden transition-all duration-150 origin-top-right ${
                    userMenuOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
                  }`}
                  style={{ border: "1px solid var(--pitch-deep)" }}
                >
                  <button onClick={() => { navigate("/dashboard"); setUserMenuOpen(false); }} className="block w-full text-left px-4 py-3 text-sm font-medium text-[var(--ink-600)] hover:bg-[var(--pitch-soft)] hover:text-[var(--outfield)] transition">
                    My Dashboard
                  </button>
                  <button onClick={() => { logout(); setUserMenuOpen(false); }} className="block w-full text-left px-4 py-3 text-sm font-medium text-[var(--ink-600)] hover:bg-[var(--pitch-soft)] hover:text-[var(--outfield)] transition" style={{ borderTop: "1px solid var(--pitch-deep)" }}>
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => navigate("/login")} className="text-sm font-medium text-[var(--ink-500)] hover:text-[var(--outfield)] px-4 py-2 transition rounded-full" style={{ border: "1px solid var(--pitch-deep)" }}>
                Sign In / Register
              </button>
            )}
            <button onClick={() => handleNav("#programs")} className="text-sm font-semibold transition-all shadow-md hover:scale-105 px-6 py-2.5 rounded-full" style={{ background: "var(--gold)", color: "var(--outfield)" }}>
              Register Now
            </button>
          </div>

          {/* Mobile Toggle */}
          <button onClick={() => setOpen(!open)} className="lg:hidden p-2.5 rounded-xl transition" style={{ border: "1px solid var(--pitch-deep)" }} aria-label="Toggle menu">
            <div className="w-5 flex flex-col gap-1.5">
              <span className={`block h-0.5 rounded transition-all ${open ? "rotate-45 translate-y-2" : ""}`} style={{ background: "var(--outfield)" }} />
              <span className={`block h-0.5 rounded transition-all ${open ? "opacity-0" : ""}`} style={{ background: "var(--outfield)" }} />
              <span className={`block h-0.5 rounded transition-all ${open ? "-rotate-45 -translate-y-2" : ""}`} style={{ background: "var(--outfield)" }} />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`lg:hidden overflow-hidden transition-all duration-300 ${open ? "max-h-[800px]" : "max-h-0"}`} style={{ borderTop: open ? "1px solid var(--pitch-deep)" : "none" }}>
        <div className="bg-white px-6 py-5 space-y-1">
          <button onClick={() => handleNav("/")} className="block w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-[var(--ink-600)] hover:bg-[var(--pitch-soft)] hover:text-[var(--outfield)] transition">
            Home
          </button>

          {/* Mobile Programs */}
          <div>
            <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-widest text-[var(--ink-400)]">Training Programs</p>
            <button
              onClick={() => { setOpen(false); navigate("/programs"); }}
              className="block w-full text-left px-6 py-2.5 rounded-xl text-sm font-medium text-[var(--ink-600)] hover:bg-[var(--pitch-soft)] hover:text-[var(--outfield)] transition"
            >
              All Programs
            </button>
            {categories.map((cat) => {
              const hasPrograms = activeCategoryIds.has(cat._id);
              return (
                <button
                  key={cat._id}
                  onClick={() => handleProgramCategory(cat)}
                  disabled={!hasPrograms}
                  className={`w-full text-left px-6 py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-between gap-2 ${
                    hasPrograms
                      ? "text-[var(--ink-600)] hover:bg-[var(--pitch-soft)] hover:text-[var(--outfield)]"
                      : "text-[var(--ink-400)] cursor-not-allowed"
                  }`}
                >
                  <span>{cat.title}</span>
                  {!hasPrograms && (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: "var(--pitch-soft)", color: "var(--ink-400)" }}>
                      Coming Soon
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {links.slice(1).map((link) => (
            <button key={link.label} onClick={() => handleNav(link.href)} className="block w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-[var(--ink-600)] hover:bg-[var(--pitch-soft)] hover:text-[var(--outfield)] transition">
              {link.label}
            </button>
          ))}

          <div className="pt-3 mt-3 space-y-2" style={{ borderTop: "1px solid var(--pitch-deep)" }}>
            {/* Cart */}
            <button
              onClick={() => { navigate("/cart"); setOpen(false); }}
              className="w-full py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition"
              style={{ border: "1px solid var(--pitch-deep)", color: "var(--outfield)" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
              Cart {itemCount > 0 ? `(${itemCount})` : ""}
            </button>
            {isLoggedIn ? (
              <>
                <p className="text-sm text-[var(--ink-500)] px-4">Signed in as {user?.firstName} {user?.lastName}</p>
                <button onClick={() => { navigate("/dashboard"); setOpen(false); }} className="w-full py-3 rounded-full text-sm font-semibold text-white" style={{ background: "var(--outfield)" }}>My Dashboard</button>
                <button onClick={() => { logout(); setOpen(false); }} className="w-full py-3 rounded-full text-sm font-semibold text-[var(--ink-600)]" style={{ border: "1px solid var(--pitch-deep)" }}>Sign Out</button>
              </>
            ) : (
              <button onClick={() => { navigate("/login"); setOpen(false); }} className="w-full py-3 rounded-full text-sm font-semibold text-[var(--ink-600)]" style={{ border: "1px solid var(--pitch-deep)" }}>Sign In / Register</button>
            )}
            <button onClick={() => { handleNav("#programs"); }} className="w-full py-3 rounded-full text-sm font-semibold" style={{ background: "var(--gold)", color: "var(--outfield)" }}>Register Now</button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;