import { Holiday } from '@/types';

export const WIKI_SOURCES: Record<Holiday, string[]> = {
  Halloween: [
    'https://en.wikipedia.org/wiki/List_of_Halloween_television_specials',
    'https://en.wikipedia.org/wiki/Category:Halloween_television_specials',
    'https://en.wikipedia.org/wiki/Category:Halloween_television_episodes',
  ],
  Thanksgiving: [
    'https://en.wikipedia.org/wiki/List_of_Thanksgiving_television_specials',
    'https://en.wikipedia.org/wiki/Category:Thanksgiving_television_specials',
  ],
  Christmas: [
    'https://en.wikipedia.org/wiki/List_of_Christmas_television_specials',
    'https://en.wikipedia.org/wiki/List_of_United_States_Christmas_television_episodes',
    'https://en.wikipedia.org/wiki/List_of_United_States_Christmas_television_specials',
    'https://en.wikipedia.org/wiki/Lists_of_Christmas_television_episodes',
  ],
  "Valentine's": [
    'https://en.wikipedia.org/wiki/List_of_Valentine%27s_Day_television_specials',
    'https://en.wikipedia.org/wiki/Category:Valentine%27s_Day_television_specials',
  ],
};

export const CURATED_KEYWORDS: Record<Holiday, string[]> = {
  Halloween: [
    '\\bHallowe?en\\b',
    'Treehouse of Horror',
    '\\bSpooktacular\\b',
    '\\bJack[- ]o[- ]lantern\\b',
    '\\bTrick[- ]?or[- ]?Treat\\b',
    '\\bPumpkin[s]?\\b',
    'All Hallows',
    'October 31',
    'Samhain',
  ],
  Thanksgiving: [
    '\\bThanksgiving\\b',
    '\\bFriendsgiving\\b',
    '\\bTurkey\\b',
    '\\bPilgrim[s]?\\b',
    '\\bParade\\b',
    '\\bStuffing\\b',
    '\\bCranberries?\\b',
    '\\bCornucopia\\b',
    '\\bFeast\\b',
    '\\bGravy\\b',
    '\\bGobble\\b',
    '\\bHarvest\\b',
    "\\bMacy'?s\\b",
    '\\bNFL\\b',
  ],
  Christmas: [
    '\\bChristmas\\b',
    '\\bX[- ]?mas\\b',
    '\\bHoliday Special\\b',
    '\\bSanta\\b',
    '\\bSt[.]?\\s?Nick\\b',
    '\\bKris Kringle\\b',
    '\\bNorth Pole\\b',
    '\\bMrs\\.?\\s?Claus\\b',
    '\\bMistletoe\\b',
    '\\bYuletide\\b',
    '\\bElf\\b',
    '\\bReindeer\\b',
    '\\bFrosty\\b',
    '\\bSnow(?:man)?\\b',
    '\\bSleigh\\b',
    '\\bJingle Bells?\\b',
    '\\bNativity\\b',
    '\\bCarol\\b',
    '\\bGift[s]?\\b',
    '\\bPresent[s]?\\b',
    '\\bSecret Santa\\b',
    '\\bHoliday Party\\b',
  ],
  "Valentine's": [
    "\\bValentine'?s?\\b",
    '\\bCupid\\b',
    '\\bRomance\\b',
    '\\bSweetheart\\b',
    '\\bBe My Valentine\\b',
    '\\bHeart[- ]?Day\\b',
    '\\bDate Night\\b',
    '\\bSecret Admirer\\b',
    '\\bProposal\\b',
    '\\bChocolate\\b',
    '\\bRose?s?\\b',
    '\\bCandy Hearts?\\b',
  ],
};

export const EXCLUDE_PATTERNS = [
  '\\bChristmas Island\\b',
  '\\bTurkey (?:vulture|shootout|buzzard|sandwich)\\b',
  '\\bBlack Friday\\b',
  '\\bTalking Turkey\\b',
  '\\bCold Turkey\\b',
  '\\bGhost(?:busters?|writer|town|ship|story)\\b',
  '\\bMonster(?:s? Inc|truck|energy|hunter|high)\\b',
  '\\bSpooky (?:action|distance)\\b',
  '\\bHaunted (?:mansion|house) (?:party|ride|attraction)\\b',
  '\\bCandy (?:cane|shop|store|crush|land|factory)\\b',
  '\\bSkeleton (?:key|crew|coast)\\b',
  '\\bWitch (?:doctor|hazel)\\b',
  '\\bPumpkin (?:spice|pie|patch|head|bread|seeds?)\\b',
  '\\bCostume (?:party|shop|designer|contest|drama)\\b',
  '\\bZombie (?:apocalypse|outbreak|virus|infection|horde)\\b',
];

export const PLAYLIST_PREFIX = 'Holiday – ';

export const DEFAULT_TV_LIBRARY = 'TV Shows';

export const SCRAPE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds