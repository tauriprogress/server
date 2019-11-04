const { updateGuildData } = require("../helpers.js");
const oldGuildData = require("./data/updateGuild/oldGuildData.json");
const newGuildData = require("./data/updateGuild/newGuildData.json");
const updatedGuildData = require("./data/updateGuild/updatedGuildData.json");

test("Update guild", () => {
    expect(updateGuildData(oldGuildData, newGuildData)).toEqual(
        updatedGuildData
    );
});
