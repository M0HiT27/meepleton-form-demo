"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

export function CountdownTimer({ endsAtMs }: { endsAtMs: number }) {
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(endsAtMs));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(endsAtMs));
    }, 1000);
    return () => clearInterval(timer);
  }, [endsAtMs]);

  if (timeLeft.total <= 0) {
    return (
      <span className="text-red-500 font-semibold text-sm">Offer Expired</span>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs font-mono bg-red-50 text-red-700 px-2.5 py-1 rounded-full border border-red-200 shadow-sm">
      <Clock className="w-3.5 h-3.5" />
      <span>{timeLeft.days}d</span>
      <span>{timeLeft.hours.toString().padStart(2, "0")}h</span>
      <span>{timeLeft.minutes.toString().padStart(2, "0")}m</span>
      <span>{timeLeft.seconds.toString().padStart(2, "0")}s</span>
    </div>
  );
}

function calculateTimeLeft(endsAtMs: number) {
  // Explicitly calculate current time in Asia/Kolkata
  const now = new Date();

  // Format the current UTC time into a string representing Kolkata time
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const kolkataTimeStr = formatter.format(now);
  // Parse that string back into a timestamp (this gives us the equivalent local time timestamp)
  const kolkataNow = new Date(kolkataTimeStr).getTime();

  const difference = endsAtMs - kolkataNow;

  let timeLeft = {
    total: difference,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  };

  if (difference > 0) {
    timeLeft = {
      total: difference,
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  }
  return timeLeft;
}
