import environment from "../../environment";
import {
    Difficulty,
    Faction,
    MilliSecond,
    RaidLogWithRealm,
    Realm,
    Second,
} from "../../types";

import { Document, ObjectId } from "mongodb";
import log from "../log";
import id, { WeekId } from "../id";

export interface FullClearLog {
    id: number;
    date: Second;
    fightLength: MilliSecond;
    bossName: string;
}

export interface WeeklyGuildFullClearDocument extends Document {
    _id: string;
    members: string[];
    difficulty: Difficulty;
    guildName: string;
    f: Faction;
    realm: Realm;
    logs: FullClearLog[];
    latestWednesday: WeekId;
    time: number | false;
}

export class WeeklyGuildFullClearDocumentController {
    private _id: string;
    private difficulty: Difficulty;
    private f: Faction;
    private realm: Realm;
    private logs: FullClearLog[];
    private members: string[];
    private guildName: string;
    private latestWednesday: string;
    private time: number | false;

    constructor(obj: RaidLogWithRealm | WeeklyGuildFullClearDocument) {
        if (this.isWeeklyGuildFullClearDocument(obj)) {
            obj = JSON.parse(
                JSON.stringify(obj)
            ) as WeeklyGuildFullClearDocument;
            this._id = obj._id;
            this.difficulty = obj.difficulty;
            this.realm = obj.realm;
            this.guildName = obj.guildName;
            this.f = obj.f;
            this.members = obj.members;
            this.logs = obj.logs;
            this.latestWednesday = obj.latestWednesday;
            this.time = obj.time;
        } else {
            this._id = new ObjectId().toString();
            this.difficulty = obj.difficulty;
            this.realm = obj.realm;
            this.guildName = obj.guilddata.name || "Random";
            this.f = log.logFaction(obj);
            this.members = obj.members.map((member) => member.name);
            this.logs = [
                {
                    bossName: obj.encounter_data.encounter_name,
                    date: obj.killtime,
                    fightLength: obj.fight_time,
                    id: obj.log_id,
                },
            ];
            this.latestWednesday = id.weekId(
                new Date(new Date(obj.killtime * 1000))
            );
            this.time = false;
        }

        this.refreshTime();
    }

    getDocument(): WeeklyGuildFullClearDocument {
        return {
            _id: this._id,
            difficulty: this.difficulty,
            f: this.f,
            logs: this.logs,
            members: this.members,
            guildName: this.guildName,
            realm: this.realm,
            latestWednesday: this.latestWednesday,
            time: this.time,
        };
    }

    isSameRaidGroup(document: WeeklyGuildFullClearDocument): boolean {
        if (
            this.time ||
            this.guildName !== document.guildName ||
            this.f !== document.f ||
            this.realm !== document.realm ||
            this.difficulty !== document.difficulty ||
            this.latestWednesday !== document.latestWednesday ||
            !log.sameMembers(this.members, document.members)
        ) {
            return false;
        }
        return true;
    }

    mergeDocument(document: WeeklyGuildFullClearDocument) {
        this.logs = this.logs
            .concat(document.logs)
            .sort((a, b) => a.date - b.date);

        this.refreshTime();
    }

    private refreshTime() {
        const raidInfo = environment.getRaidInfoFromId(
            environment.getCurrentRaidId()
        );

        let completion: { [propName: string]: boolean } = {};
        for (const bossInfo of raidInfo.bosses) {
            completion[bossInfo.name] = false;
        }

        for (const log of this.logs) {
            completion[log.bossName] = true;
        }

        let completed = true;
        for (const bossName in completion) {
            if (!completion[bossName]) {
                completed = false;
            }
        }

        if (completed) {
            this.time =
                (this.logs[this.logs.length - 1].date -
                    (this.logs[0].date - this.logs[0].fightLength / 1000)) *
                1000;
        }
    }

    private isWeeklyGuildFullClearDocument(
        obj: any
    ): obj is WeeklyGuildFullClearDocument {
        if (obj && obj._id) {
            return true;
        }

        return false;
    }
}

export default WeeklyGuildFullClearDocumentController;
