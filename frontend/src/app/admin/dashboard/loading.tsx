export default function AdminLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-4 border-[#35577D]/30" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#7BBDE8] animate-spin" />
      </div>
    </div>
  );
}
