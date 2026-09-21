import type { AudioAttribution } from "@/lib/reader/audio-attribution";


export default function AttributionFooter({ items }: { items: AudioAttribution[] }) {
  if (!items.length) return null;

  return (
    <footer className="relative z-20 mx-auto mt-10 max-w-2xl rounded-xl bg-black/80 p-4 text-sm text-[#F8FAFC]" aria-label="Nguồn âm thanh">
      <h2 className="mb-2 font-semibold">Nguồn âm thanh</h2>
      <ul className="space-y-2">
        {items.map((item) =>
          <li key={item.id} className="break-words">
            <a href={item.source_url} target="_blank" rel="noreferrer" className="underline focus-visible:outline focus-visible:outline-2">
              {item.title}
            </a>
            — {item.author_name} · {item.license_name}
          </li>)}
      </ul>
    </footer>
  );
}
