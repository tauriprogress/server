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

    constructor(obj: WeeklyChallengeVoteDocument) {
        this._id = obj._id;
        this.userId = obj.userId;
        this.weekId = obj.weekId;
        this.bossName = obj.bossName;
        this.weight = obj.weight;
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

    changeVote(bossName: string, weight: number) {
        this.bossName = bossName;
        this.weight = weight;
    }
}

export default WeeklyChallengeVoteDocumentController;
