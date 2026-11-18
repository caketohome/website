"use client";

/**
 * Always-available "Install app" button for every visitor (hidden once installed / running as the app).
 * Uses the browser's install prompt when offered; otherwise shows how to install on this device.
 */

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

declare global {
  interface Window {
    __cthInstallPrompt?: any;
  }
}

const isStandalone = () =>
  typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true);

export function InstallAppButton({ compact = false }: { compact?: boolean }) {
  const [installed, setInstalled] = useState(true);
  const [promptEvent, setPromptEvent] = useState<any>(null);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    if (window.__cthInstallPrompt) setPromptEvent(window.__cthInstallPrompt);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      window.__cthInstallPrompt = e;
      setPromptEvent(e);
    };
    const onInstalled = () => {
      window.__cthInstallPrompt = undefined;
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const onClick = async () => {
    const ev = promptEvent || window.__cthInstallPrompt;
    if (ev) {
      ev.prompt();
      await ev.userChoice.catch(() => null);
      window.__cthInstallPrompt = undefined;
      setPromptEvent(null);
      return;
    }
    setHelp(true);
  };

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const ios = /iphone|ipad|ipod/i.test(ua);
  const android = /android/i.test(ua);

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-label="Install the CakeToHome app"
        className={
          compact
            ? "p-2 rounded-full text-[#1D2F5D] hover:bg-slate-100"
            : "inline-flex items-center gap-1.5 rounded-full border border-[#1D2F5D]/20 px-3 py-1.5 text-xs font-semibold text-[#1D2F5D] hover:bg-slate-50"
        }
      >
        <Download className="w-4 h-4" aria-hidden />
        {!compact && <span>Install app</span>}
      </button>
      {help && (
        <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0" onClick={() => setHelp(false)}>
          <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-serif text-lg text-[#1D2F5D]">Install CakeToHome</h2>
              <button type="button" onClick={() => setHelp(false)} aria-label="Close" className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="mt-3 space-y-2 text-sm text-slate-700 list-decimal pl-5">
              {ios ? (
                <>
                  <li>Tap the <strong>Share</strong> button in Safari.</li>
                  <li>Choose <strong>Add to Home Screen</strong>.</li>
                  <li>Open CakeToHome from your home screen.</li>
                </>
              ) : android ? (
                <>
                  <li>Tap the <strong>⋮</strong> menu in Chrome.</li>
                  <li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
                </>
              ) : (
                <>
                  <li>Click the <strong>install icon</strong> at the right of the address bar (or the browser menu → Install CakeToHome).</li>
                  <li>Confirm <strong>Install</strong>.</li>
                </>
              )}
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
