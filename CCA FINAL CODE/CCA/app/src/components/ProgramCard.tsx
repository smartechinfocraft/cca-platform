import { Link } from "react-router-dom";
import {
  HiOutlineLocationMarker,
  HiOutlineCurrencyDollar,
  HiOutlineUserGroup,
  HiOutlineSparkles,
} from "react-icons/hi";

type ProgramCardProps = {
  program: {
    _id: string;
    title: string;
    shortDescription?: string;
    basePrice?: number;
    discountedPrice?: number;
    location?: { title?: string } | null;
    ageGroups?: string[];
    skillLevels?: string[];
  };
};

function ProgramCard({ program }: ProgramCardProps) {
  const price = program.discountedPrice ?? program.basePrice;

  return (
    <div className="group bg-white border border-slate-200 rounded-[24px] shadow-sm overflow-hidden transition duration-300 ease-out hover:-translate-y-1 hover:shadow-xl">
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="md:w-[25%] flex-none p-5 flex flex-col justify-between">
          <div className="relative rounded-[24px] bg-slate-100 aspect-[4/5] flex items-center justify-center text-slate-500 text-sm font-semibold">
            Program Image
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <span className="inline-flex items-center justify-center rounded-full bg-[#F97316]/10 text-[#F97316] text-xs font-semibold uppercase tracking-[0.2em] px-3 py-2">
              <HiOutlineCurrencyDollar className="mr-2 h-4 w-4" />
              Price badge
            </span>
            <span className="inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-700 text-xs font-medium px-3 py-2">
              <HiOutlineLocationMarker className="mr-2 h-4 w-4 text-[#F97316]" />
              {program.location?.title ?? "Location"}
            </span>
          </div>
        </div>

        <div className="md:w-[55%] flex-1 p-5 border-t border-slate-200/70 md:border-t-0 md:border-l md:border-r md:border-slate-200/70">
          <h3 className="text-2xl font-semibold text-[#0F172A] leading-tight">
            {program.title}
          </h3>

          <p className="mt-4 text-sm leading-6 text-slate-600">
            {program.shortDescription}
          </p>

          <div className="mt-5 space-y-3 text-sm text-slate-700">
            <div className="inline-flex items-center gap-2 text-slate-900 font-medium">
              <HiOutlineLocationMarker className="h-5 w-5 text-[#F97316]" />
              {program.location?.title ?? "Location details"}
            </div>

            <div>
              <div className="mb-2 inline-flex items-center gap-2 text-slate-900 font-medium">
                <HiOutlineUserGroup className="h-5 w-5 text-[#F97316]" />
                Age groups
              </div>
              <div className="flex flex-wrap gap-2">
                {program.ageGroups?.map((ageGroup) => (
                  <span key={ageGroup} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                    {ageGroup}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 inline-flex items-center gap-2 text-slate-900 font-medium">
                <HiOutlineSparkles className="h-5 w-5 text-[#F97316]" />
                Skill levels
              </div>
              <div className="flex flex-wrap gap-2">
                {program.skillLevels?.map((skillLevel) => (
                  <span key={skillLevel} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                    {skillLevel}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="md:w-[20%] flex-none p-5 flex flex-col justify-between gap-6">
          <div className="rounded-[20px] bg-[#F97316]/5 p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.24em] text-[#F97316]">
              <HiOutlineCurrencyDollar className="h-4 w-4" />
              Price
            </div>
            <div className="mt-3 text-3xl font-semibold text-[#0F172A]">
              {price ? `$${price}` : "N/A"}
            </div>
          </div>

          <Link to={`/programs/${program._id}`} className="inline-flex items-center justify-center rounded-2xl bg-[#F97316] px-4 py-3 text-sm font-semibold text-white transition duration-300 hover:bg-[#ea7a2e]">
            View Details
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ProgramCard;
