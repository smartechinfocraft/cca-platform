import { useEffect, useState } from "react";
import { getFAQs } from "../services/programService";

const FALLBACK = [
  { _id: "1", question: "What age groups do you train?", answer: "We train youth players from ages 5 to 16 across five age groups: U8, U10, U12, U14, and U16. Each group has a tailored curriculum matching their physical and cognitive development stage." },
  { _id: "2", question: "How do I register my child?", answer: "Browse our programs page, select the right program for your child's age and skill level, and follow the online registration steps. You can also contact us directly for guidance." },
  { _id: "3", question: "Where are your training locations?", answer: "We operate across the Bay Area in Fremont, San Jose, Dublin, Sunnyvale, Cupertino, and Milpitas — with more locations being added. Click the Locations section above to find one near you." },
  { _id: "4", question: "What programs are available?", answer: "We offer Beginner, Intermediate, Advanced, and Summer Camp programs. Each is designed for a different skill level and runs across multiple age groups." },
  { _id: "5", question: "Are your coaches qualified?", answer: "Yes — all CCA coaches hold ICC Level 1 or higher coaching certification and many have professional playing experience. Player safety and development are our top priorities." },
  { _id: "6", question: "Can my child try before committing?", answer: "Yes! We offer a free trial session for new players so they can experience the program before enrolling. Contact us to book yours." },
];

function FAQ() {
  const [faqs, setFaqs] = useState<{ _id: string; question: string; answer: string }[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFAQs()
      .then((data) => setFaqs(data ?? []))
      .catch(() => setFaqs([]))
      .finally(() => setLoading(false));
  }, []);

  const display = faqs.length > 0 ? faqs : FALLBACK;

  return (
    <section id="faq" className="py-24 bg-[#FFFBF5]">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-14">
          <span className="text-[#F97316] text-xs font-bold tracking-widest uppercase block mb-3">FAQs</span>
          <h2 className="font-display text-4xl lg:text-5xl font-bold text-[#0F172A]">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-500 mt-4 max-w-md mx-auto">
            Everything parents ask us most. Can't find your answer?{" "}
            <a href="mailto:hello@californiacricketacademy.org" className="text-[#F97316] font-semibold hover:underline">
              Email us
            </a>
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1,2,3,4].map(i => <div key={i} className="bg-white rounded-2xl h-16 animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {display.map((faq) => (
              <div
                key={faq._id}
                className={`faq-item ${open === faq._id ? "open" : ""}`}
              >
                <button
                  onClick={() => setOpen(open === faq._id ? null : faq._id)}
                  className="w-full text-left px-7 py-5 flex items-center justify-between gap-4 font-semibold text-[#0F172A] text-sm"
                >
                  <span>{faq.question}</span>
                  <span className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center transition-all text-sm font-bold ${
                    open === faq._id
                      ? "bg-[#F97316] text-white rotate-45"
                      : "bg-slate-100 text-slate-500"
                  }`}>
                    +
                  </span>
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    open === faq._id ? "max-h-[200px]" : "max-h-0"
                  }`}
                >
                  <div className="px-7 pb-6 text-slate-500 text-sm leading-7 border-t border-slate-100 pt-4">
                    {faq.answer}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default FAQ;
