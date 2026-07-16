import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  HiOutlineCalendar,
  HiOutlineLocationMarker,
  HiOutlineCurrencyDollar,
  HiOutlineUserGroup,
  HiOutlineSparkles,
  HiOutlineLightningBolt,
  HiOutlineX,
  HiOutlineClock,
} from "react-icons/hi";
import { HiOutlineArrowRight, HiOutlinePlusCircle, HiOutlineTrash } from "react-icons/hi2";
import { useRegistration } from "../context/RegistrationContext";
import { getProgramById } from "../services/programService";
import GenderSelect from "./registration/GenderSelect";
import WeeklyBatchSelector from "./registration/WeeklyBatchSelector";
import SavedStudentPicker from "./registration/SavedStudentPicker";
import { calcWeeklyPrice, toWeeklyBatchSnapshots, formatWeekRangeLabel, fmt12, type WeeklyBatchRaw } from "../utils/weeklyBatch";

type ProgramCardProps = {
  program: {
    _id: string;
    title: string;
    shortDescription?: string;
    category?: string | { title?: string } | null;
    startDate?: string;
    endDate?: string;
    basePrice?: number;
    discountedPrice?: number;
    location?: { title?: string } | null;
    city?: { title?: string } | null;
    ageGroups?: string[];
    skillLevels?: string[];
    scheduleDays?: ProgramScheduleDay[];
    weeklyBatches?: WeeklyBatchRaw[];
    batches?: ProgramBatchSummary[];
  };
};

type ProgramScheduleDay = {
  day?: string;
  startTime?: string;
  endTime?: string;
  groundAddress?: string;
};

type ProgramBatchSummary = {
  _id?: string;
  name?: string;
  title?: string;
  days?: string;
  dayOfWeek?: string;
  multiDays?: string[];
  timing?: string;
  timeSlots?: TimeSlot[];
  location?: { title?: string; city?: string; address?: string };
  groundLocationNote?: string;
};

function formatProgramDate(date?: string): string {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
   
  });
}

function formatProgramDateRange(startDate?: string, endDate?: string): string {
  const start = formatProgramDate(startDate);
  const end = formatProgramDate(endDate);
  if (start && end) return `${start} - ${end}`;
  return start || end || "Dates not available";
}

