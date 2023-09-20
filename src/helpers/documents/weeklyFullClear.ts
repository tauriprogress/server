import {
    Difficulty,
    Faction,
    MilliSecond,
    RaidLogWithRealm,
    Realm,
    Second,
} from "../../types";
import id, { WeekId } from "../id";
import log from "../log";

import { Document, ObjectId } from "mongodb";

export interface FullClearLog {
    id: number;
    date: Second;
    fightLength: MilliSecond;
    bossName: string;
}

export interface WeeklyFullClearDocument extends Document {
    _id: ObjectId;
    members: string[];
    difficulty: Difficulty;
    guildName: string;
    f: Faction;
    realm: Realm;
    logs: FullClearLog[];
    latestWednesday: WeekId;
}

export type WeeklyFullClear = {
    [key in Difficulty]: WeeklyFullClearDocument[];
};

class WeeklyFullClearDocumentController {
    private _id: ObjectId;
    private difficulty: Difficulty;
    private f: Faction;
    private realm: Realm;
    private logs: FullClearLog[];
    private members: string[];
    private guildName: string;
    private latestWednesday: WeekId;

    constructor(obj: RaidLogWithRealm | WeeklyFullClearDocument) {
        if (this.isWeeklyFullClearDocument(obj)) {
            obj = JSON.parse(JSON.stringify(obj)) as WeeklyFullClearDocument;
            this._id = obj._id;
            this.difficulty = obj.difficulty;
            this.realm = obj.realm;
            this.guildName = obj.guildName;
            this.f = obj.f;
            this.members = obj.members;
            this.logs = obj.logs;
            this.latestWednesday = obj.latestWednesday;
        } else {
            this._id = new ObjectId();
            this.difficulty = obj.difficulty;
            this.realm = obj.realm;
            this.guildName = obj.guilddata.name || "Random";
            this.f = obj.guilddata.faction || log.logFaction(obj);
            this.members = obj.members.map((member) => member.name);
            this.logs = [
                {
                    bossName: obj.encounter_data.encounter_name,
                    date: obj.killtime,
                    fightLength: obj.fight_time,
                    id: obj.log_id,
                },
            ];
            this.latestWednesday = id.weekId(new Date(obj.killtime * 1000));
        }
    }

    getDocument(): WeeklyFullClearDocument {
        return {
            _id: this._id,
            difficulty: this.difficulty,
            f: this.f,
            logs: this.logs,
            members: this.members,
            guildName: this.guildName,
            realm: this.realm,
            latestWednesday: this.latestWednesday,
        };
    }

    isSameRaidGroup(document: WeeklyFullClearDocument): boolean {
        if (
            this.guildName !== document.guildName ||
            this.f !== document.f ||
            this.realm !== document.realm ||
            this.difficulty !== document.difficulty ||
            this.latestWednesday !== document.latestWednesday ||
            !log.sameMembers(this.members, document.members, this.difficulty)
        ) {
            return false;
        }
        return true;
    }

    mergeDocument(document: WeeklyFullClearDocument) {
        this.logs = this.logs
            .concat(document.logs)
            .sort((a, b) => a.date - b.date);
    }

    private isWeeklyFullClearDocument(
        obj: any
    ): obj is WeeklyFullClearDocument {
        if (obj && obj._id) {
            return true;
        }

        return false;
    }
}

export default WeeklyFullClearDocumentController;
