// Word lists for the games on the fun page. Plain A-Z only (no umlauts or ß), so every
// letter can be typed on any keyboard and shown on the on-screen one.

// For the word guess game, by word length (the length depends on the difficulty)
export const GUESS_WORDS = {
    en: {
        4: [
            'BIRD', 'BOAT', 'BOOK', 'CAKE', 'CITY', 'COIN', 'CORN', 'DESK', 'DOOR', 'DUCK',
            'FARM', 'FISH', 'FROG', 'GAME', 'GIFT', 'GOAL', 'HAND', 'HILL', 'HOME', 'IDEA',
            'KITE', 'LAMP', 'LEAF', 'LION', 'MAZE', 'MILK', 'MOON', 'NEST', 'NOTE', 'PARK',
            'PLAN', 'RAIN', 'ROAD', 'ROCK', 'ROSE', 'SAND', 'SHIP', 'SNOW', 'SOCK', 'SONG',
            'SOUP', 'STAR', 'TASK', 'TIME', 'TREE', 'WAVE', 'WIND', 'WOLF', 'YARN',
        ],
        5: [
            'APPLE', 'BEACH', 'BRAIN', 'BREAD', 'BREAK', 'CANDY', 'CHAIR', 'CLOCK', 'CLOUD', 'CRANE',
            'DANCE', 'DREAM', 'EARTH', 'FLAME', 'FOCUS', 'FRUIT', 'GHOST', 'GRAPE', 'HEART', 'HONEY',
            'HOUSE', 'JUICE', 'LASER', 'LEMON', 'LIGHT', 'MAGIC', 'MONEY', 'MOUSE', 'MUSIC', 'NIGHT',
            'NOVEL', 'OCEAN', 'PAINT', 'PEARL', 'PIANO', 'PILOT', 'PLANT', 'QUEEN', 'QUIET', 'RIVER',
            'ROBOT', 'SALAD', 'SCARF', 'SHINE', 'SMILE', 'SNAKE', 'SPACE', 'STONE', 'STORM', 'SUGAR',
            'SWIFT', 'TABLE', 'TIGER', 'TIMER', 'TOAST', 'TRAIN', 'VOICE', 'WATER', 'WHALE', 'WORLD',
            'YOUTH', 'ZEBRA',
        ],
        6: [
            'ANCHOR', 'BASKET', 'BUTTER', 'CACTUS', 'CANDLE', 'CASTLE', 'CIRCLE', 'COFFEE', 'COOKIE', 'DRAGON',
            'ENERGY', 'FLOWER', 'FOREST', 'GARDEN', 'GUITAR', 'HAMMER', 'HELMET', 'ISLAND', 'JACKET', 'JUNGLE',
            'KETTLE', 'LADDER', 'MARKET', 'MIRROR', 'MONKEY', 'ORANGE', 'PENCIL', 'PEPPER', 'PICNIC', 'PLANET',
            'POCKET', 'PUZZLE', 'RABBIT', 'RIBBON', 'ROCKET', 'SADDLE', 'SILVER', 'SPIDER', 'SUMMER', 'TICKET',
            'TOMATO', 'TUNNEL', 'TURTLE', 'VELVET', 'WALNUT', 'WINDOW', 'WINTER', 'WIZARD', 'YELLOW', 'ZIPPER',
        ],
    },
    de: {
        4: [
            'BAUM', 'BERG', 'BOOT', 'BROT', 'BUCH', 'BURG', 'DACH', 'DORF', 'ENTE', 'ERDE',
            'FELD', 'GOLD', 'HAND', 'HASE', 'HAUS', 'HERZ', 'HUHN', 'HUND', 'IGEL', 'KIND',
            'KORB', 'KUSS', 'LAMM', 'LAND', 'LUFT', 'MAUS', 'MEER', 'MOND', 'NEST', 'OBST',
            'OPER', 'PARK', 'REIS', 'ROSE', 'SAFT', 'SALZ', 'SAND', 'SEIL', 'SOFA', 'TEIG',
            'TIER', 'WALD', 'WEIN', 'WIND', 'WOLF', 'ZELT', 'ZIEL',
        ],
        5: [
            'APFEL', 'BIRNE', 'BLATT', 'BLITZ', 'BLUME', 'BRIEF', 'EIMER', 'FARBE', 'FEUER', 'FISCH',
            'FOKUS', 'GABEL', 'GEIST', 'GLANZ', 'HONIG', 'HUMOR', 'INSEL', 'KAKAO', 'KATZE', 'KERZE',
            'KLANG', 'KOMET', 'KRAFT', 'KUGEL', 'LAMPE', 'LEBEN', 'LEISE', 'LICHT', 'MAGIE', 'MAUER',
            'MUSIK', 'NACHT', 'NEBEL', 'NUDEL', 'OLIVE', 'PAUSE', 'PERLE', 'PFERD', 'PILOT', 'PIZZA',
            'QUARK', 'RADIO', 'REGEN', 'ROBBE', 'RUHIG', 'SAHNE', 'SALAT', 'SCHAF', 'SONNE', 'SPIEL',
            'STERN', 'STROM', 'STUHL', 'TANNE', 'TAUBE', 'TIGER', 'TISCH', 'TRAUM', 'VOGEL', 'WAGEN',
            'WELLE', 'WIESE', 'WOLKE', 'WURST', 'ZEBRA', 'ZIEGE',
        ],
        6: [
            'BAGGER', 'BALLON', 'BANANE', 'BRUDER', 'BUTTER', 'DACKEL', 'DRACHE', 'FALTER', 'FELSEN', 'FLAGGE',
            'FREUND', 'GARTEN', 'GITTER', 'HAMMER', 'HIMMEL', 'HUMMEL', 'KAFFEE', 'KAMERA', 'KOFFER', 'KUCHEN',
            'LEITER', 'MANTEL', 'MESSER', 'MUSKEL', 'ORANGE', 'PALAST', 'PAPIER', 'PINSEL', 'PLANET', 'PUZZLE',
            'RAKETE', 'SCHERE', 'SCHNEE', 'SCHULE', 'SILBER', 'SOMMER', 'STRAND', 'TASCHE', 'TOMATE', 'TUNNEL',
            'VULKAN', 'WASSER', 'WINTER', 'ZAUBER', 'ZUCKER',
        ],
    },
};

