type Props = { title: string; message: string; contactEmail?: string };

export default function MaintenancePage({ title, message, contactEmail }: Props) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b1d12] px-5 py-12 text-white">
      <div className="absolute inset-0 opacity-35" style={{ background: "radial-gradient(circle at 20% 20%, #3f7d4f 0, transparent 35%), radial-gradient(circle at 85% 75%, #c9a227 0, transparent 28%)" }} />
      <div className="absolute -left-24 top-16 h-64 w-64 rounded-full border border-[#f5d97a]/15" />
      <div className="absolute -right-32 bottom-10 h-96 w-96 rounded-full border border-[#f5d97a]/10" />
      <section className="relative w-full max-w-2xl rounded-[2rem] border border-white/10 bg-white/[0.07] p-8 text-center shadow-2xl backdrop-blur-md sm:p-14">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f5d97a] to-[#c9a227] text-xl font-black tracking-[0.16em] text-[#0b1d12] shadow-lg">CCA</div>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.3em] text-[#f5d97a]">California Cricket Academy</p>
        <h1 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">{title}</h1>
        <p className="mx-auto mt-5 max-w-xl whitespace-pre-line text-base leading-7 text-white/70 sm:text-lg">{message}</p>
        <div className="mx-auto mt-9 flex w-fit items-center gap-3 rounded-full border border-[#f5d97a]/25 bg-black/15 px-5 py-3 text-sm text-white/70">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#f5d97a]" /> Upgrade in progress
        </div>
        {contactEmail && <p className="mt-8 text-sm text-white/55">Need assistance? <a className="font-semibold text-[#f5d97a] underline underline-offset-4" href={`mailto:${contactEmail}`}>{contactEmail}</a></p>}
        <a href="/staff-login" className="mt-5 inline-block text-xs font-semibold text-white/35 transition hover:text-white/65">Staff login</a>
      </section>
    </main>
  );
}
