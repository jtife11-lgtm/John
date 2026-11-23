(function () {
  var savedApiBase = '';
  try {
    savedApiBase = localStorage.getItem('str_standalone_api_base') || '';
  } catch (e) {}

  window.STR_CONFIG = {
    BRAND_NAME: 'STR SCORES',
    LOGO_URL: './assets/images/str_scores_logo_1795349596176.jpg',
    HERO_IMG: './assets/images/hero_stadium_night_1795349596580.jpg',
    NEWS_FALLBACK_IMG: './assets/images/news_transfer_spotlight_1795349597558.jpg',
    GAMES_BANNER_IMG: './assets/images/games_hub_banner_1795349597794.jpg',
    AVATAR_DEFAULT_IMG: './assets/images/avatar_fan_default_1795349597218.jpg',
    API_BASE: savedApiBase,
    FIREBASE_CONFIG: {
      projectId: 'gen-lang-client-0826984416',
      appId: '1:739718706778:web:fe15b854c395d1018c4a63',
      apiKey: 'AIzaSyBrCnbox-dYlwDcWKSHyalOMG8_V19G7kM',
      authDomain: 'gen-lang-client-0826984416.firebaseapp.com',
      firestoreDatabaseId: 'ai-studio-7ed087f4-9c0e-4b0d-9234-d9749b4aab46',
      storageBucket: 'gen-lang-client-0826984416.firebasestorage.app',
      messagingSenderId: '739718706778'
    }
  };

  window.STR_I18N = {
    en: {
      home: 'Home',
      scores: 'Scores',
      simulator: 'Match Sim',
      chat: 'Chat',
      games: 'Games',
      news: 'News',
      cards: 'Player Cards',
      players: 'Players',
      aiCenter: 'STR AI Analyst',
      stats: 'Statistics',
      fantasy: 'Fantasy',
      vote: 'STR VOTE',
      explore: 'Explore',
      profile: 'Profile'
    },
    ar: {
      home: 'الرئيسية',
      scores: 'النتائج',
      simulator: 'محاكي المباريات',
      chat: 'الدردشة',
      games: 'الألعاب',
      news: 'الأخبار',
      cards: 'بطاقات اللاعبين',
      players: 'اللاعبون',
      aiCenter: 'محلل STR الذكي',
      stats: 'الإحصائيات',
      fantasy: 'الفانتازي',
      vote: 'تصويت STR',
      explore: 'استكشف',
      profile: 'حسابي'
    }
  };
})();
