export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      <div className="relative">
        <h1 className="text-5xl font-black tracking-tighter mb-4">
          <span className="text-white">EKIDOS</span>
          <span className="text-red-500"> TAXI</span>
        </h1>
        <div className="flex justify-center">
          <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    </div>
  );
}
