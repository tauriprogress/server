import environment from "../environment";
import { Difficulty } from "../types";

class Logs {
    sameMembers(
        members1: string[],
        members2: string[],
        difficulty: Difficulty
    ): boolean {
        const diffNum = environment.difficultyNames[
            difficulty as keyof typeof environment.difficultyNames
        ].includes("10")
            ? 10
            : 25;

        let memberContainer: { [propName: string]: boolean } = {};
        let sameMemberCount = 0;

        for (let name of members1) {
            memberContainer[name] = true;
        }

        for (let name of members2) {
            if (memberContainer[name]) {
                sameMemberCount++;
            }
        }

        return diffNum * 0.8 <= sameMemberCount;
    }
}

export const logs = new Logs();

export default logs;
