import {
    Realm,
    ClassId,
    CharacterDocument,
    LeaderboardCharacterDocument,
    RaidBossDocument,
    CombatMetric,
} from "../../types";
import db from "../";

import {
    capitalize,
    getCharacterDocumentCollectionId,
    getDeconstructedRaidBossId,
    getRaidBossBest,
} from "../../helpers";
import environment from "../../environment";
import { ERR_DB_CONNECTION } from "../../helpers/errors";
import { factions } from "../../constants";

export async function resetCharacter(
    characterName: string,
    realm: Realm,
    classId: ClassId
) {
    await db.connect();
    if (!db.connection) throw ERR_DB_CONNECTION;

    for (const raid of environment.currentContent.raids) {
        for (const boss of raid.bosses) {
            for (const difficulty in boss.bossIdOfDifficulty) {
                for (const combatMetric of ["dps", "hps"]) {
                    const ingameBossId =
                        boss.bossIdOfDifficulty[
                            difficulty as keyof typeof boss.bossIdOfDifficulty
                        ];
                    const collectionName = getCharacterDocumentCollectionId(
                        ingameBossId,
                        Number(difficulty),
                        combatMetric
                    );

                    const collection =
                        db.connection.collection<CharacterDocument>(
                            collectionName
                        );

                    await collection.deleteMany({
                        name: characterName,
                        class: classId,
                        realm: realm,
                    });
                }
            }
        }
    }

    for (const combatMetric of ["dps", "hps"]) {
        const collection =
            db.connection.collection<LeaderboardCharacterDocument>(
                combatMetric === "dps"
                    ? db.collections.characterLeaderboardDps
                    : db.collections.characterLeaderboardHps
            );

        await collection.deleteMany({
            name: characterName,
            class: classId,
            realm: realm,
        });
    }

    const raidCollection = db.connection.collection<RaidBossDocument>(
        db.collections.raidBosses
    );
    const raidbosses = await raidCollection.find().toArray();

    for (let raidBossDocument of raidbosses) {
        for (const combatMetric of ["dps", "hps"]) {
            let changed = false;

            const key = `best${capitalize(combatMetric)}` as const;

            const categorizedCharacters = raidBossDocument[key];

            for (const faction of factions) {
                for (const specId of environment.characterClassSpecs[classId]) {
                    let updateCharacters = false;

                    for (let char of categorizedCharacters?.[realm]?.[
                        faction
                    ]?.[classId]?.[specId]) {
                        if (char.name === characterName) {
                            updateCharacters = true;
                        }
                    }

                    if (updateCharacters) {
                        const [ingameBossId, difficulty] =
                            getDeconstructedRaidBossId(raidBossDocument._id);

                        const characters = await db.connection
                            .collection<CharacterDocument>(
                                getCharacterDocumentCollectionId(
                                    ingameBossId,
                                    Number(difficulty),
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
                            raidBossDocument[key][realm][faction][classId][
                                specId
                            ] = characters;
                            changed = true;
                        }
                    }
                }
            }

            const bestKey = `best${capitalize(combatMetric)}NoCat` as const;
            const bestNoCat = raidBossDocument[bestKey];

            if (
                bestNoCat.name === characterName &&
                bestNoCat.realm === realm &&
                bestNoCat.class === classId
            ) {
                const best = getRaidBossBest(
                    raidBossDocument,
                    combatMetric as CombatMetric
                );
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