// ============================================================
//  components/chatbot/QuickActions.tsx
//  The row of quick-action chips above the composer.
// ============================================================
import {
  HiOutlineUserPlus, HiOutlineQuestionMarkCircle, HiOutlineUserCircle,
  HiOutlineChatBubbleLeftRight, HiOutlineHeart, HiOutlineArrowPath,
} from "react-icons/hi2";

interface QuickActionsProps {
  onAction: (action: string) => void;
  isLoggedIn: boolean;
}

function QuickActions({ onAction, isLoggedIn }: QuickActionsProps) {
  const actions = [
    { key: "register", label: isLoggedIn ? "Browse Programs" : "Register", icon: HiOutlineUserPlus },
    { key: "faq", label: "FAQs", icon: HiOutlineQuestionMarkCircle },
    { key: "profile", label: "My Profile", icon: HiOutlineUserCircle },
    { key: "coach", label: "Message Coach", icon: HiOutlineChatBubbleLeftRight },
    { key: "fitness", label: "Fitness Check", icon: HiOutlineHeart },
    { key: "reset", label: "Reset Chat", icon: HiOutlineArrowPath },
  ];

  return (
    <div
      className="flex gap-2 px-3 py-2.5 overflow-x-auto flex-shrink-0 border-t"
      style={{ borderColor: "var(--pitch-deep)", scrollbarWidth: "none" }}
    >
      {actions.map((a) => (
        <button
          key={a.key}
          onClick={() => onAction(a.key)}
          className="cca-chip flex items-center gap-1.5 flex-shrink-0"
        >
          <a.icon className="w-3.5 h-3.5" />
          {a.label}
        </button>
      ))}
    </div>
  );
}

export default QuickActions;
