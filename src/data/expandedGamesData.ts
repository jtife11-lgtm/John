export type GameDifficulty = 'Easy' | 'Medium' | 'Hard' | 'Expert';

export const DIFFICULTY_CONFIG: Record<
  GameDifficulty,
  {
    label: GameDifficulty;
    multiplier: number;
    timerSec: number;
    reflexWindowMs: number;
    keeperAiSkill: number; // 0..1
    bestXiTarget: number;
    badge: string;
    desc: string;
  }
> = {
  Easy: {
    label: 'Easy',
    multiplier: 1,
    timerSec: 25,
    reflexWindowMs: 1450,
    keeperAiSkill: 0.2,
    bestXiTarget: 85,
    badge: '1x XP · Relaxed',
    desc: 'Generous shot clocks, wide targets, approachable AI.',
  },
  Medium: {
    label: 'Medium',
    multiplier: 1.5,
    timerSec: 18,
    reflexWindowMs: 1050,
    keeperAiSkill: 0.45,
    bestXiTarget: 87,
    badge: '1.5x XP · Standard',
    desc: 'Matchday tempo with balanced timers and smart keepers.',
  },
  Hard: {
    label: 'Hard',
    multiplier: 2,
    timerSec: 12,
    reflexWindowMs: 780,
    keeperAiSkill: 0.68,
    bestXiTarget: 89,
    badge: '2x XP · UCL Intensity',
    desc: 'Tight clocks, fast reflex bars, ruthless AI goalkeeping.',
  },
  Expert: {
    label: 'Expert',
    multiplier: 3,
    timerSec: 8,
    reflexWindowMs: 560,
    keeperAiSkill: 0.85,
    bestXiTarget: 90,
    badge: '3x XP · Ballon d’Or',
    desc: 'Razor-thin precision, lightning reflexes, maximum rewards.',
  },
};

export interface OffsideScenario {
  id: string;
  title: string;
  defenderX: number; // 0..100 toward right goal (x=92)
  defender2X: number;
  attackerX: number;
  ballX: number;
  inOwnHalf?: boolean;
  isOffside: boolean;
  explanation: string;
}

export const OFFSIDE_SCENARIOS: OffsideScenario[] = [
  {
    id: 'off-1',
    title: 'Threaded Through Ball Behind High Line',
    defenderX: 68,
    defender2X: 54,
    attackerX: 74,
    ballX: 48,
    isOffside: true,
    explanation: 'Attacker (x=74) is clearly ahead of the 2nd-last defender (x=68) and ahead of the ball when played.',
  },
  {
    id: 'off-2',
    title: 'Timed Diagonal Run Level With Backline',
    defenderX: 70,
    defender2X: 58,
    attackerX: 66,
    ballX: 46,
    isOffside: false,
    explanation: 'Well-timed run! The attacker stays behind the 2nd-last defender line (x=66 vs x=70). Play on!',
  },
  {
    id: 'off-3',
    title: 'Counter-Attack Launched From Own Half',
    defenderX: 44,
    defender2X: 41,
    attackerX: 47,
    ballX: 39,
    inOwnHalf: true,
    isOffside: false,
    explanation: 'No offside! A player cannot be penalized for offside while inside their own half of the pitch (x < 50).',
  },
  {
    id: 'off-4',
    title: 'Square Tap-In Behind the Ball',
    defenderX: 78,
    defender2X: 74,
    attackerX: 80,
    ballX: 83,
    isOffside: false,
    explanation: 'Onside! Even though ahead of the last defender, the attacker is behind the ball (x=80 vs ball x=83).',
  },
  {
    id: 'off-5',
    title: 'Marginal Toe-Nail Over the Line',
    defenderX: 72,
    defender2X: 63,
    attackerX: 74.5,
    ballX: 55,
    isOffside: true,
    explanation: 'VAR confirms offside! Attacker crept just past the 2nd-last defender’s shoulder (74.5 vs 72).',
  },
  {
    id: 'off-6',
    title: 'Deep Center-Back Keeping Winger Onside',
    defenderX: 77,
    defender2X: 62,
    attackerX: 73,
    ballX: 52,
    isOffside: false,
    explanation: 'Onside! Look across the pitch—the far fullback at x=77 plays the central striker (x=73) cleanly onside.',
  },
];

export interface TransferDuel {
  playerA: string;
  moveA: string;
  feeA: number; // EUR millions
  playerB: string;
  moveB: string;
  feeB: number;
}

