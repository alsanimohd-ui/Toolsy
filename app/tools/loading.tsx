export default function ToolsLoading() {
  return (
    <div className="toolsy-page-shell flex items-center justify-center">
      <div className="toolsy-content items-center gap-8 py-20">
        <div className="flex flex-col items-center gap-8 w-full max-w-3xl">
          <div className="toolsy-skeleton w-48 h-6 rounded-lg" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="toolsy-skeleton h-48 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}