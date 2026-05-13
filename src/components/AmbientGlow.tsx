export default function AmbientGlow() {
  return (
    <div className="fixed inset-0 z-[-2] overflow-hidden pointer-events-none hidden md:block">
      {/* HIDDEN ON MOBILE (md:block) to prevent severe GPU lag */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-600/10 blur-[120px] will-change-transform"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-fuchsia-600/10 blur-[120px] will-change-transform"></div>
    </div>
  );
}