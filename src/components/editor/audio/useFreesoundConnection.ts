"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { audioError, audioRequest, getIntegrationStatus } from "./audioTransport";

export function useFreesoundConnection() {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof getIntegrationStatus>> | null>(null);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const popup = useRef<Window | null>(null);
  const refresh = useCallback(async () => {
    try { setStatus(await getIntegrationStatus()); setError(""); }
    catch (e) { setError(audioError(e)); }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== popup.current || event.data?.type !== "freesound-connection") return;
      setConnecting(false); void refresh();
      if (!event.data.connected) setError("Không thể kết nối. Hãy thử lại.");
    };
    const poll = setInterval(() => { if (popup.current?.closed) { popup.current = null; setConnecting(false); void refresh(); } }, 1000);
    window.addEventListener("message", receive);
    return () => { clearTimeout(initial); clearInterval(poll); window.removeEventListener("message", receive); };
  }, [refresh]);
  const connect = () => {
    popup.current = window.open("/api/integrations/freesound/connect", "freesound-connect", "popup,width=560,height=720");
    if (!popup.current) { setError("Hãy cho phép cửa sổ bật lên để kết nối Freesound."); return; }
    setConnecting(true); setError("");
  };
  const disconnect = async () => {
    try { await audioRequest("/api/integrations/freesound/disconnect", z.object({ connected: z.literal(false) }), {}); await refresh(); }
    catch (e) { setError(audioError(e)); }
  };
  return { status, error, connecting, refresh, connect, disconnect };
}
