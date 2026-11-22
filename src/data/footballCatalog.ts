export const LEAGUES_CATALOG = [
  { id: 'eng.1', name: 'Premier League', country: 'England', badge: 'PL' },
  { id: 'esp.1', name: 'La Liga', country: 'Spain', badge: 'LL' },
  { id: 'uefa.champions', name: 'UEFA Champions League', country: 'Europe', badge: 'UCL' },
  { id: 'uefa.europa', name: 'UEFA Europa League', country: 'Europe', badge: 'UEL' },
  { id: 'ita.1', name: 'Serie A', country: 'Italy', badge: 'SA' },
  { id: 'ger.1', name: 'Bundesliga', country: 'Germany', badge: 'BL' },
  { id: 'fra.1', name: 'Ligue 1', country: 'France', badge: 'L1' },
  { id: 'ksa.1', name: 'Saudi Pro League', country: 'Saudi Arabia', badge: 'SPL' },
  { id: 'lbn.1', name: 'Lebanese Premier League', country: 'Lebanon', badge: 'LPL' },
  { id: 'fifa.world', name: 'World Cup & International', country: 'Global', badge: 'FIFA' },
];

export const CLUBS_CATALOG = [
  { id: 'real-madrid', name: 'Real Madrid', league: 'La Liga', colors: ['#FFFFFF', '#1E3A8A'] },
  { id: 'barcelona', name: 'FC Barcelona', league: 'La Liga', colors: ['#A50044', '#004D98'] },
  { id: 'man-city', name: 'Manchester City', league: 'Premier League', colors: ['#6CABDD', '#1C2C5B'] },
  { id: 'arsenal', name: 'Arsenal', league: 'Premier League', colors: ['#EF0107', '#FFFFFF'] },
  { id: 'liverpool', name: 'Liverpool', league: 'Premier League', colors: ['#C8102E', '#00B2A9'] },
  { id: 'man-utd', name: 'Manchester United', league: 'Premier League', colors: ['#DA291C', '#FBE122'] },
  { id: 'chelsea', name: 'Chelsea', league: 'Premier League', colors: ['#034694', '#FFFFFF'] },
  { id: 'bayern', name: 'Bayern Munich', league: 'Bundesliga', colors: ['#DC052D', '#0066B2'] },
  { id: 'dortmund', name: 'Borussia Dortmund', league: 'Bundesliga', colors: ['#FDE100', '#000000'] },
  { id: 'inter', name: 'Inter Milan', league: 'Serie A', colors: ['#010E80', '#000000'] },
  { id: 'ac-milan', name: 'AC Milan', league: 'Serie A', colors: ['#FB090B', '#000000'] },
  { id: 'juventus', name: 'Juventus', league: 'Serie A', colors: ['#111111', '#FFFFFF'] },
  { id: 'psg', name: 'Paris Saint-Germain', league: 'Ligue 1', colors: ['#004170', '#DA291C'] },
  { id: 'al-hilal', name: 'Al-Hilal', league: 'Saudi Pro League', colors: ['#0047AB', '#FFFFFF'] },
  { id: 'al-nassr', name: 'Al-Nassr', league: 'Saudi Pro League', colors: ['#FFDF00', '#003399'] },
  { id: 'al-ittihad', name: 'Al-Ittihad', league: 'Saudi Pro League', colors: ['#FACC15', '#111111'] },
  { id: 'al-ahed', name: 'Al Ahed FC', league: 'Lebanese Premier League', colors: ['#FACC15', '#111111'] },
  { id: 'al-ansar', name: 'Al Ansar FC', league: 'Lebanese Premier League', colors: ['#16A34A', '#FFFFFF'] },
  { id: 'nejmeh', name: 'Nejmeh SC', league: 'Lebanese Premier League', colors: ['#991B1B', '#FFFFFF'] },
  { id: 'safa', name: 'Safa SC', league: 'Lebanese Premier League', colors: ['#2563EB', '#FFFFFF'] },
];

export const NATIONAL_TEAMS_CATALOG = [
  'Lebanon', 'Brazil', 'Argentina', 'France', 'Spain', 'Germany',
  'England', 'Portugal', 'Italy', 'Morocco', 'Saudi Arabia', 'Egypt', 'Japan', 'Netherlands',
];

export const PLAYERS_CATALOG = [
  'Kylian Mbappé', 'Erling Haaland', 'Vinícius Júnior', 'Jude Bellingham',
  'Lamine Yamal', 'Mohamed Salah', 'Bukayo Saka', 'Rodri',
  'Cristiano Ronaldo', 'Lionel Messi', 'Lautaro Martínez', 'Florian Wirtz',
  'Jamal Musiala', 'Cole Palmer', 'Pedri', 'Hassan Maatouk',
];