export const TRANSFER_FEE_DUELS: TransferDuel[] = [
  {
    playerA: 'Neymar Jr.',
    moveA: 'FC Barcelona → PSG (2017)',
    feeA: 222,
    playerB: 'Kylian Mbappé',
    moveB: 'AS Monaco → PSG (2018)',
    feeB: 180,
  },
  {
    playerA: 'Philippe Coutinho',
    moveA: 'Liverpool → FC Barcelona (2018)',
    feeA: 135,
    playerB: 'Jude Bellingham',
    moveB: 'Dortmund → Real Madrid (2023)',
    feeB: 103,
  },
  {
    playerA: 'Enzo Fernández',
    moveA: 'Benfica → Chelsea (2023)',
    feeA: 121,
    playerB: 'Declan Rice',
    moveB: 'West Ham → Arsenal (2023)',
    feeB: 116,
  },
  {
    playerA: 'Jack Grealish',
    moveA: 'Aston Villa → Man City (2021)',
    feeA: 117,
    playerB: 'Cristiano Ronaldo',
    moveB: 'Real Madrid → Juventus (2018)',
    feeB: 100,
  },
  {
    playerA: 'Gareth Bale',
    moveA: 'Tottenham → Real Madrid (2013)',
    feeA: 101,
    playerB: 'Paul Pogba',
    moveB: 'Juventus → Man United (2016)',
    feeB: 105,
  },
  {
    playerA: 'Moisés Caicedo',
    moveA: 'Brighton → Chelsea (2023)',
    feeA: 116,
    playerB: 'Harry Kane',
    moveB: 'Tottenham → Bayern Munich (2023)',
    feeB: 95,
  },
];

export const JERSEY_NUMBER_QUIZ = [
  {
    player: 'Jude Bellingham',
    context: 'Real Madrid shirt number honoring Zinedine Zidane',
    answer: '#5',
    options: ['#5', '#8', '#10', '#22'],
  },
  {
    player: 'Cole Palmer',
    context: 'Signature Chelsea playmaker shirt number',
    answer: '#20',
    options: ['#10', '#11', '#20', '#7'],
  },
  {
    player: 'Rodri',
    context: 'Manchester City Ballon d’Or midfield anchor number',
    answer: '#16',
    options: ['#4', '#6', '#16', '#8'],
  },
  {
    player: 'Kylian Mbappé',
    context: 'Debut Real Madrid galactico striker number',
    answer: '#9',
    options: ['#7', '#9', '#10', '#11'],
  },
  {
    player: 'Lamine Yamal',
    context: 'FC Barcelona prodigy & Spain Euro 2024 number',
    answer: '#19',
    options: ['#11', '#17', '#19', '#27'],
  },
  {
    player: 'Hassan Maatouk',
    context: 'Iconic Lebanon Cedars captain shirt number',
    answer: '#7',
    options: ['#7', '#9', '#10', '#11'],
  },
];

export const STADIUM_SPOTTER_QUIZ = [
  {
    clues: 'Home of Liverpool FC · Capacity ~61,276 · Famous Spion Kop stand',
    answer: 'Anfield',
    options: ['Anfield', 'Old Trafford', 'St James’ Park', 'Goodison Park'],
  },
  {
    clues: 'Beirut, Lebanon · Built 1957 · Capacity ~49,500 · Cedars National Home',
    answer: 'Camille Chamoun Sports City',
    options: ['Camille Chamoun Sports City', 'Beirut Municipal Stadium', 'Saida International', 'Tripoli Olympic'],
  },
  {
    clues: 'Munich, Germany · Inflatable luminous exterior · 75,024 seats',
    answer: 'Allianz Arena',
    options: ['Signal Iduna Park', 'Allianz Arena', 'Olympiastadion', 'Red Bull Arena'],
  },
  {
    clues: 'Madrid, Spain · Retractable roof & pitch · ~85,000 capacity',
    answer: 'Santiago Bernabéu',
    options: ['Camp Nou', 'Metropolitano', 'Santiago Bernabéu', 'Mestalla'],
  },
  {
    clues: 'Milan, Italy · Shared by Inter & AC Milan · Opened 1926',
    answer: 'San Siro',
    options: ['Stadio Olimpico', 'Allianz Stadium', 'Diego Maradona Stadium', 'San Siro'],
  },
  {
    clues: 'Riyadh, Saudi Arabia · Indoor retractable roof · Al-Hilal home',
    answer: 'Kingdom Arena',
    options: ['King Abdullah Sports City', 'Kingdom Arena', 'Al-Awwal Park', 'Prince Faisal Stadium'],
  },
];

