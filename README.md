# AML Discord Bot

Live Discord commands for the Apollo Madden League, powered by the same Madden 27 data feed as the AML website.

## Commands

- `/stats [category]` — weekly passing, rushing, receiving, defense, kicking, punting, or team leaders
- `/roster team` — roster for any AML team
- `/standings [division]` — league or division standings
- `/scores [week]` — completed scores by week
- `/schedule team [week]` — a team's schedule
- `/player name` — player profile and ratings
- `/rivalries` — Season 14 rivalry records
- `/help` — command guide
- `/create-game-channels week` — owner only; creates matchup channels from the imported schedule for weeks 1–23, including playoffs. Use `week:19` for Wild Card. Later rounds must be exported from Madden before their channels can be created. Existing categories and matchup channels are reused.

## Required Railway variables

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID` (recommended so command updates appear immediately)

`AML_API_BASE` is optional and defaults to the existing AML public data endpoint.