export const POSITIONS_CATALOG = ['GK', 'CB', 'LB/RB', 'CDM', 'CM', 'CAM', 'LW/RW', 'ST'];

export interface FantasyPlayer {
  id: string;
  name: string;
  club: string;
  league: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  price: number;
  formPts: number;
}

export const FANTASY_POOL: FantasyPlayer[] = [
  { id: 'fp-alisson', name: 'Alisson Becker', club: 'Liverpool', league: 'Premier League', position: 'GK', price: 5.5, formPts: 42 },
  { id: 'fp-courtois', name: 'Thibaut Courtois', club: 'Real Madrid', league: 'La Liga', position: 'GK', price: 5.8, formPts: 44 },
  { id: 'fp-raya', name: 'David Raya', club: 'Arsenal', league: 'Premier League', position: 'GK', price: 5.4, formPts: 46 },
  { id: 'fp-saliba', name: 'William Saliba', club: 'Arsenal', league: 'Premier League', position: 'DEF', price: 6.0, formPts: 48 },
  { id: 'fp-vandijk', name: 'Virgil van Dijk', club: 'Liverpool', league: 'Premier League', position: 'DEF', price: 6.2, formPts: 51 },
  { id: 'fp-hakimi', name: 'Achraf Hakimi', club: 'PSG', league: 'Ligue 1', position: 'DEF', price: 6.1, formPts: 47 },
  { id: 'fp-bastoni', name: 'Alessandro Bastoni', club: 'Inter Milan', league: 'Serie A', position: 'DEF', price: 5.8, formPts: 45 },
  { id: 'fp-carvajal', name: 'Dani Carvajal', club: 'Real Madrid', league: 'La Liga', position: 'DEF', price: 5.7, formPts: 41 },
  { id: 'fp-gvardiol', name: 'Joško Gvardiol', club: 'Man City', league: 'Premier League', position: 'DEF', price: 5.9, formPts: 44 },
  { id: 'fp-bellingham', name: 'Jude Bellingham', club: 'Real Madrid', league: 'La Liga', position: 'MID', price: 9.5, formPts: 68 },
  { id: 'fp-salah', name: 'Mohamed Salah', club: 'Liverpool', league: 'Premier League', position: 'MID', price: 12.5, formPts: 84 },
  { id: 'fp-palmer', name: 'Cole Palmer', club: 'Chelsea', league: 'Premier League', position: 'MID', price: 10.6, formPts: 79 },
  { id: 'fp-pedri', name: 'Pedri González', club: 'FC Barcelona', league: 'La Liga', position: 'MID', price: 8.2, formPts: 59 },
  { id: 'fp-musiala', name: 'Jamal Musiala', club: 'Bayern Munich', league: 'Bundesliga', position: 'MID', price: 9.4, formPts: 66 },
  { id: 'fp-saka', name: 'Bukayo Saka', club: 'Arsenal', league: 'Premier League', position: 'MID', price: 10.1, formPts: 72 },
  { id: 'fp-haaland', name: 'Erling Haaland', club: 'Man City', league: 'Premier League', position: 'FWD', price: 14.0, formPts: 86 },
  { id: 'fp-mbappe', name: 'Kylian Mbappé', club: 'Real Madrid', league: 'La Liga', position: 'FWD', price: 13.5, formPts: 81 },
  { id: 'fp-vini', name: 'Vinícius Júnior', club: 'Real Madrid', league: 'La Liga', position: 'FWD', price: 12.0, formPts: 75 },
  { id: 'fp-yamal', name: 'Lamine Yamal', club: 'FC Barcelona', league: 'La Liga', position: 'FWD', price: 9.8, formPts: 70 },
  { id: 'fp-lautaro', name: 'Lautaro Martínez', club: 'Inter Milan', league: 'Serie A', position: 'FWD', price: 10.4, formPts: 67 },
  { id: 'fp-ronaldo', name: 'Cristiano Ronaldo', club: 'Al-Nassr', league: 'Saudi Pro League', position: 'FWD', price: 10.2, formPts: 74 },
  { id: 'fp-maatouk', name: 'Hassan Maatouk', club: 'Al Ansar FC', league: 'Lebanese Premier League', position: 'FWD', price: 6.5, formPts: 58 },
];