export const DERBY_MATCHES_QUIZ = [
  {
    derby: 'The Beirut Derby',
    prompt: 'Which two historic Lebanese giants contest the Beirut Derby?',
    answer: 'Al Ansar FC vs Nejmeh SC',
    options: [
      'Al Ansar FC vs Nejmeh SC',
      'Al Ahed vs Tripoli SC',
      'Safa SC vs Racing Beirut',
      'Shabab Al Sahel vs Akhaa Ahli',
    ],
  },
  {
    derby: 'Der Klassiker',
    prompt: 'Which Bundesliga heavyweight duo meets in Der Klassiker?',
    answer: 'Bayern Munich vs Borussia Dortmund',
    options: [
      'Bayern Munich vs RB Leipzig',
      'Bayern Munich vs Borussia Dortmund',
      'Bayer Leverkusen vs Dortmund',
      'Schalke 04 vs Bayern Munich',
    ],
  },
  {
    derby: 'Derby della Madonnina',
    prompt: 'Which city and clubs star in the Derby della Madonnina?',
    answer: 'Inter Milan vs AC Milan',
    options: [
      'AS Roma vs Lazio',
      'Juventus vs Torino',
      'Inter Milan vs AC Milan',
      'Napoli vs Fiorentina',
    ],
  },
  {
    derby: 'El Clásico',
    prompt: 'Real Madrid vs FC Barcelona is globally known by which famous title?',
    answer: 'El Clásico',
    options: ['El Derbi Madrileño', 'El Clásico', 'El Superclásico', 'O Clássico'],
  },
  {
    derby: 'Riyadh Capital Derby',
    prompt: 'Which two Saudi Pro League titans headline the Riyadh Capital Derby?',
    answer: 'Al-Hilal vs Al-Nassr',
    options: [
      'Al-Ittihad vs Al-Ahli',
      'Al-Hilal vs Al-Nassr',
      'Al-Ettifaq vs Al-Shabab',
      'Al-Nassr vs Al-Ittihad',
    ],
  },
];

export const WORD_SCRAMBLE_PLAYERS = [
  { name: 'MBAPPE', hint: 'French World Cup winner & Real Madrid #9' },
  { name: 'HAALAND', hint: 'Norwegian goal machine at Manchester City' },
  { name: 'SALAH', hint: 'Liverpool right wing icon from Egypt' },
  { name: 'MAATOUK', hint: 'All-time top scorer for Lebanon Cedars' },
  { name: 'MESSI', hint: '8-time Ballon d’Or winner from Rosario' },
  { name: 'BELLINGHAM', hint: 'English midfielder starring in Madrid #5' },
  { name: 'RONALDO', hint: 'All-time UCL & international goal king' },
  { name: 'YAMAL', hint: 'Spanish teenage Euro 2024 sensation' },
];

export const EXTRA_TRIVIA_QUESTIONS = [
  {
    level: 'Beginner',
    question: 'Which club won the 2023–24 UEFA Champions League final at Wembley?',
    options: ['Borussia Dortmund', 'Real Madrid', 'Manchester City', 'Bayern Munich'],
    answerIndex: 1,
    fact: 'Real Madrid defeated Borussia Dortmund 2-0 at Wembley via goals from Carvajal and Vinícius Jr.',
  },
  {
    level: 'Tactical',
    question: 'In a 3-5-2 formation, which players typically provide width up and down both touchlines?',
    options: ['Inverted center-backs', 'Wing-backs', 'Double pivots', 'Sweeper keeper'],
    answerIndex: 1,
    fact: 'Wing-backs sprint the full flank, defending as a back five out of possession and pushing as wingers in attack.',
  },
  {
    level: 'Legend',
    question: 'Who scored the famous volley in the 2002 UEFA Champions League Final at Hampden Park?',
    options: ['Raúl González', 'Zinedine Zidane', 'Luís Figo', 'Roberto Carlos'],
    answerIndex: 1,
    fact: 'Zinedine Zidane’s left-footed volley against Bayer Leverkusen sealed Real Madrid’s ninth European Cup.',
  },
  {
    level: 'Legend',
    question: 'Which country won UEFA Euro 2024 in Berlin with seven straight tournament wins?',
    options: ['England', 'France', 'Spain', 'Germany'],
    answerIndex: 2,
    fact: 'Spain defeated England 2-1 in the Euro 2024 final, winning all seven matches in the competition.',
  },
];
