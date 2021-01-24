export interface Item {
    success: boolean;
    errorcode: number;
    errorstring: string;
    response: Response;
}

export interface Response {
    isCata: boolean;
    expansion: number;
    dataUrlPrefix: string;
    SocketContainedMask: number;
    curDurability: number;
    creatorName: string;
    pernamentEnchDesc: string;
    SocketBonusDesc: string;
    AllowedClassesStr: string;
    AllowedRacesStr: string;
    ReqSkillStr: string;
    ReqSkillRank: number;
    SocketContainedGem: SocketContainedGem[];
    ID: number;
    _Class: number;
    _SubClass: number;
    DisplayId: number;
    InventoryType: number;
    Quality_orig: number;
    Quality: number;
    Flags: number;
    Flags2: number;
    Flags3: number;
    BuyCount: number;
    BuyPrice: number;
    SellPrice: number;
    ItemLevel: number;
    MaxCount: number;
    Stackable: number;
    ContainerSlots: number;
    ScalingStatDistribution: number;
    Delay: number;
    RangedModRange: number;
    Bonding: number;
    originalname: string;
    name: string;
    Description: string;
    RandomProperty: number;
    RandomSuffix: number;
    ItemSet: number;
    SocketBonus: number;
    GemProperties: number;
    m_inventoryIconOriginal: string;
    m_inventoryIcon: string;
    m_className: string;
    m_subClassName: string;
    BaseMinDamage: number;
    BaseMaxDamage: number;
    BaseTypeDamage: number;
    ExtraMinDamage: number;
    ExtraMaxDamage: number;
    ExtraTypeDamage: number;
    MaxDurability: number;
    RequiredLevel: number;
    RequiredSkill: number;
    RequiredSkillRank: number;
    RequiredSpell: number;
    RequiredHonorRank: number;
    RequiredCityRank: number;
    RequiredReputationFaction: number;
    RequiredReputationRank: number;
    Armory: number;
    SpellTrigger: number[];
    SpellId: any[];
    ItemStat: ItemStat[];
    Socket: Socket[];
    itemsetInfo: string;
    ItemSetInfo: ItemSetInfo;
    item_equip: string;
    armor_type: string;
    weapon_damage: boolean;
    minDmg: number;
    maxDmg: number;
    dmg_speed: number;
    fullLootInfo: string;
    ench: string;
    item_armor: string;
    quality_color_original: string;
    quality_color: string;
    item_name_original: string;
    item_name: string;
    description: string;
    is_heroic: number;
    bonding: string;
    haveCreator: boolean;
    creator: string;
    races: string;
    classes: string;
    need_level: number;
    need_skill: string;
    need_skill_rank: number;
    need_reputation_rank: string;
    need_reputation_faction: string;
    durability: Durability;
    startquesto: number;
    source: string;
    itemLevel: number;
    transmogid: number;
    transmogitemname: string;
    transmogitemicon: string;
    upgradeid: number;
    upgradelevel: number;
    upgrademaxlevel: number;
    upgradetext: string;
    itemnamedescription: string;
    useenchantment: string;
}

export interface ItemSetInfo {
    base?: Base;
}

export interface Base {
    name: string;
    reqSkill: number;
    reqValue: number;
    Spells: Spell[];
    Items: Item[];
}

export interface Item {
    name: string;
    invType: number;
    have: boolean;
}

export interface Spell {
    spell: string;
    threshold: number;
}

export interface ItemStat {
    type: number;
    value: number;
    StatDescription: string;
}

export interface Socket {
    Color: number;
    Content: number;
}

export interface SocketContainedGem {
    gemid: number;
    icon: string;
    desc: string;
    enchid: number;
    color: number;
}

export interface Durability {
    current: number;
    max: number;
}