export const TRIVIA_QUESTIONS = [
  {
    level: 'Beginner',
    question: 'Which country won the 2022 FIFA World Cup in Qatar?',
    options: ['France', 'Argentina', 'Brazil', 'Croatia'],
    answerIndex: 1,
    fact: 'Argentina defeated France on penalties after a 3-3 draw in Lusail.',
  },
  {
    level: 'Beginner',
    question: 'Which club has won the most UEFA Champions League titles?',
    options: ['AC Milan', 'Bayern Munich', 'Real Madrid', 'Liverpool'],
    answerIndex: 2,
    fact: 'Real Madrid lead all clubs with 15 European Cup / Champions League titles.',
  },
  {
    level: 'Tactical',
    question: 'Which Lebanese club won the AFC Cup in 2019?',
    options: ['Nejmeh SC', 'Al Ansar FC', 'Al Ahed FC', 'Safa SC'],
    answerIndex: 2,
    fact: 'Al Ahed FC defeated April 25 SC 1-0 in Kuala Lumpur to win Lebanon’s first AFC Cup.',
  },
  {
    level: 'Tactical',
    question: 'What does "xG" measure in modern football analytics?',
    options: [
      'Expected Goals probability based on shot quality',
      'Extra Game minutes added by VAR',
      'Crosses completed per 90 minutes',
      'Goalkeeper distribution accuracy',
    ],
    answerIndex: 0,
    fact: 'Expected Goals (xG) assigns a probability between 0 and 1 to every shot based on location, angle, and assist type.',
  },
  {
    level: 'Legend',
    question: 'Who is the all-time top goalscorer for the Lebanon national football team?',
    options: ['Roda Antar', 'Hassan Maatouk', 'Youssef Mohamad', 'Wael Nazha'],
    answerIndex: 1,
    fact: 'Hassan Maatouk holds Lebanon’s all-time records for both international caps and goals.',
  },
  {
    level: 'Legend',
    question: 'Which manager pioneered "Gegenpressing" at Mainz 05, Borussia Dortmund, and Liverpool?',
    options: ['Pep Guardiola', 'Jürgen Klopp', 'Carlo Ancelotti', 'José Mourinho'],
    answerIndex: 1,
    fact: 'Counter-pressing immediately after losing possession became Klopp’s signature tactical identity.',
  },
  {
    level: 'Tactical',
    question: 'Which player won the Ballon d’Or in 2024?',
    options: ['Vinícius Júnior', 'Rodri', 'Jude Bellingham', 'Kylian Mbappé'],
    answerIndex: 1,
    fact: 'Spanish midfielder Rodri won the 2024 Ballon d’Or after winning the Premier League and Euro 2024.',
  },
  {
    level: 'Beginner',
    question: 'How many substitutions are normally allowed per team in standard FIFA competitions?',
    options: ['3', '4', '5', '6'],
    answerIndex: 2,
    fact: 'IFAB permanently approved 5 substitutions across 3 stoppage windows (plus halftime).',
  },
];

export const PLAYER_CLUES_GAME = [
  {
    answer: 'Luka Modrić',
    clues: [
      'Croatian central midfielder born in 1985.',
      'Started senior career at Dinamo Zagreb before moving to Tottenham Hotspur.',
      'Won 6 UEFA Champions League trophies and the 2018 Ballon d’Or.',
    ],
  },
  {
    answer: 'Mohamed Salah',
    clues: [
      'Egyptian right winger known for left-footed curling finishes.',
      'Played for Basel, Chelsea, Fiorentina, and AS Roma before 2017.',
      'Multiple Premier League Golden Boot winner at Liverpool.',
    ],
  },
  {
    answer: 'Cristiano Ronaldo',
    clues: [
      'Portuguese forward who wore #7 at Manchester United, Real Madrid, and Juventus.',
      'All-time top scorer in UEFA Champions League and men’s international football.',
      'Currently plays in the Saudi Pro League for Al-Nassr.',
    ],
  },
  {
    answer: 'Hassan Maatouk',
    clues: [
      'Lebanese forward and longtime captain of the Cedars national team.',
      'Played professionally in the UAE Pro League before returning to Lebanon.',
      'Starred for Al Ahed and Al Ansar as Lebanon’s all-time top scorer.',
    ],
  },
  {
    answer: 'Jude Bellingham',
    clues: [
      'English midfielder whose #22 shirt was retired by Birmingham City.',
      'Developed into a Bundesliga Player of the Season at Borussia Dortmund.',
      'Signed for Real Madrid in 2023 and wears #5.',
    ],
  },
];

