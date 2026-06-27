interface ProgramBannerProps {
  title: string;
  category: string;
  description: string;
  location: string;
  level: string;
  image: string;
}

function ProgramBanner({
  title,
  category,
  description,
  location,
  level,
  image,
}: ProgramBannerProps) {
  return (
    <section className="bg-white rounded-[32px] shadow-[0_28px_60px_-28px_rgba(15,23,42,0.35)] overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#F97316]/10 px-4 py-2 text-sm font-semibold text-[#F97316]">
              {category}
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold text-[#0F172A] leading-tight">
              {title}
            </h1>

            <p className="text-gray-600 max-w-2xl leading-7">
              {description}
            </p>

            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-[#0F172A]">
                {location}
              </span>
              <span className="inline-flex items-center rounded-full bg-[#F97316]/10 px-4 py-2 text-sm font-semibold text-[#F97316]">
                {level}
              </span>
            </div>
          </div>

          <div className="relative rounded-[28px] overflow-hidden bg-slate-100 shadow-inner">
            <img
              src={image}
              alt={title}
              className="h-full w-full min-h-[260px] object-cover transition duration-500 ease-out hover:scale-105"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default ProgramBanner;
