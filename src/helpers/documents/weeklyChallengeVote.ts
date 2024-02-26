import { id } from "..";
import { PatreonUserId } from "../../types";

import { Document } from "mongodb";
import { WeekId } from "../id";

export interface WeeklyChallengeVoteDocument extends Document {
    _id: ReturnType<typeof id.weeklyChallengeVoteId>;
    userId: PatreonUserId;
    weekId: WeekId;
    bossName: string;
    timestamp: number;
    weight: number;
}

export class WeeklyChallengeVoteDocumentController {
    private _id: ReturnType<typeof id.weeklyChallengeVoteId>;
    private userId: PatreonUserId;
    private weekId: WeekId;
    private bossName: string;
    private weight: number;

    constructor(
        obj:
            | { userId: string; isMember: boolean; bossName: string }
            | WeeklyChallengeVoteDocument
    ) {
        if (this.isVoteDocument(obj)) {
            obj = JSON.parse(
                JSON.stringify(obj)
            ) as WeeklyChallengeVoteDocument;

            this._id = obj._id;
            this.userId = obj.userId;
            this.weekId = obj.weekId;
            this.bossName = obj.bossName;
            this.weight = obj.weight;
        } else {
            const weekId = id.weekId(new Date());
            this._id = id.weeklyChallengeVoteId(obj.userId, weekId);
            this.userId = obj.userId;
            this.weekId = weekId;
            this.bossName = obj.bossName;
            this.weight = obj.isMember ? 100 : 20;
        }
    }

    getDocument(): WeeklyChallengeVoteDocument {
        return {
            _id: this._id,
            userId: this.userId,
            weekId: this.weekId,
            bossName: this.bossName,
            weight: this.weight,
            timestamp: new Date().getTime(),
        };
    }

    isVoteDocument(obj: any): obj is WeeklyChallengeVoteDocument {
        if (obj && obj._id) {
            return true;
        }
        return false;
    }
}

export default WeeklyChallengeVoteDocumentController;