// Words with a category as a hint, for the letter salad. The difficulty picks them by length.
export const SCRAMBLE_WORDS = {
    en: [
        ['MOON', 'Space'], ['STAR', 'Space'], ['COMET', 'Space'], ['PLANET', 'Space'], ['ROCKET', 'Space'], ['GALAXY', 'Space'],
        ['TELESCOPE', 'Space'], ['ASTRONAUT', 'Space'],
        ['DRUM', 'Music'], ['PIANO', 'Music'], ['GUITAR', 'Music'], ['VIOLIN', 'Music'], ['TRUMPET', 'Music'], ['MELODY', 'Music'],
        ['SAXOPHONE', 'Music'], ['ORCHESTRA', 'Music'], ['HEADPHONES', 'Music'],
        ['CHESS', 'Games'], ['PUZZLE', 'Games'], ['DOMINO', 'Games'], ['LABYRINTH', 'Games'], ['VOLLEYBALL', 'Games'],
        ['LAMP', 'Home'], ['WINDOW', 'Home'], ['KITCHEN', 'Home'], ['LADDER', 'Home'], ['PILLOW', 'Home'], ['UMBRELLA', 'Home'],
        ['TREE', 'Outdoors'], ['GARDEN', 'Outdoors'], ['FOREST', 'Outdoors'], ['ISLAND', 'Outdoors'], ['VOLCANO', 'Outdoors'],
        ['MOUNTAIN', 'Outdoors'], ['RAINBOW', 'Outdoors'], ['SUNFLOWER', 'Outdoors'], ['MUSHROOM', 'Outdoors'],
        ['TOWER', 'Buildings'], ['CASTLE', 'Buildings'], ['BRIDGE', 'Buildings'], ['LIBRARY', 'Buildings'], ['MUSEUM', 'Buildings'], ['HOSPITAL', 'Buildings'],
        ['BOOK', 'School'], ['PENCIL', 'School'], ['NOTEBOOK', 'School'], ['CALENDAR', 'School'], ['HOMEWORK', 'School'], ['TRIANGLE', 'School'],
        ['CAKE', 'Food'], ['BREAD', 'Food'], ['ORANGE', 'Food'], ['TOMATO', 'Food'], ['SANDWICH', 'Food'], ['PANCAKE', 'Food'], ['CHEESE', 'Food'],
        ['CHOCOLATE', 'Food'], ['PINEAPPLE', 'Food'],
        ['BEAR', 'Animals'], ['TIGER', 'Animals'], ['RABBIT', 'Animals'], ['KITTEN', 'Animals'], ['PENGUIN', 'Animals'], ['ELEPHANT', 'Animals'],
        ['DOLPHIN', 'Animals'], ['GIRAFFE', 'Animals'], ['HEDGEHOG', 'Animals'], ['KANGAROO', 'Animals'], ['CROCODILE', 'Animals'], ['BUTTERFLY', 'Animals'],
        ['ROBOT', 'Tech'], ['CAMERA', 'Tech'], ['KEYBOARD', 'Tech'], ['MONITOR', 'Tech'], ['BATTERY', 'Tech'], ['COMPUTER', 'Tech'], ['AIRPLANE', 'Tech'],
        ['DRAGON', 'Fantasy'], ['WIZARD', 'Fantasy'], ['UNICORN', 'Fantasy'], ['ADVENTURE', 'Fantasy'], ['DINOSAUR', 'Fantasy'],
        ['GOLD', 'Treasure'], ['DIAMOND', 'Treasure'], ['SILVER', 'Treasure'], ['TREASURE', 'Treasure'],
        ['BIRTHDAY', 'Party'], ['FIREWORKS', 'Party'], ['DETECTIVE', 'Jobs'], ['MAGAZINE', 'Reading'], ['SKELETON', 'Body'],
    ],
    de: [
        ['MOND', 'Weltall'], ['STERN', 'Weltall'], ['KOMET', 'Weltall'], ['PLANET', 'Weltall'], ['RAKETE', 'Weltall'], ['GALAXIE', 'Weltall'],
        ['TELESKOP', 'Weltall'], ['ASTRONAUT', 'Weltall'],
        ['GEIGE', 'Musik'], ['GITARRE', 'Musik'], ['TROMPETE', 'Musik'], ['MELODIE', 'Musik'], ['SAXOPHON', 'Musik'], ['ORCHESTER', 'Musik'],
        ['PUZZLE', 'Spiele'], ['DOMINO', 'Spiele'], ['SCHACH', 'Spiele'], ['LABYRINTH', 'Spiele'],
        ['SOFA', 'Zuhause'], ['FENSTER', 'Zuhause'], ['KUECHE', 'Zuhause'], ['LEITER', 'Zuhause'], ['KISSEN', 'Zuhause'], ['REGENSCHIRM', 'Zuhause'],
        ['BAUM', 'Draußen'], ['GARTEN', 'Draußen'], ['INSEL', 'Draußen'], ['VULKAN', 'Draußen'], ['GEBIRGE', 'Draußen'], ['WIESE', 'Draußen'],
        ['REGENBOGEN', 'Draußen'], ['SONNENBLUME', 'Draußen'],
        ['TURM', 'Gebäude'], ['SCHLOSS', 'Gebäude'], ['BRUECKE', 'Gebäude'], ['MUSEUM', 'Gebäude'], ['BIBLIOTHEK', 'Gebäude'], ['KRANKENHAUS', 'Gebäude'],
        ['BUCH', 'Schule'], ['TAFEL', 'Schule'], ['BLEISTIFT', 'Schule'], ['NOTIZBUCH', 'Schule'], ['KALENDER', 'Schule'],
        ['BROT', 'Essen'], ['ORANGE', 'Essen'], ['TOMATE', 'Essen'], ['BREZEL', 'Essen'], ['PFANNKUCHEN', 'Essen'], ['KARTOFFEL', 'Essen'],
        ['SCHOKOLADE', 'Essen'], ['ERDBEERE', 'Essen'],
        ['IGEL', 'Tiere'], ['HUND', 'Tiere'], ['TIGER', 'Tiere'], ['DELFIN', 'Tiere'], ['HAMSTER', 'Tiere'], ['PINGUIN', 'Tiere'], ['ELEFANT', 'Tiere'],
        ['GIRAFFE', 'Tiere'], ['KROKODIL', 'Tiere'], ['KAENGURU', 'Tiere'], ['SCHMETTERLING', 'Tiere'],
        ['ROBOTER', 'Technik'], ['KAMERA', 'Technik'], ['TASTATUR', 'Technik'], ['BATTERIE', 'Technik'], ['BILDSCHIRM', 'Technik'],
        ['COMPUTER', 'Technik'], ['FLUGZEUG', 'Technik'],
        ['DRACHE', 'Fantasy'], ['ZAUBERER', 'Fantasy'], ['EINHORN', 'Fantasy'], ['ABENTEUER', 'Fantasy'], ['DINOSAURIER', 'Fantasy'],
        ['GOLD', 'Schatz'], ['DIAMANT', 'Schatz'], ['SILBER', 'Schatz'], ['KRONE', 'Schatz'],
        ['GEBURTSTAG', 'Feier'], ['FEUERWERK', 'Feier'], ['DETEKTIV', 'Berufe'],
    ],
};
