"use client";

import { Check } from "lucide-react";
import type { ClientPass } from "@/api/client/services/pass.service"; // adjust to your actual service path

interface GameListProps {
  pass: ClientPass;
  selectedGameIds: string[];
  onToggleGame: (gameId: string) => void;
}

export function GameList({
  pass,
  selectedGameIds,
  onToggleGame,
}: GameListProps) {
  const isSelectionFull = selectedGameIds.length >= pass.requiredSelectionCount;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Select Your Games
        </h3>
        <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {selectedGameIds.length} / {pass.requiredSelectionCount} Selected
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pass.games.map((game) => {
          const isSelected = selectedGameIds.includes(String(game.id));
          const remainingSlots = game.availableSlots;
          const isFull = remainingSlots <= 0;
          const isDisabled = (isSelectionFull && !isSelected) || isFull;

          return (
            <label
              key={game.id}
              className={`relative flex cursor-pointer rounded-xl border-2 p-4 transition-all ${
                isSelected
                  ? "border-indigo-600 bg-indigo-50/50"
                  : isDisabled
                    ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                    : "border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30"
              }`}
            >
              <div className="flex w-full items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-gray-300 bg-white"
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                  </div>
                  <div>
                    <h4
                      className={`font-medium ${isSelected ? "text-indigo-900" : "text-gray-900"}`}
                    >
                      {game.name}
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">{game.genre}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                      <span className="bg-white px-2 py-0.5 rounded border shadow-sm">
                        {game.requiredPlayers} Players
                      </span>
                      <span className="bg-white px-2 py-0.5 rounded border shadow-sm">
                        {game.estimatedRuntimeMinutes}m
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 text-right">
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-md ${
                      isFull
                        ? "bg-red-100 text-red-700"
                        : remainingSlots <= 2
                          ? "bg-orange-100 text-orange-700"
                          : "bg-green-100 text-green-700"
                    }`}
                  >
                    {isFull ? "Full" : `${remainingSlots} slots left`}
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                className="sr-only"
                checked={isSelected}
                disabled={isDisabled}
                onChange={() => onToggleGame(String(game.id))}
              />
            </label>
          );
        })}
      </div>

      {selectedGameIds.length > 0 &&
        selectedGameIds.length < pass.requiredSelectionCount && (
          <p className="text-sm text-amber-600 font-medium">
            Please select {pass.requiredSelectionCount - selectedGameIds.length}{" "}
            more game
            {pass.requiredSelectionCount - selectedGameIds.length > 1
              ? "s"
              : ""}
            .
          </p>
        )}
    </div>
  );
}
