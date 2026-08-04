const rankList = async () => {
    const rankedQueueID = [
        {
            "id": 0,
            "name": `${await getString("rank.ranked-solo-5vs5")}`,
            "Option": "RANKED_SOLO_5x5",
        },
        {
            "id": 1,
            "name": `${await getString("rank.ranked-flex-summoners-rift")}`,
            "Option": "RANKED_FLEX_SR",
        },
        {
            "id": 2,
            "name": `${await getString("rank.ranked-flex-tt")}`,
            "Option": "RANKED_FLEX_TT",
        },
        {
            "id": 3,
            "name": `${await getString("rank.ranked-tft")}`,
            "Option": "RANKED_TFT",
        },
        {
            "id": 4,
            "name": `${await getString("rank.ranked-tft-turbo")}`,
            "Option": "RANKED_TFT_TURBO",
        },
        {
            "id": 5,
            "name": `${await getString("rank.ranked-tft-double-up")}`,
            "Option": "RANKED_TFT_DOUBLE_UP",
        },
        {
            "id": 6,
            "name": `${await getString("rank.ranked-tft-pairs")}`,
            "Option": "RANKED_TFT_PAIRS",
        },
        {
            "id": 7,
            "name": `${await getString("rank.arena")}`,
            "Option": "CHERRY"
        },
        {
            "id": 8,
            "name": `${await getString("rank.ranked-classic")}`,
            "Option": "JADE_RANKED_SOLO_5x5"
        }
    ]

    const rankedTierID = [
        {
            "id": 0,
            "name": `${await getString("rank.iron")}`,
            "Option": "IRON",
        },
        {
            "id": 1,
            "name": `${await getString("rank.bronze")}`,
            "Option": "BRONZE",
        },
        {
            "id": 2,
            "name": `${await getString("rank.silver")}`,
            "Option": "SILVER",
        },
        {
            "id": 3,
            "name": `${await getString("rank.gold")}`,
            "Option": "GOLD",
        },
        {
            "id": 4,
            "name": `${await getString("rank.platinum")}`,
            "Option": "PLATINUM",
        },
        {
            "id": 5,
            "name": `${await getString("rank.diamond")}`,
            "Option": "DIAMOND",
        },
        {
            "id": 6,
            "name": `${await getString("rank.emerald")}`,
            "Option": "EMERALD",
        },
        {
            "id": 7,
            "name": `${await getString("rank.master")}`,
            "Option": "MASTER",
        },
        {
            "id": 8,
            "name": `${await getString("rank.grand-master")}`,
            "Option": "GRANDMASTER",
        },
        {
            "id": 9,
            "name": `${await getString("rank.challenger")}`,
            "Option": "CHALLENGER"
        },
        {
            "id": 10,
            "name": `${await getString("rank.classic-salt")}`,
            "Option": "SALT"
        },
        {
            "id": 11,
            "name": `${await getString("rank.classic-wood")}`,
            "Option": "WOOD"
        },
        {
            "id": 12,
            "name": `${await getString("rank.classic-legend")}`,
            "Option": "LEGEND"
        }
    ]

    const RankedDivisionID = [
        {
            "id": 0,
            "name": "I"
        },
        {
            "id": 1,
            "name": "II"
        },
        {
            "id": 2,
            "name": "III"
        },
        {
            "id": 3,
            "name": "IV"
        }
    ]

    return {
        "Ranked Queue ID"           : rankedQueueID,
        "Ranked Tier ID"            : rankedTierID,
        "Ranked Division ID"        : RankedDivisionID,

        "classic-ranked-tier-id"    : rankedTierID,
        "classic-ranked-division-id": RankedDivisionID
    }
}

export { rankList };