"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Ticket,
  User,
  Mail,
  Phone,
  ChevronDown,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { passService, ClientPass } from "@/api/client/services/pass.service"; // adjust to your actual service path
import { CountdownTimer } from "@/ui/components/countdown";
import { GameList } from "@/ui/components/gamelist";
import { ToastProvider, useToast } from "@/ui/components/toast";

// Not part of passService — keep/replace with your real country code list.
const COUNTRY_CODES = [
  { code: "+91", label: "India" },
  { code: "+1", label: "US/Canada" },
  { code: "+44", label: "UK" },
];

export default function PassesPage() {
  return (
    <ToastProvider>
      <PassesForm />
    </ToastProvider>
  );
}

function PassesForm() {
  const { showToast } = useToast();

  // Data loading state — list of passes for the dropdown
  const [passes, setPasses] = useState<ClientPass[]>([]);
  const [isLoadingPasses, setIsLoadingPasses] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedPassId, setSelectedPassId] = useState<string>("");

  // The selected pass is revalidated via getById whenever selectedPassId
  // changes, rather than reused from the (possibly stale) list data.
  const [selectedPass, setSelectedPass] = useState<ClientPass | null>(null);
  const [isRevalidatingPass, setIsRevalidatingPass] = useState(false);
  const [revalidateError, setRevalidateError] = useState<string | null>(null);

  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await passService.getAll();
        if (!cancelled) setPasses(data);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load passes",
          );
        }
      } finally {
        if (!cancelled) setIsLoadingPasses(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Revalidate the selected pass's data (price, discount, slot counts) every
  // time the selection changes, instead of trusting whatever was in the
  // initial list fetch.
  useEffect(() => {
    if (!selectedPassId) {
      setSelectedPass(null);
      setRevalidateError(null);
      return;
    }

    let cancelled = false;
    setIsRevalidatingPass(true);
    setRevalidateError(null);

    (async () => {
      try {
        const fresh = await passService.getById(selectedPassId);
        if (!cancelled) setSelectedPass(fresh);
      } catch (err) {
        if (!cancelled) {
          setRevalidateError(
            err instanceof Error ? err.message : "Failed to load pass details",
          );
        }
      } finally {
        if (!cancelled) setIsRevalidatingPass(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedPassId]);

  const handlePassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPassId(e.target.value);
    setSelectedGameIds([]); // reset games when pass changes
  };

  const handleToggleGame = (gameId: string) => {
    if (!selectedPass) return;

    setSelectedGameIds((prev) => {
      if (prev.includes(gameId)) {
        return prev.filter((id) => id !== gameId);
      }
      if (prev.length >= selectedPass.requiredSelectionCount) {
        return prev;
      }
      return [...prev, gameId];
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPass) {
      showToast("Please select a game pass first.", "error");
      return;
    }

    if (selectedGameIds.length !== selectedPass.requiredSelectionCount) {
      showToast(
        `Please select exactly ${selectedPass.requiredSelectionCount} games.`,
        "error",
      );
      return;
    }

    if (!name.trim() || name.trim().length < 2) {
      showToast("Please enter a valid name.", "error");
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast("Please enter a valid email address.", "error");
      return;
    }

    if (!phoneNumber.trim() || phoneNumber.length < 5) {
      showToast("Please enter a valid phone number.", "error");
      return;
    }

    setIsSubmitting(true);

    // TODO: replace with a real registration API call (e.g. a registrationService.submit(...))
    const fullPhoneNumber = `${countryCode}${phoneNumber}`;
    const payload = {
      passId: selectedPass.id,
      gameIds: selectedGameIds,
      user: {
        name,
        email,
        phone: fullPhoneNumber,
      },
    };

    setTimeout(() => {
      console.log("Submitted Payload:", payload);
      setIsSubmitting(false);
      setIsSuccess(true);
      showToast("Successfully registered for the Game Pass!", "success");

      setTimeout(() => {
        setIsSuccess(false);
        setSelectedPassId("");
        setSelectedGameIds([]);
        setName("");
        setEmail("");
        setPhoneNumber("");
      }, 3000);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <div className="max-w-3xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white shadow-lg mb-6 shadow-indigo-600/20">
            <Ticket className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            Secure Your Game Pass
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Select your premium bundle and reserve seats for the ultimate game
            night.
          </p>
        </div>

        <motion.div
          layout
          className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden"
        >
          {isLoadingPasses ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-indigo-600" />
              <p className="mt-4 text-sm text-gray-500">Loading passes...</p>
            </div>
          ) : loadError ? (
            <div className="p-12 text-center">
              <p className="text-red-600 font-medium">{loadError}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Try again
              </button>
            </div>
          ) : isSuccess ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-12 text-center"
            >
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 text-green-600 mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Registration Complete!
              </h2>
              <p className="text-gray-600">
                You're all set. We've sent a confirmation email to {email}.
              </p>
            </motion.div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="relative p-6 sm:p-10 space-y-10"
            >
              {/* Pass Selection */}
              {isRevalidatingPass && (
                <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px] flex items-center justify-center rounded-2xl z-10">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                </div>
              )}
              <section className="space-y-4">
                <label
                  htmlFor="pass"
                  className="block text-sm font-semibold text-gray-900"
                >
                  Select Game Pass
                </label>
                <div className="relative">
                  <select
                    id="pass"
                    value={selectedPassId}
                    onChange={handlePassChange}
                    className="block w-full appearance-none rounded-xl border border-gray-300 bg-white px-4 py-3.5 pr-10 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
                  >
                    <option value="" disabled>
                      Choose a pass...
                    </option>
                    {passes.map((pass) => (
                      <option key={pass.id} value={String(pass.id)}>
                        {pass.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>

                <AnimatePresence mode="popLayout">
                  {selectedPassId && isRevalidatingPass && !selectedPass && (
                    <motion.div
                      key="pass-detail-loading"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="rounded-2xl bg-slate-50 p-6 border border-slate-200/60 flex items-center justify-center gap-2 text-sm text-slate-500"
                    >
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading pass details...
                    </motion.div>
                  )}

                  {selectedPassId && revalidateError && (
                    <motion.div
                      key="pass-detail-error"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="rounded-2xl bg-red-50 p-6 border border-red-200 text-sm text-red-600"
                    >
                      {revalidateError}
                    </motion.div>
                  )}

                  {selectedPass && (
                    <motion.div
                      key="pass-detail"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="relative rounded-2xl bg-slate-50 p-6 border border-slate-200/60"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-2">
                          <h3 className="text-lg font-bold text-slate-900">
                            {selectedPass.name}
                          </h3>
                          <p className="text-sm text-slate-600 leading-relaxed max-w-md">
                            {selectedPass.description}
                          </p>
                        </div>
                        <div className="flex flex-col items-start sm:items-end gap-2 bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm">
                          {selectedPass.pricing.hasActiveDiscount &&
                            selectedPass.pricing.discountName && (
                              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                {selectedPass.pricing.discountName}
                              </span>
                            )}
                          <div className="flex items-baseline gap-2">
                            {selectedPass.pricing.hasActiveDiscount ? (
                              <>
                                <span className="text-3xl font-extrabold text-indigo-600">
                                  ₹{selectedPass.pricing.discountedPrice}
                                </span>
                                <span className="text-sm font-medium text-slate-400 line-through">
                                  ₹{selectedPass.pricing.basePrice}
                                </span>
                              </>
                            ) : (
                              <span className="text-3xl font-extrabold text-slate-900">
                                ₹{selectedPass.pricing.basePrice}
                              </span>
                            )}
                          </div>
                          {selectedPass.pricing.hasActiveDiscount &&
                            selectedPass.pricing.discountEndsAtMs && (
                              <CountdownTimer
                                endsAtMs={selectedPass.pricing.discountEndsAtMs}
                              />
                            )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* Games Selection */}
              <AnimatePresence mode="popLayout">
                {selectedPass && (
                  <motion.section
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="py-2 border-t border-gray-100"></div>
                    <GameList
                      pass={selectedPass}
                      selectedGameIds={selectedGameIds}
                      onToggleGame={handleToggleGame}
                    />
                  </motion.section>
                )}
              </AnimatePresence>

              {/* Player Details */}
              <AnimatePresence mode="popLayout">
                {selectedPass && (
                  <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="space-y-6 pt-6 border-t border-gray-100"
                  >
                    <h3 className="text-lg font-semibold text-gray-900">
                      Player Details
                    </h3>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label
                          htmlFor="name"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Full Name
                        </label>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <User className="h-4 w-4 text-gray-400" />
                          </div>
                          <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Alex Doe"
                            className="block w-full rounded-xl border border-gray-300 pl-10 pr-3 py-3 text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label
                          htmlFor="email"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Email Address
                        </label>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Mail className="h-4 w-4 text-gray-400" />
                          </div>
                          <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="alex@example.com"
                            className="block w-full rounded-xl border border-gray-300 pl-10 pr-3 py-3 text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-2 sm:col-span-2">
                        <label
                          htmlFor="phone"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Mobile Number
                        </label>
                        <div className="flex shadow-sm rounded-xl border border-gray-300 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all bg-white overflow-hidden">
                          <div className="relative flex items-center">
                            <select
                              value={countryCode}
                              onChange={(e) => setCountryCode(e.target.value)}
                              className="h-full appearance-none bg-transparent py-3 pl-4 pr-8 text-gray-700 font-medium sm:text-sm focus:outline-none border-r border-gray-300"
                            >
                              {COUNTRY_CODES.map((c) => (
                                <option key={c.code} value={c.code}>
                                  {c.code}
                                </option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                              <ChevronDown className="h-3.5 w-3.5" />
                            </div>
                          </div>
                          <div className="relative flex-1">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                              <Phone className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                              type="tel"
                              id="phone"
                              value={phoneNumber}
                              onChange={(e) =>
                                setPhoneNumber(
                                  e.target.value.replace(/\D/g, ""),
                                )
                              }
                              placeholder="9876543210"
                              className="block w-full border-0 py-3 pl-9 pr-3 text-gray-900 placeholder:text-gray-400 focus:outline-none sm:text-sm bg-transparent"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.section>
                )}
              </AnimatePresence>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={!selectedPass || isSubmitting}
                  className="w-full flex items-center justify-center rounded-xl bg-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.99]"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    "Confirm Registration"
                  )}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
