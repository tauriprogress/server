export * from "./character";
export * from "./guild";
export * from "./leaderboardCharacter";
export * from "./raidBoss";
export * from "./weeklyGuildFullClear";
export * from "./weeklyChallenge";
import { characterDocument } from "./character";
import { GuildDocumentController } from "./guild";
import RaidBossDocumentController from "./raidBoss";
import WeeklyGuildFullClearDocumentController from "./weeklyGuildFullClear";
import WeeklyChallengeDocumentController from "./weeklyChallenge";

class DocumentManager {
    weeklyGuildFullClear = WeeklyGuildFullClearDocumentController;
    weeklyChallenge = WeeklyChallengeDocumentController;
    raidBoss = RaidBossDocumentController;
    guild = GuildDocumentController;
    character = characterDocument;
}

const documentManager = new DocumentManager();

export default documentManager;
