export interface CharacterDataResponse {
    success: boolean;
    errorcode: number;
    errorstring: string;
    response: CharacterData;
}

export interface CharacterData {
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
    healthValue: number;
    additionalBarInfo: AdditionalBarInfo;
    characterStat: { [key: string]: number };
    characterItems: CharacterItem[];
    primary_trade_skill_1: PrimaryTradeSkill;
    primary_trade_skill_2: PrimaryTradeSkill;
    characterArenaTeamInfo: { [key: string]: CharacterArenaTeamInfo };
    characterFeed: CharacterFeed[];
}

interface AdditionalBarInfo {
    class: string;
    title: string;
    value: number;
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

interface CharacterArenaTeamInfo {
    name: string;
    rank: number;
    rating: number;
    personalrating: number;
}

interface CharacterFeed {
    type: number;
    data: number;
    date: number;
    counter: number;
    name: string;
    Quality?: number;
    icon?: string;
    desc?: string;
    point?: number;
    reward?: string;
    location?: string;
}

interface CharacterItem {
    entry: number;
    guid: number;
    originalicon: string;
    icon: string;
    rarity: number;
    stackcount: number;
    ilevel: number;
    originalname: string;
    name: string;
    transmogid: number;
    transmogitemname: string;
    transmogitemicon: string;
    gems: Gem[];
    ench: Ench;
    queryParams?: string;
}

interface Ench {
    enchantid?: number;
    entry?: number;
    icon?: string;
}

interface Gem {
    enchantid: number;
    id: number;
    gemcolor: number;
    icon: string;
}

interface PrimaryTradeSkill {
    name: string;
    icon: string;
    value: number;
    max: number;
}

interface Skindata {
    skinstyle: number;
    facecolor: number;
    hairstyle: number;
    haircolor: number;
    facialhair: number;
}
