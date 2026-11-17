"use client";

import { useState } from "react";
import { Heading, Text, Input, Button } from "@medusajs/ui";
import { MapPin, Search, CheckCircle, Navigation, Clock, Truck } from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";

interface BranchLocationModalProps {
  currentBranch?: any;
  onSelectBranch: (branch: any, resolvedBy: string) => void;
  onClose: () => void;
}

export function BranchLocationModal({ currentBranch, onSelectBranch, onClose }: BranchLocationModalProps) {
  const [pincodeOrArea, setPincodeOrArea] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pincodeOrArea.trim()) return;
    setLoading(true);
    setErrorMsg(null);

    const isNum = /^\d+$/.test(pincodeOrArea.trim());
    const params = isNum ? { pincode: pincodeOrArea.trim() } : { area: pincodeOrArea.trim() };

    try {
      const res: any = await apiClient.resolveBranch(params);
      if (res?.branch) {
        onSelectBranch(res.branch, res.resolvedBy || "user_search");
        onClose();
      } else {
        setErrorMsg(`No operational bakery hub delivers to "${pincodeOrArea}". Please try another area or city.`);
      }
    } catch {
      setErrorMsg("Failed to resolve delivery hub for this location.");
    } finally {
      setLoading(false);
    }
  };

  const handleUseGeoLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res: any = await apiClient.resolveBranch({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          if (res?.branch) {
            onSelectBranch(res.branch, res.resolvedBy || "geolocation");
            onClose();
          }
        } catch {
          setErrorMsg("Failed to resolve nearest hub from GPS location.");
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
        setErrorMsg("GPS permission was not granted. Please enter your area name or landmark.");
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="p-5 border-b bg-brand-gold-soft/60 dark:bg-brand-deep/30 flex items-center justify-between">
          <div>
            <Heading level="h3" className="text-base font-bold flex items-center gap-2 text-brand-navy dark:text-brand-gold/60">
              <MapPin className="w-5 h-5 text-brand-navy" /> Select Delivery Location
            </Heading>
            <Text className="text-xs text-brand-deep dark:text-brand-gold/80">
              Enter your area or city to view active bakery inventory and instant ETAs.
            </Text>
          </div>
          <Button size="small" variant="transparent" onClick={onClose}>✕</Button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {currentBranch && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">{currentBranch.name}</span>
                  <span className="text-[10px] text-slate-500">{currentBranch.city} • Pincode: {currentBranch.pincode}</span>
                </div>
              </div>
              <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded">Active</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-brand-gold-soft text-brand-navy text-xs font-semibold rounded-xl">
              ⚠️ {errorMsg}
            </div>
          )}

          <form onSubmit={handleResolve} className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input
                placeholder="Enter Area (e.g. Indiranagar), Landmark or City"
                value={pincodeOrArea}
                onChange={(e) => setPincodeOrArea(e.target.value)}
                className="pl-9 text-xs py-2.5"
                required
              />
            </div>
            <Button type="submit" isLoading={loading} className="w-full bg-brand-navy hover:bg-brand-deep text-white font-bold py-2.5">
              Find Matching Bakery Hub
            </Button>
          </form>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            <span className="flex-shrink mx-2 text-[10px] uppercase font-bold text-slate-400">Or Use GPS</span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={handleUseGeoLocation}
            className="w-full flex items-center justify-center gap-2 border-slate-300 font-bold"
          >
            <Navigation className="w-4 h-4 text-blue-600" /> Detect Live Location (GPS)
          </Button>

          <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-brand-gold" /> 35-45 Min Express ETA</span>
            <span className="flex items-center gap-1"><Truck className="w-3.5 h-3.5 text-emerald-500" /> Auto Partner Routing</span>
          </div>
        </div>
      </div>
    </div>
  );
}
