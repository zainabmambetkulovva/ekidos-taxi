export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-red-500/20" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-red-500 animate-spin" />
      </div>
    </div>
  );
}
