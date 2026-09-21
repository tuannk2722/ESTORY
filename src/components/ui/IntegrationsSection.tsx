"use client";
import { useFreesoundConnection } from "@/components/editor/audio/useFreesoundConnection";


export default function IntegrationsSection() {
  const connection = useFreesoundConnection();

  return (
    <section className="border-b border-border py-3 text-sm" aria-label="Liên kết tài khoản">
      <div className="flex gap-2 items-center justify-between px-3">
        <div className="min-w-0">
          <h3 className="font-semibold">Freesound</h3>
          {connection.status ? (
            <p className="break-words text-muted-foreground">
              {connection.status.freesound_connection.connected
                ? connection.status.freesound_connection.freesound_username
                : "Chưa kết nối"}
            </p>
          ) : (
            <p role="status" className="text-muted-foreground">
              Đang tải…
            </p>
          )}
        </div>
        {connection.status && (
          <button
            type="button"
            disabled={connection.connecting}
            className={`flex min-h-[44px] w-full items-center justify-center rounded-lg px-3 font-medium transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:w-auto sm:shrink-0 ${
              connection.status.freesound_connection.connected
                ? "text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/10"
                : "text-primary hover:bg-[var(--color-muted)]"
            }`}
            onClick={() =>
              connection.status?.freesound_connection.connected
                ? void connection.disconnect()
                : connection.connect()
            }
          >
            {connection.connecting
              ? "Đang kết nối…"
              : connection.status.freesound_connection.connected
                ? "Ngắt kết nối"
                : "Kết nối Freesound"}
          </button>
        )}
      </div>
      {connection.error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {connection.error}
        </p>
      )}
    </section>
  );
}
