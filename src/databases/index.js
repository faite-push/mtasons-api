const { QuickDB } = require("quick.db");

const dbVinculacoes = new QuickDB({ filePath: "./src/databases/dbVinculacoes.sqlite" });

module.exports = {
    dbVinculacoes
};
