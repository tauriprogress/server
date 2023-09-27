import { ClassId, Difficulty, Realm } from "../../types";

import { WithId } from "mongodb";
import environment from "../../environment";
import {
    CharacterDocument,
    LeaderboardCharacterDocument,
    RaidBossDocument,
    addNestedObjectValue,
    capitalize,
    id,
} from "../../helpers";
import documentManager from "../../helpers/documents";
import dbInterface from "../DBInterface";

export async function resetCharacter(
    characterName: string,
    realm: Realm,
    classId: ClassId
) {
    await dbInterface.maintenance.start();
    const db = dbInterface.maintenance.getConnection();

    for (const raid of environment.currentContent.raids) {
        for (const boss of raid.bosses) {
            for (const diff in boss.bossIdOfDifficulty) {
                const difficulty = Number(diff) as Difficulty;
                for (const combatMetric of environment.combatMetrics) {
                    const ingameBossId =
                        boss.bossIdOfDifficulty[
                            difficulty as keyof typeof boss.bossIdOfDifficulty
                        ];
                    const collectionName = id.characterDocumentCollectionId(
                        ingameBossId,
                        difficulty,
                        combatMetric
                    );

                    const collection =
                        db.collection<CharacterDocument>(collectionName);

                    await collection.deleteMany({
                        name: characterName,
                        class: classId,
                        realm: realm,
                    });
                }
            }
        }
    }

    for (const combatMetric of environment.combatMetrics) {
        const collection = db.collection<LeaderboardCharacterDocument>(
            combatMetric === "dps"
                ? dbInterface.collections.characterLeaderboardDps
                : dbInterface.collections.characterLeaderboardHps
        );

        await collection.deleteMany({
            name: characterName,
            class: classId,
            realm: realm,
        });
    }

    const raidCollection = db.collection<RaidBossDocument>(
        dbInterface.collections.raidBosses
    );
    const raidbosses = await raidCollection.find().toArray();

    for (let raidBossDocument of raidbosses) {
        for (const combatMetric of environment.combatMetrics) {
            let changed = false;

            const key = `best${capitalize(combatMetric)}` as const;

            const categorizedCharacters = raidBossDocument[key];

            for (const faction of environment.factions) {
                for (const specId of environment.specIdsOfClass[classId]) {
                    let updateCharacters = false;

                    const characterDocuments =
                        categorizedCharacters?.[realm]?.[faction]?.[classId]?.[
                            specId
                        ] || [];

                    for (let char of characterDocuments) {
                        if (char.name === characterName) {
                            updateCharacters = true;
                        }
                    }

                    if (updateCharacters) {
                        const [ingameBossId, difficulty] =
                            id.deconstruct.raidBossId(raidBossDocument._id);

                        const characters = await db
                            .collection<CharacterDocument>(
                                id.characterDocumentCollectionId(
                                    ingameBossId,
                                    difficulty,
                                    combatMetric
                                )
                            )
                            .aggregate([
                                {
                                    $match: {
                                        realm: realm,
                                        faction: faction,
                                        class: classId,
                                        specId: specId,
                                    },
                                },
                                { $sort: { combatMetric: 1 } },
                                { $limit: 10 },
                            ])
                            .toArray();

                        if (characters) {
                            raidBossDocument = addNestedObjectValue(
                                raidBossDocument,
                                [key, realm, faction, classId, specId],
                                characters
                            ) as WithId<RaidBossDocument>;
                            changed = true;
                        }
                    }
                }
            }

            const bestKey = `best${capitalize(combatMetric)}NoCat` as const;
            const bestNoCat = raidBossDocument[bestKey];

            if (
                bestNoCat &&
                bestNoCat.name === characterName &&
                bestNoCat.realm === realm &&
                bestNoCat.class === classId
            ) {
                const raidBossDocumentManager = new documentManager.raidBoss(
                    raidBossDocument
                );

                const best =
                    raidBossDocumentManager.getBestPerformance(combatMetric);
                raidBossDocument[bestKey] = best;
                changed = true;
            }

            if (changed) {
                await raidCollection.updateOne(
                    {
                        _id: raidBossDocument._id,
                    },
                    {
                        $set: raidBossDocument,
                    }
                );
            }
        }
    }

    return "done";
}
