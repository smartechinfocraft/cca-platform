import { useEffect, useRef, useState } from "react";
import { WAIVER_AGREEMENT_VERSION, waiverAgreementSections } from "../../constants/waiverAgreement";

interface WaiverConsentProps {
  accepted: boolean;
  signature: string;
  drawnSignature: string;
  guardianName?: string;
  error?: string | null;
  onAcceptedChange: (accepted: boolean) => void;
  onSignatureChange: (signature: string) => void;
  onDrawnSignatureChange: (signature: string) => void;
}

function WaiverConsent({
  accepted,
  signature,
  drawnSignature,
  guardianName,
  error,
  onAcceptedChange,
  onSignatureChange,
  onDrawnSignatureChange,
}: WaiverConsentProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasDrawnRef = useRef(false);
  const resolvedGuardianName = guardianName?.trim() || "";

  const applyCanvasStyle = (ctx: CanvasRenderingContext2D, ratio: number) => {
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#0F172A";
  };

  const clearCanvasSurface = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    applyCanvasStyle(ctx, ratio);
  };

  useEffect(() => {
    if (resolvedGuardianName && signature !== resolvedGuardianName) {
      onSignatureChange(resolvedGuardianName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedGuardianName, signature]);

  const prepareCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    applyCanvasStyle(ctx, ratio);

    if (drawnSignature.startsWith("data:image")) {
      const image = new Image();
      image.onload = () => {
        try {
          ctx.drawImage(image, 0, 0, rect.width, rect.height);
        } catch {
          clearCanvasSurface();
          hasDrawnRef.current = false;
        }
      };
      image.onerror = () => {
        clearCanvasSurface();
        hasDrawnRef.current = false;
      };
      image.src = drawnSignature;
      hasDrawnRef.current = true;
    }
  };

  useEffect(() => {
    prepareCanvas();

    const handleResize = () => prepareCanvas();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawnSignature]);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const point = pointFromEvent(event);
    if (!canvas || !point) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    setIsDrawing(true);
    hasDrawnRef.current = true;
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const point = pointFromEvent(event);
    if (!canvas || !point) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const finishDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && hasDrawnRef.current) {
      try {
        onDrawnSignatureChange(canvas.toDataURL("image/png"));
      } catch {
        clearCanvasSurface();
        hasDrawnRef.current = false;
        onDrawnSignatureChange("");
      }
    }
  };

  const clearDrawing = (event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    setIsDrawing(false);
    clearCanvasSurface();
    hasDrawnRef.current = false;
    onDrawnSignatureChange("");
  };

  return (
    <div className="rounded-[24px] border-2 border-[var(--gold)] bg-amber-50 p-5 shadow-md ring-4 ring-[var(--gold)]/10">
      <div className="rounded-2xl border border-[var(--gold)]/40 bg-white p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--gold)]">
          Mandatory Checkout Consent
        </p>
        <div className="flex items-start gap-4">
          <input
            id="waiver-consent"
            type="checkbox"
            checked={accepted}
            onChange={(e) => onAcceptedChange(e.target.checked)}
            className="mt-0.5 h-6 w-6 shrink-0 rounded border-2 border-[var(--gold)] text-[var(--gold)] focus:ring-[var(--gold)]"
          />
          <label htmlFor="waiver-consent" className="text-sm leading-6 text-slate-700">
            <span className="font-bold text-[#0F172A]">Required waiver and consent.</span>{" "}
            I have read and agree to CCA's waiver, consent, refund policy, and terms & conditions.{" "}
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="font-semibold text-[var(--gold)] underline underline-offset-2"
            >
              View full agreement
            </button>
          </label>
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-xs font-semibold text-slate-700">
          Parent / Guardian Typed E-Signature <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={resolvedGuardianName || signature}
          onChange={(e) => onSignatureChange(e.target.value)}
          readOnly={Boolean(resolvedGuardianName)}
          placeholder={guardianName || "Type parent/guardian full name"}
          className={`mt-3 w-full rounded-xl border border-amber-200 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/15 ${
            resolvedGuardianName ? "bg-slate-50 text-slate-700 cursor-not-allowed" : "bg-white"
          }`}
        />

        <div className="mt-4">
          <label className="block text-xs font-semibold text-slate-700">
            Parent / Guardian Drawn Digital Signature <span className="text-red-500">*</span>
          </label>
          <canvas
            ref={canvasRef}
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={finishDrawing}
            onPointerCancel={finishDrawing}
            onPointerLeave={finishDrawing}
            className="mt-3 h-40 w-full touch-none rounded-2xl border border-amber-200 bg-white shadow-inner"
            aria-label="Draw parent or guardian signature"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">Sign with your finger, mouse, or trackpad.</p>
            <button
              type="button"
              onClick={clearDrawing}
              className="rounded-full border-2 border-[var(--gold)] bg-white px-5 py-2 text-sm font-bold text-[var(--outfield)] shadow-sm hover:bg-[var(--gold)] hover:text-[var(--outfield)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
            >
              Clear
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Version {WAIVER_AGREEMENT_VERSION}. Electronic signatures are treated as binding consent.
        </p>
        {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 px-4 py-6"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-[24px] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--gold)]">
                  Required Agreement
                </p>
                <h2 className="mt-1 text-xl font-bold text-[#0F172A]">
                  Waiver, Consent, Refund Policy, and Terms
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-lg font-bold text-slate-500 hover:bg-slate-50"
                aria-label="Close waiver agreement"
              >
                x
              </button>
            </div>

            <div className="max-h-[62vh] overflow-y-auto p-5">
              <div className="space-y-5 text-sm leading-6 text-slate-600">
                {waiverAgreementSections.map((section) => (
                  <section key={section.title}>
                    <h3 className="font-bold text-[#0F172A]">{section.title}</h3>
                    <div className="mt-2 space-y-2">
                      {section.body.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 p-5">
              <button
                type="button"
                onClick={() => {
                  onAcceptedChange(true);
                  setModalOpen(false);
                }}
                className="w-full rounded-full bg-[var(--gold)] px-6 py-3 text-sm font-bold text-[var(--outfield)] transition hover:bg-[var(--gold-light)]"
              >
                I Agree
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WaiverConsent;
