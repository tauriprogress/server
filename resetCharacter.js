const { resetCharacter } = require("./build/database/scripts/resetCharacter");

const character = {
    name: "name" /* "character name capitalized" */,
    realm: "[EN] Evermoon" /* full realm of the character */,
    class: 11 /* class id as number*/,
};

(async function () {
    await resetCharacter(character.name, character.realm, character.class);
    console.log("done");
})();
