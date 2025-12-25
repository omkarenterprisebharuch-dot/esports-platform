"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TournamentWithHost } from "@/types";
import { useRegistrationCache } from "@/hooks/useRegistrationCache";
import { secureFetch } from "@/lib/api-client";

export default function DashboardPage() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<TournamentWithHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  
  // Use cached registration IDs instead of fetching on every page load
  const { registeredIds } = useRegistrationCache();

  const fetchTournaments = useCallback(() => {
    setLoading(true);

    // Handle "registered" filter client-side using cached data
    if (filter === "registered") {
      secureFetch("/api/tournaments")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            const allTournaments = data.data.tournaments || [];
            const registered = allTournaments.filter((t: TournamentWithHost) => 
              registeredIds.has(t.id)
            );
            setTournaments(registered);
          }
        })
        .finally(() => setLoading(false));
      return;
    }

    const url =
      filter === "all"
        ? "/api/tournaments"
        : `/api/tournaments?filter=${filter}`;

    secureFetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTournaments(data.data.tournaments || []);
        }
      })
      .finally(() => setLoading(false));
  }, [filter, registeredIds]);

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  const formatDate = (dateString: Date | string) => {
    if (!dateString) return "TBD";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getGameEmoji = (gameType: string) => {
    const emojis: Record<string, string> = {
      freefire: "🔥",
      pubg: "🎯",
      valorant: "⚔️",
      codm: "🔫",
    };
    return emojis[gameType] || "🎮";
  };

  const getStatusStyle = (status: string) => {
    const styles: Record<string, string> = {
      upcoming: "bg-indigo-100 text-indigo-700",
      registration_open: "bg-green-100 text-green-700",
      ongoing: "bg-yellow-100 text-yellow-700",
      completed: "bg-gray-100 text-gray-700",
    };
    return styles[status] || styles.upcoming;
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">All Tournaments</h1>

        <div className="flex gap-2 flex-wrap">
          {[
            { value: "all", label: "All" },
            { value: "registered", label: "Registered" },
            { value: "live", label: "Live" },
            { value: "upcoming", label: "Upcoming" },
            { value: "ongoing", label: "Ongoing" },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setFilter(item.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === item.value
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full"></div>
        </div>
      ) : tournaments.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-500">No tournaments found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tournaments.map((tournament) => (
            <Link key={tournament.id} href={`/tournament/${tournament.id}`}>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:scale-[1.02] transition cursor-pointer h-full">
                <div className="relative h-40 bg-gray-100 flex items-center justify-center">
                  <span className="text-5xl">
                    {getGameEmoji(tournament.game_type)}
                  </span>
                  <span
                    className={`absolute top-3 right-3 px-2 py-1 rounded text-xs font-semibold uppercase ${getStatusStyle(tournament.status)}`}
                  >
                    {tournament.status.replace("_", " ")}
                  </span>
                  <span className="absolute top-3 left-3 bg-black/60 text-white px-2 py-1 rounded-full text-xs uppercase">
                    {tournament.game_type}
                  </span>
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 truncate mb-1">
                    {tournament.tournament_name}
                  </h3>
                  <p className="text-sm text-gray-500 mb-3">
                    by {tournament.host_name}
                  </p>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-500">Prize</p>
                      <p className="font-bold text-green-600">
                        ₹{tournament.prize_pool}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-500">Entry</p>
                      <p className="font-bold text-gray-900">
                        {tournament.entry_fee > 0
                          ? `₹${tournament.entry_fee}`
                          : "Free"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span>
                      {tournament.current_teams}/{tournament.max_teams} Teams
                    </span>
                    <span>📅 {formatDate(tournament.tournament_start_date)}</span>
                  </div>

                  {/* Registration Status */}
                  {registeredIds.has(tournament.id) ? (
                    <div className="py-2 bg-blue-100 text-blue-700 font-medium rounded-lg text-sm text-center">
                      ✓ You & your team is already registered
                    </div>
                  ) : (() => {
                    const now = new Date();
                    const regStart = new Date(tournament.registration_start_date);
                    const regEnd = new Date(tournament.registration_end_date);
                    const isOpen = now >= regStart && now < regEnd;
                    const hasSpots = tournament.current_teams < tournament.max_teams;
                    
                    if (isOpen && hasSpots) {
                      return (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            router.push(`/register-tournament/${tournament.id}`);
                          }}
                          className="w-full py-2 bg-green-600 text-white font-medium rounded-lg text-sm hover:bg-green-700 transition"
                        >
                          Register Now
                        </button>
                      );
                    } else if (now < regStart) {
                      return (
                        <div className="py-2 bg-gray-100 text-gray-500 font-medium rounded-lg text-sm text-center">
                          Coming Soon
                        </div>
                      );
                    } else if (!hasSpots) {
                      return (
                        <div className="py-2 bg-gray-100 text-gray-500 font-medium rounded-lg text-sm text-center">
                          Full
                        </div>
                      );
                    } else {
                      return (
                        <div className="py-2 bg-gray-100 text-gray-500 font-medium rounded-lg text-sm text-center">
                          Closed
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