function ProgramCard({ program }: ProgramCardProps) {
  const navigate = useNavigate();
  const [quickOpen, setQuickOpen] = useState(false);
  const [programDetails, setProgramDetails] = useState<any | null>(null);
  const price = program.discountedPrice ?? program.basePrice;
  const programWithDetails = programDetails ?? program;
  const availableDays = buildProgramAvailableDayOptions(programWithDetails);
  const availableBatchCount = Array.isArray(programWithDetails.batches) && programWithDetails.batches.length > 0
    ? programWithDetails.batches.length
    : Array.isArray(programWithDetails.scheduleDays) && programWithDetails.scheduleDays.length > 0
      ? 1
      : Array.isArray(programWithDetails.weeklyBatches)
        ? programWithDetails.weeklyBatches.length
        : 0;

  useEffect(() => {
    const hasScheduleSource =
      (Array.isArray(program.scheduleDays) && program.scheduleDays.length > 0) ||
      (Array.isArray(program.batches) && program.batches.length > 0) ||
      (Array.isArray(program.weeklyBatches) && program.weeklyBatches.length > 0);
    if (hasScheduleSource || programDetails) return;

    let cancelled = false;
    getProgramById(program._id)
      .then((data) => {
        if (!cancelled) setProgramDetails(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [program._id, program.scheduleDays, program.batches, program.weeklyBatches, programDetails]);

  const backgroundVariants = [
    {
      card: "bg-gradient-to-br from-[#F8FAFC] via-[#E2E8F0] to-[#FCE7F3]",
      overlay:
        "bg-[radial-gradient(circle_at_top_left,_rgba(163,59,43,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.15),_transparent_35%)]",
    },
    {
      card: "bg-gradient-to-br from-[#FEF3C7] via-[#FDE68A] to-[#F59E0B]",
      overlay:
        "bg-[radial-gradient(circle_at_top_left,_rgba(217,119,6,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(234,88,12,0.15),_transparent_35%)]",
    },
    {
      card: "bg-gradient-to-br from-[#D1FAE5] via-[#6EE7B7] to-[#10B981]",
      overlay:
        "bg-[radial-gradient(circle_at_top_left,_rgba(5,150,105,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.15),_transparent_35%)]",
    },
    {
      card: "bg-gradient-to-br from-[#EDE9FE] via-[#C4B5FD] to-[#A78BFA]",
      overlay:
        "bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.15),_transparent_35%)]",
    },
    {
      card: "bg-gradient-to-br from-[#FCE7F3] via-[#FBCFE8] to-[#F472B6]",
      overlay:
        "bg-[radial-gradient(circle_at_top_left,_rgba(236,72,153,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(219,39,119,0.15),_transparent_35%)]",
    },
    {
      card: "bg-gradient-to-br from-[#E0F2FE] via-[#BAE6FD] to-[#38BDF8]",
      overlay:
        "bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.15),_transparent_35%)]",
    },
    {
      card: "bg-gradient-to-br from-[#EEF2FF] via-[#C7D2FE] to-[#6366F1]",
      overlay:
        "bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(79,70,229,0.15),_transparent_35%)]",
    },
    {
      card: "bg-gradient-to-br from-[#ECFCCB] via-[#BBF7D0] to-[#22C55E]",
      overlay:
        "bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.15),_transparent_35%)]",
    },
    {
      card: "bg-gradient-to-br from-[#FCE7F3] via-[#FBCFE8] to-[#F472B6]",
      overlay:
        "bg-[radial-gradient(circle_at_top_left,_rgba(236,72,153,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(219,39,119,0.15),_transparent_35%)]",
    },
    {
      card: "bg-gradient-to-br from-[#FFEDD5] via-[#FDBA74] to-[#F97316]",
      overlay:
        "bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(251,191,36,0.15),_transparent_35%)]",
    },
  ];

  const variantIndex =
    program._id
      .split("")
      .reduce((sum, char) => sum + char.charCodeAt(0), 0) % backgroundVariants.length;
  const selectedBackground = backgroundVariants[variantIndex];

  return (
    <div className="group bg-white border border-slate-200 rounded-[24px] shadow-sm overflow-hidden transition duration-300 ease-out hover:-translate-y-1 hover:shadow-xl">
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="md:w-[25%] flex-none p-5 flex flex-col justify-between">
          <div className={`relative rounded-[24px] ${selectedBackground.card} aspect-[1/0.5] flex items-center justify-center text-slate-900 text-sm font-semibold overflow-hidden`}>
            <div className={`absolute inset-0 ${selectedBackground.overlay}`} />
            <div className="relative z-10 flex flex-col items-center gap-3">
              <div className="inline-flex items-center justify-center ">
                <span className="text-3xl">
                  <svg width="64" height="72" viewBox="0 0 64 72" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_5_23)">
<path fill-rule="evenodd" clip-rule="evenodd" d="M2.51771 3.87145H6.31542C6.61427 3.87145 6.85956 4.11465 6.85956 4.41267V40.0725L6.7637 40.1667C5.04247 41.8831 4.19947 43.9046 4.0289 46.0216C3.8541 48.1949 4.43489 50.4006 5.51189 52.3996C5.84881 53.0251 6.24916 53.6451 6.69744 54.2453L6.85956 54.459V69.7508H14.6143V59.777C15.6264 60.03 16.6569 60.1354 17.6818 60.0665C18.2978 60.0258 18.9054 59.9246 19.4974 59.7587V69.7508H27.2522V53.5551L32.1353 48.6841V69.7508H33.8185C33.9792 69.7508 34.1117 69.8815 34.1117 70.0418V71.7076C34.1117 71.8693 33.9792 72 33.8185 72H0.293216C0.131101 72 0 71.8693 0 71.7076V70.0418C0 69.8815 0.131101 69.7508 0.293216 69.7508H1.97498V4.41126C1.97498 4.11465 2.21885 3.87145 2.51771 3.87145ZM44.2206 14.222C44.738 16.7552 47.2275 19.1323 49.6705 19.6539C50.0102 20.2879 50.5529 20.9261 51.2648 21.636C51.3988 21.7681 51.4664 21.9481 51.4664 22.128C51.4664 22.2967 51.4072 22.464 51.2916 22.5947L19.7737 54.0232C18.2315 55.5597 16.0338 55.3727 14.0363 54.279C13.1933 53.818 12.3856 53.198 11.6722 52.4769C10.9575 51.7543 10.3359 50.9305 9.86784 50.0632C8.69498 47.8843 8.50044 45.4256 10.2696 43.6614L41.3166 12.701C41.4506 12.5661 41.631 12.5 41.81 12.5C41.9905 12.5 42.1695 12.5661 42.3034 12.701C42.9829 13.3786 43.6046 13.8917 44.2206 14.222ZM49.5831 38.1944C52.0599 38.1944 54.3055 39.1967 55.9295 40.8175C57.5549 42.4356 58.5614 44.6749 58.5614 47.1476C58.5614 49.619 57.5549 51.8583 55.9309 53.4778L55.9013 53.5045C54.2774 55.1084 52.0444 56.0995 49.5831 56.0995C48.6048 56.0995 47.6645 55.9435 46.7834 55.6553C46.7454 55.6468 46.7101 55.6342 46.6749 55.6187C45.3799 55.1756 44.2038 54.4428 43.2366 53.4764C41.6113 51.8583 40.6048 49.619 40.6048 47.1476C40.6048 44.6777 41.6099 42.4398 43.2352 40.8189L43.2381 40.8147C44.8634 39.1953 47.1077 38.1944 49.5831 38.1944ZM47.0865 39.5959C47.0781 39.6325 47.0668 39.669 47.0513 39.7028L46.8426 40.1624C46.7875 40.2834 46.6865 40.3777 46.5618 40.4246C46.4371 40.4715 46.2988 40.4672 46.1773 40.4127C46.1107 40.383 46.0515 40.3392 46.0038 40.2844C45.9561 40.2295 45.921 40.1648 45.901 40.095C45.1805 40.4696 44.5217 40.9517 43.9471 41.5246C42.5036 42.9641 41.6127 44.9505 41.6127 47.1476C41.6127 49.342 42.505 51.3284 43.9471 52.7665C44.0092 52.8283 44.0712 52.8888 44.1346 52.9478C44.1727 52.9281 44.2122 52.9126 44.2544 52.9028C44.5237 52.8367 44.7972 53.0012 44.862 53.2697C44.8803 53.3386 44.9029 53.4117 44.9297 53.4834C44.9508 53.5382 44.9734 53.5944 44.9988 53.6507C45.2666 53.8376 45.5443 54.0091 45.8333 54.1624C44.9565 51.9567 44.6999 48.9414 45.1411 46.061C45.5302 43.532 46.4592 41.0874 47.9831 39.3584C47.6772 39.4202 47.3769 39.5003 47.0865 39.5959ZM43.1676 50.3851C43.1676 50.1082 43.3931 49.8832 43.6708 49.8832C43.9485 49.8832 44.1755 50.1082 44.1755 50.3851C44.1755 50.5172 44.1868 50.6719 44.2051 50.8195C44.2248 50.9713 44.2544 51.1231 44.2869 51.2468C44.3574 51.5139 44.1966 51.7895 43.9288 51.8583C43.661 51.9286 43.3861 51.7698 43.3156 51.5027C43.2733 51.341 43.2366 51.1456 43.2099 50.9502C43.1831 50.7436 43.1676 50.5411 43.1676 50.3851ZM42.99 47.381C43.0139 47.1055 43.2592 46.903 43.5341 46.9283C43.8104 46.9522 44.0134 47.1968 43.988 47.471C43.9838 47.5328 43.988 47.6861 43.9993 47.8618C44.012 48.0726 44.0345 48.3032 44.0557 48.4592C44.0644 48.5244 44.0602 48.5906 44.0432 48.6542C44.0262 48.7177 43.9969 48.7773 43.9568 48.8295C43.9168 48.8817 43.8668 48.9256 43.8097 48.9585C43.7527 48.9915 43.6897 49.0129 43.6243 49.0215C43.4925 49.0391 43.3592 49.0038 43.2534 48.9235C43.1477 48.8431 43.0783 48.7241 43.0604 48.5928C43.0351 48.4114 43.0111 48.1542 42.9956 47.9236C42.9843 47.7085 42.9787 47.5047 42.99 47.381ZM43.5031 44.218C43.5778 43.9524 43.8555 43.7963 44.1233 43.8708C44.3898 43.9453 44.5463 44.2223 44.4701 44.4894C44.4504 44.5625 44.4194 44.7058 44.3898 44.8661L44.2897 45.4495C44.2488 45.7236 43.9937 45.9134 43.7188 45.874C43.4439 45.8333 43.2536 45.5788 43.293 45.3047L43.4016 44.6791C43.4382 44.4908 43.4763 44.315 43.5031 44.218ZM44.6351 41.4037C44.6902 41.2827 44.7912 41.1885 44.9159 41.1416C45.0406 41.0947 45.1789 41.099 45.3004 41.1535C45.4219 41.2084 45.5165 41.3091 45.5635 41.4335C45.6106 41.5579 45.6062 41.6958 45.5514 41.817L45.1693 42.6577C45.1142 42.7787 45.0132 42.8729 44.8885 42.9198C44.7638 42.9667 44.6255 42.9624 44.504 42.9079C44.2516 42.794 44.1389 42.4974 44.2516 42.2458L44.6351 41.4037ZM48.3989 55.0086C48.437 54.802 48.6033 54.6333 48.8218 54.6038C48.954 54.5851 49.0882 54.6194 49.195 54.6993C49.3017 54.7791 49.3724 54.898 49.3914 55.0297L49.404 55.093L49.5831 55.0958C51.7723 55.0958 53.7558 54.2158 55.1951 52.7932L55.219 52.7665C56.6611 51.3284 57.5535 49.342 57.5535 47.1476C57.5535 44.9533 56.6611 42.9655 55.219 41.526C54.1799 40.4874 52.872 39.7569 51.4411 39.416L51.3692 39.5397C51.3364 39.5967 51.2926 39.6467 51.2404 39.6868C51.1882 39.7269 51.1286 39.7564 51.0649 39.7735C51.0013 39.7906 50.9349 39.795 50.8695 39.7865C50.8042 39.778 50.7411 39.7567 50.6841 39.7238C50.6007 39.6763 50.5329 39.6058 50.4886 39.5207C50.4444 39.4357 50.4256 39.3398 50.4345 39.2445C50.1568 39.215 49.8763 39.1981 49.5901 39.1981C47.6941 40.7262 46.5692 43.4013 46.1378 46.2114C45.65 49.3884 46.0476 52.7088 47.2176 54.7401C47.5996 54.8582 47.9944 54.9482 48.3989 55.0086ZM47.133 52.5429C47.0922 52.2688 47.2811 52.0116 47.5559 51.9708C47.6881 51.9512 47.8226 51.9846 47.9301 52.0636C48.0376 52.1426 48.1093 52.2609 48.1297 52.3925C48.1452 52.4994 48.1762 52.6203 48.2143 52.7426C48.2608 52.8873 48.3158 53.0279 48.3722 53.1502C48.4878 53.4004 48.3778 53.6985 48.1255 53.8151C47.8745 53.9304 47.5757 53.8208 47.4601 53.5691C47.3826 53.4033 47.3107 53.2205 47.2543 53.0448C47.2007 52.8761 47.1584 52.7032 47.133 52.5429ZM46.7228 49.3631C46.7357 49.2311 46.8004 49.1095 46.9029 49.0249C47.0054 48.9404 47.1373 48.8997 47.2698 48.9119C47.5461 48.9372 47.7477 49.1832 47.7223 49.4573C47.711 49.5796 47.7068 49.7356 47.7124 49.8945C47.7166 50.0449 47.7307 50.1981 47.7519 50.3247C47.797 50.5974 47.6123 50.856 47.3389 50.901C47.0654 50.9474 46.806 50.7618 46.7609 50.4891C46.7327 50.3275 46.7158 50.1278 46.7087 49.9296C46.7031 49.7286 46.7073 49.5276 46.7228 49.3631ZM46.8356 46.3534C46.8863 46.0807 47.15 45.9036 47.4234 45.9542C47.6955 46.0062 47.8745 46.269 47.8224 46.5418C47.8097 46.6092 47.7984 46.7597 47.7928 46.9283C47.7857 47.1392 47.7857 47.3712 47.7914 47.53C47.8012 47.8055 47.5841 48.0389 47.3078 48.0473C47.242 48.0497 47.1764 48.0391 47.1147 48.0161C47.053 47.9931 46.9964 47.9583 46.9482 47.9135C46.9 47.8687 46.8612 47.8149 46.8339 47.7551C46.8066 47.6953 46.7913 47.6308 46.7891 47.5652C46.782 47.3866 46.782 47.128 46.7905 46.8946C46.7975 46.6739 46.813 46.4673 46.8356 46.3534ZM47.6532 43.2551C47.7018 43.1313 47.7976 43.0317 47.9197 42.9782C48.0418 42.9247 48.1802 42.9217 48.3045 42.9697C48.5625 43.071 48.6907 43.3619 48.5907 43.6192C48.5625 43.6909 48.5188 43.8301 48.4722 43.9847L48.3158 44.5582C48.2495 44.8267 47.976 44.9898 47.7068 44.9237C47.5773 44.8914 47.466 44.8091 47.3973 44.695C47.3286 44.5809 47.3081 44.4442 47.3403 44.315L47.5094 43.7021C47.563 43.518 47.6166 43.3479 47.6532 43.2551ZM49.0544 40.5645C49.0872 40.5075 49.131 40.4574 49.1832 40.4173C49.2354 40.3772 49.295 40.3477 49.3587 40.3306C49.4223 40.3135 49.4887 40.3091 49.5541 40.3176C49.6194 40.3261 49.6825 40.3475 49.7396 40.3803C49.7966 40.413 49.8466 40.4565 49.8868 40.5085C49.927 40.5604 49.9565 40.6197 49.9736 40.6831C49.9908 40.7464 49.9952 40.8125 49.9868 40.8775C49.9783 40.9425 49.957 41.0053 49.9242 41.0621L49.4618 41.8634C49.3954 41.9783 49.2859 42.0622 49.1575 42.0967C49.029 42.1312 48.8921 42.1136 48.7767 42.0476C48.7196 42.0149 48.6694 41.9712 48.6292 41.9192C48.589 41.8671 48.5594 41.8076 48.5423 41.7442C48.5251 41.6807 48.5207 41.6145 48.5292 41.5493C48.5378 41.4842 48.5591 41.4213 48.5921 41.3644L49.0544 40.5645ZM40.7683 27.5641C40.9065 27.427 41.0935 27.35 41.2885 27.35C41.4834 27.35 41.6704 27.427 41.8086 27.5641C42.0962 27.8508 42.0962 28.3161 41.8086 28.6015L20.566 49.7848C20.2784 50.0716 19.8118 50.0716 19.5256 49.7848C19.2381 49.4995 19.2381 49.0342 19.5256 48.7474L40.7683 27.5641ZM59.9838 0.285368L63.7138 4.005C63.8967 4.18736 63.9996 4.43455 64 4.69241C64 4.90187 63.9309 5.11414 63.79 5.29267L63.7152 5.37983L60.1163 8.96872C60.0257 9.05939 59.9181 9.13129 59.7995 9.18027C59.681 9.22925 59.5539 9.25434 59.4255 9.25409C59.2733 9.25409 59.1182 9.21614 58.9773 9.14304C58.3344 9.77141 57.6028 10.4659 56.8571 11.1758C54.9343 13.0018 52.9015 14.9333 51.4326 16.6807C50.8377 17.3878 50.6418 17.9473 50.7672 18.4716C50.9124 19.0775 51.4566 19.7537 52.3038 20.5985C52.7267 21.0231 52.9381 21.5769 52.9381 22.128C52.9381 22.6594 52.7422 23.1922 52.3503 23.6083L20.8141 55.0606C18.7263 57.1412 15.8745 56.9556 13.33 55.5625C12.3644 55.0339 11.4411 54.3254 10.6263 53.5031C9.81568 52.6821 9.10943 51.7445 8.57515 50.7562C7.1133 48.0417 6.91595 44.9308 9.22925 42.6239L40.2763 11.6636C40.6992 11.2418 41.256 11.0324 41.81 11.0324C42.3655 11.0324 42.9223 11.2418 43.3438 11.6636C44.1713 12.4873 44.8479 13.0046 45.4611 13.1466C45.9982 13.2689 46.5607 13.0834 47.2458 12.5337C48.9699 11.1533 51.0125 9.00808 52.8916 7.033C53.5753 6.31325 54.2407 5.61459 54.8314 5.01011C54.7581 4.86954 54.72 4.71491 54.72 4.56168C54.72 4.34941 54.7905 4.13714 54.9315 3.96001L55.0048 3.87426L58.6051 0.285368C58.7883 0.103505 59.036 0.000971629 59.2944 0C59.5073 0 59.7202 0.0716935 59.8964 0.210863L59.9838 0.285368ZM7.57286 1.31298H13.6388C13.9827 1.31298 14.2647 1.59413 14.2647 1.93713V1.95962H16.3905C16.4962 1.95962 16.5878 2.04819 16.5878 2.15784V3.09829C16.5878 3.20653 16.499 3.29509 16.3905 3.29509H14.2647V3.31899C14.2647 3.66199 13.9827 3.94315 13.6388 3.94315H7.57286C7.2289 3.94315 6.94696 3.66199 6.94696 3.31899V3.29509H4.72247C4.61392 3.29509 4.5237 3.20653 4.5237 3.09829V2.15784C4.5237 2.04819 4.61251 1.95962 4.72247 1.95962H6.94696V1.93713C6.94696 1.59413 7.2289 1.31298 7.57286 1.31298ZM17.4844 1.95962H19.6088V1.93713C19.6088 1.59413 19.8907 1.31298 20.2347 1.31298H26.3006C26.646 1.31298 26.9265 1.59413 26.9265 1.93713V1.95962H29.1524C29.2581 1.95962 29.3498 2.04819 29.3498 2.15784V3.09829C29.3498 3.20653 29.261 3.29509 29.1524 3.29509H26.9265V3.31899C26.9261 3.48441 26.8601 3.64295 26.7428 3.75992C26.6255 3.8769 26.4665 3.94277 26.3006 3.94315H20.2347C19.8907 3.94315 19.6088 3.66199 19.6088 3.31899V3.29509H17.4844C17.3759 3.29509 17.2856 3.20653 17.2856 3.09829V2.15784C17.2856 2.04819 17.3744 1.95962 17.4844 1.95962ZM27.7949 3.87145H31.5926C31.8915 3.87145 32.1353 4.11465 32.1353 4.41267V15.0303C31.8217 15.2339 31.5302 15.4695 31.2655 15.7332L27.2522 19.7354V4.41126C27.2522 4.11465 27.496 3.87145 27.7949 3.87145ZM15.1556 3.87145H18.9533C19.0974 3.87145 19.2356 3.92843 19.3376 4.02988C19.4396 4.13134 19.4971 4.269 19.4974 4.41267V27.4685L14.6143 32.3394V4.41126C14.6143 4.11465 14.8581 3.87145 15.1556 3.87145Z" fill="white"/>
</g>
<defs>
<clipPath id="clip0_5_23">
<rect width="64" height="72" fill="white"/>
</clipPath>
</defs>
</svg>

</span>
              </div>
              {/* <div className="text-center">
                <div className="text-xs uppercase tracking-[0.24em] text-[#A33B2B]">Cricket Coaching</div>
                <div className="mt-1 text-sm text-slate-600">Batting, bowling & fielding drills</div>
              </div> */}
            </div>
            {/* <svg className="absolute -bottom-6 right-0 h-32 w-32 text-[#A33B2B]/20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 12v56" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <path d="M34 12v56" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <path d="M48 12v56" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <path d="M14 18h42" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <path d="M16 70c9-18 32-24 38-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg> */}
          </div>

          {/* <div className="mt-4 flex flex-col gap-3">
            <span className="inline-flex items-center justify-center rounded-full bg-[#A33B2B]/10 text-[#A33B2B] text-xs font-semibold uppercase tracking-[0.2em] px-3 py-2">
              <HiOutlineCurrencyDollar className="mr-2 h-4 w-4" />
              Price badge
            </span>
            <span className="inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-700 text-xs font-medium px-3 py-2">
              <HiOutlineLocationMarker className="mr-2 h-4 w-4 text-[#A33B2B]" />
              {program.location?.title ?? "Location"}
            </span>
          </div> */}
        </div>

        <div className="md:w-[55%] flex-1 p-5 border-t border-slate-200/70 md:border-t-0 md:border-l md:border-r md:border-slate-200/70">
        <div className="flex items-center justify-between gap-4">
        <Link
              to={`/programs/${program._id}`}
              className=""
            >  <h3 className="text-2xl font-semibold text-[#0F172A] leading-tight">
            {program.title}
          </h3></Link>

          
          
          {(
            (typeof program.category === "string" && program.category.trim() !== "") ||
            (program.category && typeof program.category === "object" && program.category.title && program.category.title.trim() !== "")
          ) && (
            <div className="mt-2">
              <span className="inline-flex items-center  w-auto rounded-full bg-[#A33B2B]/10 text-[#A33B2B] text-sm font-semibold uppercase no-wrap tracking-[0.1em] px-3 py-2">
                {typeof program.category === "string" ? program.category : program.category?.title}
              </span>
            </div>
          )}
          </div>

        
<div className="mt-4 flex  flex-wrap  items-center gap-3">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-900">
            <HiOutlineCalendar className="h-5 w-5 text-[#A33B2B]" />
            <span className="text-slate-600">Program Starts:</span>
            <span>{formatProgramDateRange(program.startDate)}</span>
          </div>

           <div className="inline-flex items-center gap-2 text-sm  text-slate-900 font-medium">
              <HiOutlineLocationMarker className="h-5 w-5 text-[#A33B2B]" />
              {program.location?.title ?? "Location details"} 
            </div>

            </div>

          <p className="mt-4 text-sm leading-6 text-slate-600">
            {program.shortDescription}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">

            </div>


             
          <div className="mt-3 space-y-3 text-sm text-slate-700 flex items-start  flex-wrap gap-3">
           

            <div className="inline-flex items-center gap-2 text-slate-900 font-medium">
              <div className="inline-flex items-center gap-2 text-slate-900 font-medium">
                <HiOutlineUserGroup className="h-5 w-5 text-[#A33B2B]" />
                Age Group
              </div>
              <div className="flex flex-wrap gap-2">
                {program.ageGroups?.map((ageGroup) => (
                  <span key={ageGroup} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
                    {ageGroup}
                  </span>
                ))}
              </div>
            </div>

            <div className="inline-flex items-center gap-2 text-slate-900 font-medium">
              <div className="inline-flex items-center gap-2 text-slate-900 font-medium">
                <HiOutlineSparkles className="h-5 w-5 text-[#A33B2B]" />
                Skill Level
              </div>
              <div className="flex flex-wrap gap-2">
                {program.skillLevels?.map((skillLevel) => (
                  <span key={skillLevel} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
                    {skillLevel}
                  </span>
                ))}
              </div>
            </div>




          </div>

           <div className="mt-1 space-y-2 flex flex-col">
            <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-700">
             <HiOutlineClock className="h-5 w-5 text-[#A33B2B]" />  <span>Available Batches:</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            
              {availableDays.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm font-medium text-[#0F172A]">
                  {availableDays.map((day) => (
                    <li key={day} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#A33B2B]" />
                      <span>{day}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">Schedule details loading...</p>
              )}
            </div>
          </div>
        </div>

        <div className="md:w-[20%] flex-none p-5 flex flex-col justify-between gap-6">
          <div className="rounded-[20px] bg-[#A33B2B]/5 p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.24em] text-[#A33B2B]">
              <HiOutlineCurrencyDollar className="h-4 w-4" />
              Price
            </div>
            <div className="mt-3 text-3xl font-semibold text-[#0F172A]">
              {price ? `$${price}` : "N/A"}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {/* Quick Register — goes directly to registration flow */}
            <button
              onClick={() => setQuickOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#A33B2B] bg-white px-4 py-3 text-sm font-semibold text-[#A33B2B] transition duration-300 hover:bg-[#A33B2B]/5"
            >
              <HiOutlineLightningBolt className="h-4 w-4" />
              Quick Register
            </button>

            {/* View Details — opens the program detail page */}
            <Link
              to={`/programs/${program._id}`}
              className="inline-flex items-center justify-center rounded-2xl bg-[#A33B2B] px-4 py-3 text-sm font-semibold text-white transition duration-300 hover:bg-[#ea7a2e]"
            >
              View Details
            </Link>
          </div>
        </div>
      </div>
      <QuickRegisterDrawer
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        program={program}
      />
    </div>
  );
}

interface TimeSlot { startTime: string; endTime: string; }
interface MonthOption { label: string; startDate: string; endDate: string; weeks: string | number; price?: string | number; }
interface QuickBatch {
  _id: string;
  name: string;
  title?: string;
  days: string;
  dayOfWeek?: string;
  multiDays?: string[];
  timing: string;
  timeSlots?: TimeSlot[];
  fee: number;
  price?: number;
  seats: number;
  sessionsPerWeek?: number;
  monthOptions?: MonthOption[];
  location?: { title?: string; city?: string; address?: string };
  groundLocationNote?: string;
}

const DAY_FULL: Record<string, string> = {
  MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday",
  FRI: "Friday", SAT: "Saturday", SUN: "Sunday",
};

function getSlots(batch: QuickBatch): TimeSlot[] {
  if (batch.timeSlots && batch.timeSlots.length > 0) return batch.timeSlots;
  const parts = batch.timing?.split(" - ");
  if (parts?.length === 2) return [{ startTime: parts[0].trim(), endTime: parts[1].trim() }];
  return [];
}

function getLocationStr(batch: QuickBatch): string {
  if (batch.location?.address) return batch.location.address;
  if (batch.location?.city) return batch.location.city;
  if (batch.location?.title) return batch.location.title;
  if (batch.groundLocationNote) return batch.groundLocationNote;
  return "";
}

// Formats a month option's start/end dates + weeks as "Jul 5 - Aug 10 ( 5 week )"
function fmtMonthDateRange(startDate?: string, endDate?: string, weeks?: string | number): string {
  if (!startDate || !endDate) return "";
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "";
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const range = `${s.toLocaleDateString("en-US", opts)} - ${e.toLocaleDateString("en-US", opts)}`;
  return weeks ? `${range} ( ${weeks} week )` : range;
}

function buildDaySlotOptions(batch: QuickBatch): string[] {
  const slots = getSlots(batch);
  const locationSuffix = getLocationStr(batch) ? ` - ${getLocationStr(batch)}` : "";
  let days: string[] = [];
  if (batch.multiDays && batch.multiDays.length > 0) days = batch.multiDays.map((d) => DAY_FULL[d] ?? d);
  else if (batch.dayOfWeek && batch.dayOfWeek !== "MULTI") days = [DAY_FULL[batch.dayOfWeek] ?? batch.dayOfWeek];
  else if (batch.days) days = [batch.days];
  if (days.length === 0) return [];
  return days.map((day, index) => {
    if (slots.length > 0) {
      const s = slots[index] ?? slots[0];
      return `${day} - ${fmt12(s.startTime)} - ${fmt12(s.endTime)}${locationSuffix}`;
    }
    return `${day}${locationSuffix}`;
  });
}

function buildProgramAvailableDayOptions(program: ProgramCardProps["program"] & { batches?: QuickBatch[] }): string[] {
  const fromBatches = Array.isArray(program.batches)
    ? program.batches.flatMap((batch) => buildDaySlotOptions(batch as QuickBatch))
    : [];

  const fromScheduleDays = Array.isArray(program.scheduleDays)
    ? program.scheduleDays.map((schedule) => {
        const day = schedule.day ? (DAY_FULL[schedule.day] ?? schedule.day) : "";
        const time = schedule.startTime && schedule.endTime
          ? `${fmt12(schedule.startTime)} - ${fmt12(schedule.endTime)}`
          : "";
        return [day, time, schedule.groundAddress].filter(Boolean).join(" - ");
      }).filter(Boolean)
    : [];

  const fromWeeklyBatches = Array.isArray(program.weeklyBatches)
    ? program.weeklyBatches.map((batch: any) => {
        const time = batch.startTime && batch.endTime ? `${fmt12(batch.startTime)} - ${fmt12(batch.endTime)}` : "";
        return [batch.label, time, batch.groundAddress].filter(Boolean).join(" - ");
      }).filter(Boolean)
    : [];

  return Array.from(new Set([...fromBatches, ...fromScheduleDays, ...fromWeeklyBatches]));
}

function freqLabel(n: number): string {
  const m: Record<number, string> = { 1: "Once a Week", 2: "Twice a Week", 3: "Thrice a Week" };
  return m[n] ?? `${n} times a Week`;
}

function getDobError(value: string): string {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "";
  const sel = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  sel.setHours(0, 0, 0, 0);
  return sel.getTime() > today.getTime() ? "Date of birth cannot be a future date" : "";
}

function QuickRegisterDrawer({
  open,
  onClose,
  program,
}: {
  open: boolean;
  onClose: () => void;
  program: ProgramCardProps["program"];
}) {
  const navigate = useNavigate();
  const {
    setSelectedProgram,
    setSelectedBatch,
    students,
    currentStudentIndex,
    setCurrentStudentIndex,
    updateStudent,
    addStudent,
    removeStudent,
    savedStudentOptions,
    selectSavedStudent,
    dismissSavedStudentOptions,
  } = useRegistration();
  const [step, setStep] = useState<"batch" | "student">("batch");
  const [fullProgram, setFullProgram] = useState<any | null>(null);
  const [batches, setBatches] = useState<QuickBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [batchError, setBatchError] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<MonthOption | null>(null);
  const [selectedFreq, setSelectedFreq] = useState(1);
  const [daySlots, setDaySlots] = useState<(string | null)[]>([null]);
  const [dobError, setDobError] = useState("");

  // ── WEEKLY batchType: multi-select batches, price = basePrice × count ──
  const [weeklyBatches, setWeeklyBatches] = useState<WeeklyBatchRaw[]>([]);
  const [selectedWeeklyBatchIds, setSelectedWeeklyBatchIds] = useState<string[]>([]);
  const isWeeklyProgram = fullProgram?.batchType === "WEEKLY";

  useEffect(() => {
    if (!open || fullProgram) return;
    setLoadingBatches(true);
    setBatchError("");
    getProgramById(program._id)
      .then((data) => {
        const batchItems: QuickBatch[] = Array.isArray(data?.batches)
          ? data.batches.map((b: any) => ({
              _id: b._id,
              name: b.name ?? b.title ?? `Batch ${b._id}`,
              title: b.title,
              days: b.days ?? "",
              dayOfWeek: b.dayOfWeek,
              multiDays: b.multiDays,
              timing: b.timing ?? "",
              timeSlots: b.timeSlots,
              fee: Number(b.price ?? b.fee ?? 0),
              price: Number(b.price ?? b.fee ?? 0),
              seats: Number(b.maxCapacity ?? b.capacity ?? b.seats ?? 0),
              sessionsPerWeek: b.sessionsPerWeek ?? undefined,
              monthOptions: Array.isArray(b.monthOptions) ? b.monthOptions : [],
              location: b.location,
              groundLocationNote: b.groundLocationNote,
            }))
          : [];
        setFullProgram(data ?? program);
        setBatches(batchItems);
        setWeeklyBatches(Array.isArray(data?.weeklyBatches) ? data.weeklyBatches : []);
      })
      .catch(() => {
        setBatchError("Unable to load batches. Please try again.");
        setBatches([]);
      })
      .finally(() => setLoadingBatches(false));
  }, [open, fullProgram, program]);

  useEffect(() => {
    setDaySlots(Array(selectedFreq).fill(null));
  }, [selectedFreq]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const activeBatch = batches.find((b) => b._id === selectedBatchId) ?? null;
  const baseMonthPrice = (() => {
    if (!selectedMonth) return 0;
    const direct = Number(selectedMonth.price);
    if (direct > 0) return direct;
    const match = activeBatch?.monthOptions?.find((m) => m.label === selectedMonth.label);
    const fromBatch = Number(match?.price);
    return fromBatch > 0 ? fromBatch : 0;
  })();
  const totalPriceNonWeekly = baseMonthPrice > 0 ? baseMonthPrice * selectedFreq : activeBatch?.price ?? activeBatch?.fee ?? 0;
  const allDaySlotsSelected = daySlots.every(Boolean);

  // ── WEEKLY batchType: price = program basePrice × number of batches picked ──
  const weeklyBasePrice = fullProgram?.discountedPrice ?? fullProgram?.basePrice ?? program.discountedPrice ?? program.basePrice ?? 0;
  const weeklyTotalPrice = calcWeeklyPrice(weeklyBasePrice, selectedWeeklyBatchIds);
  const totalPrice = isWeeklyProgram ? weeklyTotalPrice : totalPriceNonWeekly;
  const weeklySnapshots = isWeeklyProgram ? toWeeklyBatchSnapshots(weeklyBatches, selectedWeeklyBatchIds) : [];

  const canContinue = isWeeklyProgram
    ? selectedWeeklyBatchIds.length > 0
    : Boolean(activeBatch) && Boolean(selectedMonth) && allDaySlotsSelected;
  const student = students[currentStudentIndex] ?? students[0];
  const isStudentValid = Boolean(
    student?.firstName?.trim() &&
    student?.lastName?.trim() &&
    student?.dob &&
    !dobError &&
    student?.gender
  );

  const buildBatchContext = () => {
    if (isWeeklyProgram) {
      if (selectedWeeklyBatchIds.length === 0) return null;
      const snapshots = toWeeklyBatchSnapshots(weeklyBatches, selectedWeeklyBatchIds);
      const weeklyBatchName = snapshots.map((s) => s.label).filter(Boolean).join(" + ");
      return {
        _id: fullProgram?._id ?? program._id,
        name: weeklyBatchName || "Selected weekly batches",
        days: snapshots.map((s) => s.label).join(" + "),
        timing: snapshots.map((s) => `${s.startTime} - ${s.endTime}`).join(" | "),
        fee: weeklyTotalPrice,
        seats: fullProgram?.maxCapacity ?? 0,
        sessionsPerWeek: selectedWeeklyBatchIds.length,
        selectedWeeklyBatches: snapshots,
      };
    }
    if (!activeBatch || !selectedMonth) return null;
    return {
      _id: activeBatch._id,
      name: activeBatch.name,
      days: daySlots.filter(Boolean).join(" + "),
      timing: daySlots.filter(Boolean).join(" | "),
      fee: totalPriceNonWeekly,
      seats: activeBatch.seats,
      sessionsPerWeek: selectedFreq,
      selectedMonth,
      selectedFrequency: selectedFreq,
    };
  };

  const saveBatchSelection = () => {
    const batchContext = buildBatchContext();
    if (!batchContext) return null;
    setSelectedProgram((fullProgram ?? program) as any);
    setSelectedBatch(batchContext as any);
    updateStudent(currentStudentIndex, { selectedBatch: batchContext as any });
    return batchContext;
  };

  const handleContinueToStudent = () => {
    if (!saveBatchSelection()) return;
    setStep("student");
  };

  const handleStudentChange = (field: string, value: string) => {
    updateStudent(currentStudentIndex, { [field]: value });
  };

  const handleDobChange = (value: string) => {
    handleStudentChange("dob", value);
    setDobError(getDobError(value));
  };

  const handleAddStudent = () => {
    if (!isStudentValid) return;
    const batchContext = saveBatchSelection();
    addStudent({ firstName: "", lastName: "", dob: "", gender: "", schoolName: "", medicalNotes: "", selectedBatch: batchContext as any });
    setCurrentStudentIndex(students.length);
    setDobError("");
  };

  const handleProceedToReview = () => {
    if (!isStudentValid) return;
    saveBatchSelection();
    onClose();
    navigate("/review-order");
  };

  const drawer = (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close quick registration" className="absolute inset-0 h-full w-full bg-slate-950/50" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#A33B2B]">Quick Register</p>
            <h2 className="mt-1 text-2xl font-bold text-[#0F172A]">{program.title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {step === "student"
                ? "Add student details before review."
                : "Choose a month, batch, and training days."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50">
            <HiOutlineX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {step === "student" && student ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-[#A33B2B]/20 bg-[#FFF7ED] px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Selected Batch</p>
                    {isWeeklyProgram ? (
                      <>
                        <p className="mt-1 text-sm font-bold text-[#0F172A]">{fullProgram?.title ?? program.title}</p>
                        <div className="mt-1 space-y-0.5">
                          {weeklySnapshots.map((s) => (
                            <p key={s._id} className="text-xs text-slate-500">
                              • {formatWeekRangeLabel(s)}
                              {s.startTime && s.endTime ? ` (${fmt12(s.startTime)} - ${fmt12(s.endTime)})` : ""}
                            </p>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="mt-1 text-sm font-bold text-[#0F172A]">{activeBatch?.title || activeBatch?.name} · {selectedMonth?.label}</p>
                        <p className="mt-1 text-xs text-slate-500">{daySlots.filter(Boolean).join(" + ")}</p>
                      </>
                    )}
                  </div>
                  <p className="text-lg font-bold text-[#A33B2B]">${totalPrice}</p>
                </div>
                <button type="button" onClick={() => setStep("batch")} className="mt-3 text-xs font-bold text-[#A33B2B] hover:underline">
                  Change selection
                </button>
              </div>

              <div>
                <h3 className="text-lg font-bold text-[#0F172A]">
                  Student {currentStudentIndex + 1}{students.length > 1 ? ` of ${students.length}` : ""}
                </h3>
                {students.length > 1 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {students.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => { setCurrentStudentIndex(index); setDobError(""); }}
                        className={`h-8 w-8 rounded-full border text-xs font-bold transition ${index === currentStudentIndex ? "border-[#A33B2B] bg-[#A33B2B] text-white" : "border-slate-300 bg-white text-slate-600"}`}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {savedStudentOptions && currentStudentIndex === 0 && !student?.firstName?.trim() && !student?.lastName?.trim() && (
                <SavedStudentPicker
                  students={savedStudentOptions}
                  onSelect={selectSavedStudent}
                  onSkip={dismissSavedStudentOptions}
                />
              )}

              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">First Name *</label>
                    <input value={student.firstName} onChange={(e) => handleStudentChange("firstName", e.target.value)} placeholder="Alex" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#A33B2B]" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Last Name *</label>
                    <input value={student.lastName} onChange={(e) => handleStudentChange("lastName", e.target.value)} placeholder="Patel" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#A33B2B]" />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Date of Birth *</label>
                    <input type="date" value={student.dob} max={new Date().toISOString().split("T")[0]} onChange={(e) => handleDobChange(e.target.value)} className={`w-full rounded-2xl border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#A33B2B] ${dobError ? "border-red-400" : "border-slate-200"}`} />
                    {dobError && <p className="mt-1 text-xs font-semibold text-red-500">{dobError}</p>}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Gender *</label>
                    <GenderSelect
                      value={student.gender}
                      onChange={(value) => handleStudentChange("gender", value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#A33B2B]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">School Name</label>
                  <input value={student.schoolName} onChange={(e) => handleStudentChange("schoolName", e.target.value)} placeholder="Sunrise High School" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#A33B2B]" />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Medical Notes</label>
                  <textarea rows={3} value={student.medicalNotes} onChange={(e) => handleStudentChange("medicalNotes", e.target.value)} placeholder="Allergies or important health info..." className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#A33B2B]" />
                </div>

                {students.length > 1 && (
                  <button
                    type="button"
                    onClick={() => { removeStudent(currentStudentIndex); setCurrentStudentIndex(Math.max(0, currentStudentIndex - 1)); setDobError(""); }}
                    className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                  >
                    <HiOutlineTrash className="h-4 w-4" /> Remove this student
                  </button>
                )}
              </div>
            </div>
          ) : isWeeklyProgram ? (
            <div className="space-y-4">
              {loadingBatches && <p className="py-8 text-center text-sm font-semibold text-slate-500">Loading batches...</p>}
              {batchError && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{batchError}</div>}
              {!loadingBatches && !batchError && (
                <>
                  <p className="text-sm text-slate-500">
                    This is a Weekly program — select one or more batches below. Price = base price × number
                    of batches selected.
                  </p>
                  <WeeklyBatchSelector
                    batches={weeklyBatches}
                    basePrice={weeklyBasePrice}
                    selectedIds={selectedWeeklyBatchIds}
                    onChange={setSelectedWeeklyBatchIds}
                  />
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {loadingBatches && <p className="py-8 text-center text-sm font-semibold text-slate-500">Loading batches...</p>}
              {batchError && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{batchError}</div>}
              {!loadingBatches && batches.length === 0 && !batchError && <p className="py-8 text-center text-sm font-semibold text-slate-500">No batches available for this program.</p>}

              {batches.map((batch) => {
                const isSelected = selectedBatchId === batch._id;
                const monthOptions = batch.monthOptions ?? [];
                const freqOptions = Array.from({ length: batch.sessionsPerWeek ?? 3 }, (_, i) => i + 1);
                return (
                  <div key={batch._id} className={`rounded-2xl border p-4 transition ${isSelected ? "border-[#A33B2B] bg-[#FFF7ED] ring-2 ring-[#A33B2B]/15" : "border-slate-200 bg-slate-50"}`}>
                    <h3 className="text-lg font-bold text-[#0F172A]">{batch.title || batch.name}</h3>
                    <p className="mt-1 text-xs font-semibold text-[#A33B2B]">{batch.price || batch.fee ? `From $${batch.price ?? batch.fee}` : "Price varies"}</p>

                    <div className="mt-4 space-y-4">
                      {monthOptions.length > 0 ? (
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Select Month</p>
                          <div className="flex flex-wrap gap-2">
                            {monthOptions.map((opt, index) => {
                              const checked = isSelected && selectedMonth?.label === opt.label;
                              const dateRange = fmtMonthDateRange(opt.startDate, opt.endDate, opt.weeks);
                              return (
                                <label key={`${opt.label}-${index}`} className={`cursor-pointer rounded-2xl border px-3 py-1.5 text-sm font-semibold transition ${checked ? "border-[#A33B2B] bg-[#A33B2B] text-white" : "border-slate-300 bg-white text-slate-700"}`}>
                                  <input
                                    type="radio"
                                    className="sr-only"
                                    name={`quick-month-${batch._id}`}
                                    checked={checked}
                                    onChange={() => {
                                      setSelectedBatchId(batch._id);
                                      setSelectedMonth(opt);
                                      setSelectedFreq(1);
                                      setDaySlots([null]);
                                    }}
                                  />
                                  <span className="flex flex-col leading-tight">
                                    <span>{opt.label}{opt.price ? ` · $${opt.price}` : ""}</span>
                                    {dateRange && (
                                      <span className={`text-[11px] font-normal ${checked ? "text-white/80" : "text-slate-500"}`}>
                                        {dateRange}
                                      </span>
                                    )}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
                          <input
                            type="radio"
                            name={`quick-batch-${batch._id}`}
                            checked={isSelected}
                            onChange={() => {
                              setSelectedBatchId(batch._id);
                              setSelectedMonth({ label: batch.name, startDate: "", endDate: "", weeks: "", price: batch.price ?? batch.fee });
                              setSelectedFreq(1);
                              setDaySlots([null]);
                            }}
                            className="h-4 w-4 accent-[#A33B2B]"
                          />
                          Select this batch
                        </label>
                      )}

                      {isSelected && selectedMonth && (
                        <>
                          {freqOptions.length > 1 && (
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Frequency</p>
                              <div className="flex flex-wrap gap-2">
                                {freqOptions.map((n) => (
                                  <label key={n} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-semibold transition ${selectedFreq === n ? "border-[#A33B2B] bg-[#A33B2B] text-white" : "border-slate-300 bg-white text-slate-700"}`}>
                                    <input type="radio" className="sr-only" name={`quick-freq-${batch._id}`} checked={selectedFreq === n} onChange={() => setSelectedFreq(n)} />
                                    {freqLabel(n)}
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}

                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Select Day{selectedFreq > 1 ? "s" : ""}</p>
                            <div className="space-y-2">
                              {Array.from({ length: selectedFreq }).map((_, index) => (
                                <select
                                  key={index}
                                  value={daySlots[index] ?? ""}
                                  onChange={(e) => {
                                    const val = e.target.value || null;
                                    setDaySlots((prev) => {
                                      const next = [...prev];
                                      next[index] = val;
                                      return next;
                                    });
                                  }}
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#A33B2B]"
                                >
                                  <option value="">Select Day {selectedFreq > 1 ? index + 1 : ""}</option>
                                  {buildDaySlotOptions(batch)
                                    .filter((opt) => opt === daySlots[index] || !daySlots.some((slot, slotIndex) => slotIndex !== index && slot === opt))
                                    .map((opt, optionIndex) => <option key={optionIndex} value={opt}>{opt}</option>)}
                                </select>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Selected Total</span>
            <span className="text-2xl font-bold text-[#0F172A]">{totalPrice > 0 ? `$${totalPrice}` : "$--"}</span>
          </div>
          {step === "student" ? (
            <div className="space-y-2">
              <button type="button" disabled={!isStudentValid} onClick={handleAddStudent} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#A33B2B] bg-white px-4 py-3 text-sm font-bold text-[#A33B2B] transition hover:bg-[#A33B2B]/5 disabled:cursor-not-allowed disabled:opacity-40">
                <HiOutlinePlusCircle className="h-4 w-4" /> Add Another Student
              </button>
              <button type="button" disabled={!isStudentValid} onClick={handleProceedToReview} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#A33B2B] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#ea7a2e] disabled:cursor-not-allowed disabled:opacity-40">
                Continue to Review <HiOutlineArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button type="button" disabled={!canContinue} onClick={handleContinueToStudent} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#A33B2B] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#ea7a2e] disabled:cursor-not-allowed disabled:opacity-40">
              Continue to Student Details <HiOutlineArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(drawer, document.body);
}

export default ProgramCard;
