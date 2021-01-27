export interface CharacterAchievementsResponse {
    success: boolean;
    errorcode: number;
    errorstring: string;
    response: CharacterAchievements;
}

export interface CharacterAchievements {
    isCata: boolean;
    expansion: number;
    realm: string;
    dataUrlPrefix: string;
    guid: number;
    class: number;
    race: number;
    name: string;
    titleName: string;
    urlName: string;
    level: number;
    gender: number;
    portrait_path: string;
    pts: number;
    faction_string_class: string;
    guildName: string;
    guildLinkName: string;
    arenaTeam2v2id: number;
    arenaTeam3v3id: number;
    arenaTeam5v5id: number;
    dualSpec: boolean;
    activeSpec: number;
    talents_builds_0: string;
    treeName_0: string;
    treeIcon_0: string;
    talents_0: string;
    ds_0: string[];
    talents_builds_1: string;
    treeName_1: string;
    treeIcon_1: string;
    talents_1: string;
    ds_1: string[];
    disabledDS_1: boolean;
    playerHonorKills: number;
    title: string;
    tname: string;
    isBookmarked: boolean;
    characterArenaTeamInfoButton: boolean;
    character_url_string: string;
    avgitemlevel: number;
    skindata: Skindata;
    challengemode: { [key: string]: Challengemode };
    categories: { [key: string]: Category };
    SummaryAchievement: { [key: string]: number };
    SummaryEarnAchievement: { [key: string]: number };
    AchievementsCache: { [key: string]: AchievementsCache };
    Achievements: { [key: string]: Achievement };
}

interface Achievement {
    name: string;
    date: number;
    catid: number;
}

interface AchievementsCache {
    icon: string;
    name: string;
    desc: string;
    pts: number;
    reward: string;
}

interface Category {
    info: Info;
    subcat?: { [key: string]: Info };
}

interface Info {
    id: number;
    pid: number;
    name: string;
    order: number;
}

interface Challengemode {
    completiontime: number;
    completedtime: number;
    medal: number;
    playerrank: number;
    guildrank: number;
    players: Player[];
    guildinfo: Guildinfo;
}

interface Guildinfo {
    name: string;
    faction: number;
    leadername: string;
}

interface Player {
    specializationid?: number;
    specializationrole?: number;
    specializationname?: string;
    specializationicon?: string;
    playerinfo?: Playerinfo;
}

interface Playerinfo {
    charname: string;
    race: number;
    class: number;
    gender: number;
    guildname: string;
    level: number;
    faction: number;
}

interface Skindata {
    skinstyle: number;
    facecolor: number;
    hairstyle: number;
    haircolor: number;
    facialhair: number;
}
