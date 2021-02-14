import { RaidBoss } from "..";
import { ObjectId } from "mongodb";

export interface DbRaidBoss {
    _id: ObjectId;
    name: string;
    [propName: number]: RaidBoss;
}
