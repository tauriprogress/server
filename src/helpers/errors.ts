export const ERR_UNKNOWN = new Error("Unkown wrong.");

export const ERR_DB_CONNECTION = new Error(
    "Database connection is not established."
);
export const ERR_DB_UPDATING = new Error("Database is already updating.");

export const ERR_GUILD_NOT_FOUND = new Error("Guild not found.");
export const ERR_CHARACTER_NOT_FOUND = new Error("Character not found.");
export const ERR_TAURI_API_FAILURE = new Error("Api request failed.");
export const ERR_TAURI_API_TIMEOUT = new Error("Api request timed out.");

export const ERR_DATA_NOT_EXIST = new Error("No data.");
export const ERR_LOADING = new Error("Loading.");

export const ERR_INVALID_RAID_ID = new Error("Invalid raid ID.");
export const ERR_INVALID_RAID_NAME = new Error("Invalid raid");
export const ERR_INVALID_BOSS_NAME = new Error("Invalid boss name.");
export const ERR_INVALID_GUILD_NAME = new Error("Invalid guild name.");
export const ERR_INVALID_CHARACTER_NAME = new Error("Invalid character name.");
export const ERR_INVALID_CHARACTER_CLASS = new Error("Invalid character class");
export const ERR_INVALID_DIFFICULTY = new Error("Invalid difficulty");
export const ERR_INVALID_COMBAT_METRIC = new Error("Invalid combat metric.");
export const ERR_INVALID_FILTERS = new Error("Invalid filters.");
export const ERR_INVALID_PAGE = new Error("Invalid page.");
export const ERR_INVALID_PAGESIZE = new Error("Invalid page size.");
export const ERR_INVALID_LOG_ID = new Error("Invalid log ID.");
export const ERR_INVALID_LIMIT = new Error("Invalid limit.");
export const ERR_INVALID_LEADERBOARD_ID = new Error("Invalid leaderboard ID");
export const ERR_INVALID_ITEM_IDS = new Error("Invalid item ids.");
