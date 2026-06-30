import { useNavigate } from "react-router-dom";

function Footer() {
  const navigate = useNavigate();
  const year = new Date().getFullYear();

  const links = {
    Programs: [
      { label: "Beginner", href: "/programs" },
      { label: "Intermediate", href: "/programs" },
      { label: "Advanced", href: "/programs" },
      { label: "Summer Camp", href: "/programs" },
    ],
    Locations: [
      { label: "Fremont", href: "#locations" },
      { label: "San Jose", href: "#locations" },
      { label: "Dublin", href: "#locations" },
      { label: "Sunnyvale", href: "#locations" },
    ],
    Company: [
      { label: "About CCA", href: "/about" },
      { label: "Media", href: "/media" },
      { label: "FAQ", href: "/faq" },
      { label: "Donate Now", href: "/donate" },
    ],
  };

  return (
    <footer style={{ background: "var(--outfield)" }} className="text-white">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-5 gap-10">

          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-display font-semibold text-sm text-white" style={{ background: "var(--gold)", color: "var(--outfield)" }}>
                CCA
              </div>
              <div>
                <p className="font-display font-semibold text-white text-base">California Cricket Academy</p>
                <p className="text-xs text-white/50">Youth Training Programs</p>
              </div>
            </div>
            <p className="text-white/50 text-sm leading-6 mt-4 max-w-xs">
              California's premier youth cricket development program — building champions since 2004.
            </p>
            {/* <div className="flex gap-3 mt-6">
              {["📘", "📸", "🐦", "▶️"].map((icon, i) => (
                <button key={i} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 transition flex items-center justify-center text-sm">
                  {icon}
                </button>
              ))}
            </div> */}
          </div>

          {/* Links */}
          {Object.entries(links).map(([heading, items]) => (
            <div key={heading}>
              <h4 className="font-semibold text-white text-sm mb-4">{heading}</h4>
              <ul className="space-y-2.5">
                {items.map((item) => (
                  <li key={item.label}>
                    <button
                      onClick={() => {
                        if (item.href.startsWith("#")) {
                          if (window.location.pathname !== "/") {
                            navigate("/");
                            setTimeout(() => document.querySelector(item.href)?.scrollIntoView({ behavior: "smooth" }), 200);
                          } else {
                            document.querySelector(item.href)?.scrollIntoView({ behavior: "smooth" });
                          }
                        } else {
                          navigate(item.href);
                        }
                      }}
                      className="text-sm text-white/50 hover:text-white transition"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/40">© {year} California Cricket Academy. All rights reserved.</p>
          <div className="flex items-center gap-6 text-xs text-white/40">
            <span>hello@calcricket.org</span>
            <span>·</span>
            <span>(408) 555-0100</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
