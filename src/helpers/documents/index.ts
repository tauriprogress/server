export * from "./character";
export * from "./guild";
export * from "./leaderboardCharacter";
export * from "./raidBoss";
export * from "./weeklyGuildFullClear";
import { characterDocument } from "./character";
import { GuildDocumentController } from "./guild";
import RaidBossDocumentController from "./raidBoss";
import WeeklyGuildFullClearDocumentController from "./weeklyGuildFullClear";

class DocumentManager {
    weeklyGuildFullClear = WeeklyGuildFullClearDocumentController;
    raidBoss = RaidBossDocumentController;
    guild = GuildDocumentController;
    character = characterDocument;
}

const documentManager = new DocumentManager();

export default documentManager;
