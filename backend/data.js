const zonesData = [
    {
        id: 'f8ef8705-2e6d-41df-a6db-df90d7a2b782',
        name: "ТВ",
        icon: "tv",
        x: 1,
        y: 1,
        zone: "top",
        active: false
    },
    {
        id: '5ec9a147-6e0d-4f2e-a314-8a6492db9514',
        name: "Большой стол",
        icon: "table",
        x: 2,
        y: 1,
        zone: "top",
        active: false
    },

    // Center zone
    {
        id: '63e6144d-22b5-46d6-b2fe-a2e585ebcbe2',
        name: "Потолок",
        icon: "ceiling",
        x: 1,
        y: 1,
        zone: "center",
        active: false
    },
    {
        id: 'fb667833-89b8-49d8-b91b-32a3bdf03de9',
        name: "ПК 3",
        icon: "desktop",
        x: 2,
        y: 1,
        zone: "center",
        active: false
    },
    {
        id: 'debe85b0-881f-4d62-800c-f05b21532188',
        name: "ПК 4",
        icon: "desktop",
        x: 3,
        y: 1,
        zone: "center",
        active: false
    },
    {
        id: '342cab04-8ae2-45db-bdef-a00e14069de6',
        name: "Потолок",
        icon: "ceiling",
        x: 4,
        y: 1,
        zone: "center",
        active: false
    },
    {
        id: '5ec9a147-6e0d-4f2e-a314-8a6492db9514',
        name: "Стол для ПК",
        icon: "table",
        x: 1,
        y: 2,
        zone: "center",
        active: false
    },
    {
        id: '098dd010-1679-40ec-973d-c4a94602a1b5',
        name: "ПК 2",
        icon: "desktop",
        x: 2,
        y: 2,
        zone: "center",
        active: false
    },
    {
        id: '37983930-78b7-412d-b713-41afb7a33139',
        name: "ПК 5",
        icon: "desktop",
        x: 3,
        y: 2,
        zone: "center",
        active: false
    },
    {
        id: '2630d014-6c81-4594-a1c1-268894332e64',
        name: "Стол для ПК",
        icon: "table",
        x: 4,
        y: 2,
        zone: "center",
        active: false
    },
    {
        id: '9972cba9-291d-446a-ac6a-278f03f9523d',
        name: "Пол",
        icon: "floor",
        x: 1,
        y: 3,
        zone: "center",
        active: false
    },
    {
        id: '2a1fa41c-bf4e-44d9-b533-983bdb69b75c',
        name: "ПК 1",
        icon: "desktop",
        x: 2,
        y: 3,
        zone: "center",
        active: false
    },
    {
        id: '3f62f772-945b-48ce-bc0f-719fca03ca41',
        name: "ПК 6",
        icon: "desktop",
        x: 3,
        y: 3,
        zone: "center",
        active: false
    },
    {
        id: 'a257ee28-16d1-47f7-af1a-7b1d4f530e60',
        name: "Пол",
        icon: "floor",
        x: 4,
        y: 3,
        zone: "center",
        active: false
    },
    {
        id: '1e7bc5a0-9a63-41a9-a9e3-7a16d1ffd974',
        name: "Массаж",
        icon: "massage",
        x: 1,
        y: 1,
        zone: "bottom",
        active: false
    },
    {
        id: 'c3636ead-de16-4677-9a12-1840fc74a424',
        name: "Вход",
        icon: "entrance",
        x: 2,
        y: 1,
        zone: "bottom",
        active: false
    },
    {
        id: '35de9759-23c2-4c10-b7aa-92f24b06a952',
        name: "Гардероб",
        icon: "locker",
        x: 3,
        y: 1,
        zone: "bottom",
        active: false
    }
]

const effectsData = [
    [
        {
            name: 'Без эффектов',
            icon: 'effectOff',
            active: false
        },
        {
            name: 'Музыка',
            icon: "music",
            active: false
        },
        {
            name: 'Пульс',
            icon: "pulse",
            active: false
        },
        {
            name: 'Комета',
            icon:"comet",
            active: false
        },
        {
            name: 'Радуга',
            icon: "rainbow",
            active: false
        },
        {
            name: 'Аврора',
            icon: "aurora",
            active: false
        }
    ]
]

export default { zonesData, effectsData }