export const CLUB_LOGO_QUIZ = [
  {
    club: 'Arsenal',
    league: 'Premier League',
    city: 'London',
    colors: ['#EF0107', '#FFFFFF'],
    symbolHint: 'Cannon crest · North London Reds',
    options: ['Arsenal', 'Liverpool', 'Atlético Madrid', 'Bayern Munich'],
  },
  {
    club: 'Al Ahed FC',
    league: 'Lebanese Premier League',
    city: 'Beirut',
    colors: ['#FACC15', '#111111'],
    symbolHint: '2019 AFC Cup Champions · Yellow & Black',
    options: ['Borussia Dortmund', 'Al Ahed FC', 'Al-Ittihad', 'Villarreal'],
  },
  {
    club: 'Inter Milan',
    league: 'Serie A',
    city: 'Milan',
    colors: ['#010E80', '#000000'],
    symbolHint: 'I M monogram · Nerazzurri',
    options: ['AC Milan', 'Inter Milan', 'Atalanta', 'Porto'],
  },
  {
    club: 'Al-Hilal',
    league: 'Saudi Pro League',
    city: 'Riyadh',
    colors: ['#0047AB', '#FFFFFF'],
    symbolHint: 'Crescent moon badge · Blue Wave of Riyadh',
    options: ['Al-Nassr', 'Al-Hilal', 'Al-Ahli', 'Chelsea'],
  },
  {
    club: 'Real Madrid',
    league: 'La Liga',
    city: 'Madrid',
    colors: ['#FFFFFF', '#D4AF37'],
    symbolHint: 'Royal crown above MCF monogram · Los Blancos',
    options: ['Real Madrid', 'Real Sociedad', 'Valencia', 'Lyon'],
  },
];

export const FOOTBALL_GLOSSARY = [
  {
    term: 'xG (Expected Goals)',
    category: 'Analytics',
    definition: 'A statistical metric measuring the likelihood (0.00–1.00) that a shot results in a goal based on distance, angle, body part, and defensive pressure.',
  },
  {
    term: 'Gegenpressing',
    category: 'Tactics',
    definition: 'Immediate, aggressive collective pressing within 5 seconds of losing possession to win the ball back high up the pitch before the opponent organizes.',
  },
  {
    term: 'Half-Space',
    category: 'Pitch Geography',
    definition: 'The vertical channels between the central lane and the touchline wings—prime zones for creative midfielders and inverted wingers to thread through balls.',
  },
  {
    term: 'Inverted Fullback',
    category: 'Roles',
    definition: 'A right or left defender who tucks into central midfield during possession to create numerical superiority in build-up play.',
  },
  {
    term: 'Low Block',
    category: 'Defense',
    definition: 'A compact defensive structure positioned close to the team’s own penalty box to deny central space and force opponents wide.',
  },
  {
    term: 'False Nine',
    category: 'Roles',
    definition: 'A nominal center-forward who drops deep into midfield to pull center-backs out of position and open space for cutting wingers.',
  },
  {
    term: 'Panenka',
    category: 'Technique',
    definition: 'A delicate chipped penalty kick lofted softly down the center of the goal as the goalkeeper dives to either corner.',
  },
  {
    term: 'Clean Sheet',
    category: 'Goalkeeping',
    definition: 'Completed match in which a goalkeeper and defensive unit concede zero goals.',
  },
];

export const STADIUMS_DIRECTORY = [
  {
    name: 'Santiago Bernabéu',
    city: 'Madrid, Spain',
    clubs: 'Real Madrid',
    capacity: '85,000',
    opened: '1947 (Renovated 2024)',
    surface: 'Retractable Hybrid Turf',
  },
  {
    name: 'Anfield',
    city: 'Liverpool, England',
    clubs: 'Liverpool FC',
    capacity: '61,276',
    opened: '1884',
    surface: 'Desso GrassMaster Hybrid',
  },
  {
    name: 'Camille Chamoun Sports City Stadium',
    city: 'Beirut, Lebanon',
    clubs: 'Lebanon National Team & Cup Finals',
    capacity: '49,500',
    opened: '1957 (Rebuilt 1997)',
    surface: 'Natural Grass',
  },
  {
    name: 'Allianz Arena',
    city: 'Munich, Germany',
    clubs: 'FC Bayern Munich',
    capacity: '75,024',
    opened: '2005',
    surface: 'Hybrid Grass',
  },
  {
    name: 'San Siro (Giuseppe Meazza)',
    city: 'Milan, Italy',
    clubs: 'AC Milan & Inter Milan',
    capacity: '75,817',
    opened: '1926',
    surface: 'Hybrid Turf',
  },
  {
    name: 'Kingdom Arena',
    city: 'Riyadh, Saudi Arabia',
    clubs: 'Al-Hilal SFC',
    capacity: '26,000+',
    opened: '2023',
    surface: 'Indoor Retractable Pitch',
  },
];
