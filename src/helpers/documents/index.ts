export * from "./character";
export * from "./raidBoss";
export * from "./guild";
export * from "./maintenance";
import { characterDocument } from "./character";
import { GuildDocumentController } from "./guild";
import RaidBossDocumentController from "./raidBoss";
import WeeklyFullClearDocumentController from "./weeklyFullClear";

class DocumentManager {
    weeklyFullClear = WeeklyFullClearDocumentController;
    raidBoss = RaidBossDocumentController;
    guild = GuildDocumentController;
    character = characterDocument;
}

const documentManager = new DocumentManager();

export default documentManager;
