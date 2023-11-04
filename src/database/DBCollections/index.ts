import { DatabaseInterface } from "./../DBInterface/index";
import { generateCharacterDocumentCollections } from "./CharacterDocumentCollection";
import { characterLeaderboardDpsCollectionMetaData } from "./CharacterLeaderboardDpsCollection";
import { characterLeaderboardHpsCollectionMetaData } from "./CharacterLeaderboardHpsCollection";
import { guildsCollectionMetaData } from "./DBGuildsCollection";
import { maintenanceCollectionMetaData } from "./DBMaintenanceCollection";
import { raidBossesCollectionMetaData } from "./DBRaidBossesCollection";
import { weeklyGuildFullClearCollectionMetaData } from "./DBWeeklyGuildFullClearCollection";
import { weeklyChallengeCollectionMetaData } from "./WeeklyChallenge";

export function createCollections(db: DatabaseInterface) {
    return {
        guilds: new guildsCollectionMetaData.classConstructor(
            db,
            guildsCollectionMetaData
        ),
        maintenance: new maintenanceCollectionMetaData.classConstructor(
            db,
            maintenanceCollectionMetaData
        ),
        raidBosses: new raidBossesCollectionMetaData.classConstructor(
            db,
            raidBossesCollectionMetaData
        ),
        weeklyGuildFullClear:
            new weeklyGuildFullClearCollectionMetaData.classConstructor(
                db,
                weeklyGuildFullClearCollectionMetaData
            ),
        weeklyChallenge: new weeklyChallengeCollectionMetaData.classConstructor(
            db,
            weeklyChallengeCollectionMetaData
        ),
        characterLeaderboardDps:
            new characterLeaderboardDpsCollectionMetaData.classConstructor(
                db,
                characterLeaderboardDpsCollectionMetaData
            ),
        characterLeaderboardHps:
            new characterLeaderboardHpsCollectionMetaData.classConstructor(
                db,
                characterLeaderboardHpsCollectionMetaData
            ),
        ...generateCharacterDocumentCollections(db),
    } as const;
}
