import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createTeamIdentity } from "./team-identity.mjs";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=30, s-maxage=30",
};

const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: cors });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: cors });
  if (req.method !== "GET") return respond({ ok: false, error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const marker = "/aml-public-data";
  const idx = url.pathname.indexOf(marker);
  const route = idx >= 0 ? (url.pathname.slice(idx + marker.length) || "/") : url.pathname;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let identity = createTeamIdentity();
  const ok = (data: unknown, status = 200) => respond(identity.normalizePayload(data), status);

  try {
    if (route === "/" || route === "/health") {
      return ok({ ok: true, service: "AML public Madden data API", leagueId: 2052431 });
    }

    const { data: identityTeams, error: identityError } = await supabase
      .from("madden_teams")
      .select("team_id,div_name,abbr_name,city_name,nick_name,display_name,user_name,ovr_rating,logo_id,primary_color,secondary_color,updated_at")
      .order("div_name")
      .order("display_name");
    if (identityError) throw identityError;
    identity = createTeamIdentity(identityTeams || []);

    if (route === "/teams") {
      return ok({ ok: true, count: identityTeams.length, teams: identityTeams });
    }

    if (route === "/standings") {
      const { data, error } = await supabase
        .from("aml_current_standings")
        .select("team_id,team_name,display_name,abbr_name,user_name,conference_name,division_name,total_wins,total_losses,total_ties,win_pct,pts_for,pts_against,net_pts,rank,seed,playoff_status,team_ovr,week_index,calendar_year,primary_color,secondary_color,updated_at")
        .order("conference_name")
        .order("division_name")
        .order("total_wins", { ascending: false })
        .order("total_losses", { ascending: true });
      if (error) throw error;
      return ok({ ok: true, count: data.length, standings: data });
    }

    if (route === "/players" || route === "/roster") {
      const teamId = url.searchParams.get("teamId");
      const position = url.searchParams.get("position");
      const minOvr = Number(url.searchParams.get("minOvr") || 0);
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 2000), 1), 2500);

      let q = supabase
        .from("aml_roster")
        .select("roster_id,team_id,team_name,team_city,team_nickname,first_name,last_name,position,jersey_num,age,height,weight,college,years_pro,is_active,is_free_agent,is_on_ir,is_on_practice_squad,player_best_ovr,player_scheme_ovr,team_scheme_ovr,dev_trait,speed_rating,accel_rating,agility_rating,aware_rating,strength_rating,stamina_rating,injury_rating,throw_power_rating,throw_acc_short_rating,throw_acc_mid_rating,throw_acc_deep_rating,catch_rating,carry_rating,route_run_short_rating,route_run_med_rating,route_run_deep_rating,tackle_rating,hit_power_rating,man_cover_rating,zone_cover_rating,press_rating,block_shed_rating,finesse_moves_rating,power_moves_rating,kick_power_rating,kick_acc_rating,contract_years_left,cap_hit,injury_type,injury_length,updated_at")
        .gte("player_best_ovr", minOvr)
        .order("player_best_ovr", { ascending: false })
        .order("last_name")
        .limit(limit);

      if (teamId) q = q.in("team_id", identity.teamIdsFor(teamId));
      if (position) q = q.eq("position", position);

      const { data, error } = await q;
      if (error) throw error;
      return ok({ ok: true, count: data.length, players: data });
    }

    if (route.startsWith("/player/")) {
      const rosterId = Number(route.split("/").pop());
      const { data, error } = await supabase
        .from("madden_players")
        .select("*")
        .eq("roster_id", rosterId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return ok({ ok: false, error: "Player not found" }, 404);
      return ok({ ok: true, player: data });
    }

    if (route.startsWith("/player-stats/")) {
      const rosterId = Number(route.split("/").pop());
      if (!Number.isFinite(rosterId) || rosterId <= 0) {
        return ok({ ok: false, error: "Invalid player ID" }, 400);
      }

      const { data, error } = await supabase
        .from("madden_weekly_exports")
        .select("category,week_index,items")
        .eq("success", true)
        .order("week_index", { ascending: true });
      if (error) throw error;

      const stats = (data || []).flatMap((entry) => {
        if (!Array.isArray(entry.items)) return [];
        return entry.items
          .filter((item: Record<string, unknown>) => Number(item.rosterId) === rosterId)
          .map((item: Record<string, unknown>) => ({
            category: entry.category,
            week_index: Number(item.weekIndex ?? entry.week_index),
            stats: item,
          }));
      });

      return ok({ ok: true, roster_id: rosterId, count: stats.length, stats });
    }

    if (route.startsWith("/game/")) {
      const scheduleId = Number(route.split("/").pop());
      if (!Number.isFinite(scheduleId) || scheduleId <= 0) {
        return ok({ ok: false, error: "Invalid game ID" }, 400);
      }

      const { data: game, error: gameError } = await supabase
        .from("madden_games")
        .select("schedule_id,season_index,stage_index,week_index,away_team_id,home_team_id,away_score,home_score,status,is_game_of_the_week")
        .eq("schedule_id", scheduleId)
        .maybeSingle();
      if (gameError) throw gameError;
      if (!game) return ok({ ok: false, error: "Game not found" }, 404);

      const [{ data: teams, error: teamsError }, { data: exports, error: statsError }] = await Promise.all([
        supabase.from("madden_teams").select("team_id,display_name,abbr_name,nick_name,user_name,primary_color,secondary_color").in("team_id", [game.away_team_id, game.home_team_id]),
        supabase.from("madden_weekly_exports").select("category,items").eq("success", true),
      ]);
      if (teamsError) throw teamsError;
      if (statsError) throw statsError;

      const stats = (exports || []).flatMap((entry) => {
        if (!Array.isArray(entry.items)) return [];
        return entry.items
          .filter((item: Record<string, unknown>) => Number(item.scheduleId) === scheduleId)
          .map((item: Record<string, unknown>) => ({ category: entry.category, stats: item }));
      });

      return ok({ ok: true, game, teams: teams || [], count: stats.length, stats });
    }

    if (route === "/schedule") {
      const week = url.searchParams.get("week");
      let q = supabase
        .from("aml_schedule")
        .select("schedule_id,season_index,stage_index,week_index,away_team_id,home_team_id,away_team_name,home_team_name,away_abbr,home_abbr,away_score,home_score,status,is_game_of_the_week,updated_at")
        .order("stage_index")
        .order("week_index")
        .order("schedule_id");
      if (week !== null) q = q.eq("week_index", Number(week));
      const { data, error } = await q;
      if (error) throw error;
      return ok({ ok: true, count: data.length, games: data });
    }

    if (route === "/weekly") {
      const category = url.searchParams.get("category");
      const week = url.searchParams.get("week");
      let q = supabase
        .from("madden_weekly_exports")
        .select("league_id,category,season_type,week_index,success,message,item_count,items,updated_at")
        .order("week_index", { ascending: false });
      if (category) q = q.eq("category", category);
      if (week !== null) q = q.eq("week_index", Number(week));
      const { data, error } = await q;
      if (error) throw error;
      return ok({ ok: true, count: data.length, exports: data });
    }

    return ok({ ok: false, error: "Not found" }, 404);
  } catch (error) {
    console.error(error);
    return ok({ ok: false, error: "Data query failed" }, 500);
  }
});
