export type CodexEntry = {
  id: string;
  title: string;
  content: string;
  source: string;
};

export type Cutscene = {
  id: string;
  heading: string;
  title: string;
  text: string;
};

export type Dungeon = {
  id: string;
  name: string;
  description: string;
  difficulty: "Dễ" | "Trung bình" | "Khó";
  isUnlocked: boolean;
  lore: string;
  loreDepth: number;
};

export type DnNpcRole = "guide" | "boss" | "mentor" | "timekeeper";

export type DnNpc = {
  id: string;
  name: string;
  x: number;
  y: number;
  role: DnNpcRole;
  icon: string;
  dialogue: string;
  questId?: string;
};

export type PlayerCharacter = {
  id: string;
  name: string;
  role: string;
  baseHp: number;
  mana: number;
  power: number;
  speed: number;
  element: string;
  skills: string[];
  traits: string[];
};

export type DungeonQuestType = "codex" | "boss";

export type DungeonQuest = {
  id: string;
  title: string;
  description: string;
  type: DungeonQuestType;
  npcId: string;
  rewardCodexIds: string[];
  requiredCodexIds: string[];
  rewardSouls: number;
  rewardBattlePassXp: number;
  question?: string;
  options?: string[];
  correctOption?: string;
};

export type BattlePassTrack = {
  id: string;
  title: string;
  reward: number;
  requirement: string;
};

export const cutsceneSteps: Cutscene[] = [
  {
    id: "s1",
    heading: "Mở đầu",
    title: "Năm 2040: Đứt gãy ký ức",
    text: "Năm 2040, Trường Thiên Bạch phát hiện một cơn bão dữ liệu làm mờ các mốc lịch sử. Cánh cổng thời gian mở về buổi đầu dựng nước. Bạn là học sinh được chọn, mang theo nhiệm vụ khôi phục những ký ức đã mất.",
  },
  {
    id: "s2",
    heading: "Chuyển sinh",
    title: "Qua cổng của Canh Thời",
    text: "Ánh sáng tắt đi, tiếng trống đồng vọng lại. Bạn thức dậy giữa miền Văn Lang, nơi cộng đồng Lạc Việt đang kiến tạo một nhà nước sơ khai. Mỗi dữ kiện bạn tìm được sẽ giữ cho đường về năm 2040 không bị khép lại.",
  },
  {
    id: "s3",
    heading: "Nhiệm vụ đầu tiên",
    title: "Người canh cổng chỉ đường",
    text: "Người canh cổng nói rằng sức mạnh ở đây không đến từ việc nhớ máy móc. Hãy gặp các nhân vật, nhận bí kíp và kết nối dữ kiện về con người, tổ chức và thành tựu của Văn Lang trước khi đối diện thử thách cuối.",
  },
  {
    id: "s4",
    heading: "Hành trình",
    title: "Vào Văn Lang",
    text: "Phó bản đầu tiên đã mở. Hãy nghe chỉ dẫn, di chuyển bằng WASD, đứng gần NPC rồi nhấn Space để trao đổi. Khi đã có bí kíp, bạn có thể trả lời câu hỏi và đưa mảnh ký ức đầu tiên trở về hiện tại.",
  },
];

export const mapDungeons: Dungeon[] = [
  {
    id: "vanlang",
    name: "Văn Lang",
    description: "Phó bản mở đầu về buổi đầu dựng nước: làng ven sông, trống đồng và những cộng đồng Lạc Việt.",
    difficulty: "Dễ",
    isUnlocked: true,
    lore: "Nhà nước sơ khai gắn với các Vua Hùng và nền tảng văn hóa Đông Sơn.",
    loreDepth: 1,
  },
  {
    id: "au-lac",
    name: "Âu Lạc",
    description: "Phó bản kế tiếp về sự nối tiếp và phát triển của thời kỳ dựng nước.",
    difficulty: "Trung bình",
    isUnlocked: false,
    lore: "Chưa mở trong MVP.",
    loreDepth: 2,
  },
  {
    id: "thang-long",
    name: "Thăng Long",
    description: "Phó bản trung cấp đưa người chơi đến một trung tâm chính trị ở thời kỳ sau.",
    difficulty: "Khó",
    isUnlocked: false,
    lore: "Chưa mở trong MVP.",
    loreDepth: 3,
  },
];

export const dungeonNpcs: DnNpc[] = [
  {
    id: "timekeeper",
    name: "Huyền Quan Canh Thời",
    icon: "CT",
    x: 1,
    y: 1,
    role: "timekeeper",
    dialogue: "Ta giữ cổng chuyển sinh. Hãy đi theo nhịp này: gặp nhà sử học, nhận bí kíp, rồi dùng dữ kiện để vượt qua thử thách. Văn Lang là cánh cổng duy nhất đang mở.",
  },
  {
    id: "guide",
    name: "Sử quan Tuyên",
    icon: "SK",
    x: 5,
    y: 5,
    role: "guide",
    questId: "quest-guide-scroll",
    dialogue: "Hãy nhớ: Văn Lang được xem là nhà nước sơ khai, đứng đầu bởi các Vua Hùng và gắn với nền tảng văn hóa Đông Sơn. Bí kíp sẽ giúp ngươi đọc đúng mảnh ký ức.",
  },
  {
    id: "mentor",
    name: "Nghệ nhân Trống Đồng",
    icon: "NT",
    x: 2,
    y: 6,
    role: "mentor",
    dialogue: "Tiếng trống không chỉ là âm thanh. Nó nhắc ta về kỹ nghệ luyện đúc đồng và đời sống cộng đồng. Hãy quay lại sau khi vượt qua thử thách.",
  },
  {
    id: "boss",
    name: "Thử thách Ký Ức Hùng Vương",
    icon: "TH",
    x: 6,
    y: 2,
    role: "boss",
    questId: "boss-vanlang-memory",
    dialogue: "Muốn lấy lại ký ức, hãy ghép đúng dữ kiện từ bí kíp. Câu trả lời phải nói được điều gì làm nên dấu mốc Văn Lang.",
  },
];

export const codexEntries: CodexEntry[] = [
  {
    id: "vanlang-foundation",
    title: "Bí kíp Buổi đầu dựng nước",
    content: "Văn Lang thường được mô tả là một nhà nước sơ khai thời Hùng Vương, hình thành trên nền tảng văn hóa Đông Sơn vào khoảng thế kỷ VII-VI trước Công nguyên theo những nghiên cứu được phổ biến.",
    source: "Bảo tàng Lịch sử Quốc gia và báo Nhân Dân (dữ liệu mock, cần hội đồng chuyên môn duyệt)",
  },
  {
    id: "vanlang-organization",
    title: "Bí kíp Cộng đồng Lạc Việt",
    content: "Sử liệu thường nhắc đến Vua Hùng đứng đầu, cùng Lạc hầu, Lạc tướng và các bộ. Đây là dữ kiện để nhận diện tổ chức nhà nước sơ khai trong phó bản.",
    source: "Báo Nhân Dân (dữ liệu mock, cần hội đồng chuyên môn duyệt)",
  },
  {
    id: "vanlang-dongson",
    title: "Bí kíp Trống đồng Đông Sơn",
    content: "Các dấu tích văn hóa Đông Sơn, đặc biệt kỹ nghệ luyện đúc đồng, là chìa khóa để nhận diện bối cảnh vật chất của buổi đầu dựng nước.",
    source: "Bảo tàng Lịch sử Quốc gia (dữ liệu mock, cần hội đồng chuyên môn duyệt)",
  },
  {
    id: "vanlang-community",
    title: "Bí kíp Sức mạnh cộng đồng",
    content: "Sự hình thành Văn Lang gắn với nhu cầu liên kết cộng đồng, sản xuất và tổ chức đời sống. Hãy dùng dữ kiện này để liên hệ kiến thức với bối cảnh trong game.",
    source: "Tổng hợp học liệu mock, chờ đội chuyên môn duyệt",
  },
];

export const dungeonQuests: DungeonQuest[] = [
  {
    id: "quest-guide-scroll",
    title: "Nhận bí kíp khai mở",
    description: "Gặp Sử quan Tuyên để nhận mảnh dữ kiện đầu tiên về sự ra đời của Văn Lang.",
    type: "codex",
    npcId: "guide",
    requiredCodexIds: [],
    rewardCodexIds: ["vanlang-foundation"],
    rewardSouls: 50,
    rewardBattlePassXp: 15,
  },
  {
    id: "boss-vanlang-memory",
    title: "Bài kiểm tra Ký ức Hùng Vương",
    description: "Dùng bí kíp đã nhận để xác định đặc điểm phù hợp với bối cảnh Văn Lang.",
    type: "boss",
    npcId: "boss",
    requiredCodexIds: ["vanlang-foundation"],
    rewardCodexIds: ["vanlang-organization", "vanlang-dongson", "vanlang-community"],
    rewardSouls: 120,
    rewardBattlePassXp: 40,
    question: "Dữ kiện nào phù hợp nhất để nhận diện Văn Lang trong phó bản?",
    options: [
      "Một nhà nước sơ khai thời Hùng Vương, gắn với nền tảng văn hóa Đông Sơn.",
      "Kinh đô Cổ Loa với nỏ thần của An Dương Vương.",
      "Trận địa cọc Bạch Đằng vào thế kỷ X.",
    ],
    correctOption: "Một nhà nước sơ khai thời Hùng Vương, gắn với nền tảng văn hóa Đông Sơn.",
  },
];

export const bossQuest = {
  id: dungeonQuests[1].id,
  intro: "Lượt này kiểm tra khả năng kết nối dữ kiện Văn Lang.",
  question: dungeonQuests[1].question ?? "",
  options: dungeonQuests[1].options ?? [],
  correctOption: dungeonQuests[1].correctOption ?? "",
  rewardCodexIds: dungeonQuests[1].rewardCodexIds,
};

export const battlePassTracks: BattlePassTrack[] = [
  { id: "track-1", title: "Hoàn tất Onboarding", reward: 20, requirement: "Hoàn thành màn giới thiệu" },
  { id: "track-2", title: "Mở khóa NPC đầu tiên", reward: 40, requirement: "Nhận bí kíp từ Sử quan" },
  { id: "track-3", title: "Hoàn tất thử thách Văn Lang", reward: 100, requirement: "Trả lời đúng bài kiểm tra" },
  { id: "track-4", title: "Nhận bí kíp mở rộng", reward: 120, requirement: "Mở các bí kíp sau thử thách" },
];

export const dungeonTips = [
  "Đứng gần NPC rồi nhấn Space để trao đổi.",
  "Nhận bí kíp từ Sử quan Tuyên trước khi vào thử thách.",
  "Mở tab Bí kíp để ghép dữ kiện trước khi trả lời.",
];

export const playerCharacters: PlayerCharacter[] = [
  {
    id: "hero-khien",
    name: "Kiên Khẩn",
    role: "Di chuyển đa hướng",
    baseHp: 190,
    mana: 120,
    power: 42,
    speed: 4,
    element: "Lôi",
    skills: ["Bước chớp", "Phản kích", "Kiềm lĩnh đội hình"],
    traits: ["Dẫn đường", "Duy trì nhịp đánh cao"],
  },
  {
    id: "hero-linh",
    name: "Linh Nhi",
    role: "Hỗ trợ câu đố",
    baseHp: 150,
    mana: 180,
    power: 34,
    speed: 3,
    element: "Linh",
    skills: ["Dẫn tâm", "Ký ức mù", "Hồi phục nhịp"],
    traits: ["Phục hồi", "Nhìn bối cảnh tốt"],
  },
  {
    id: "hero-pha",
    name: "Pha Lãng",
    role: "Sát thương bùng nổ",
    baseHp: 210,
    mana: 90,
    power: 58,
    speed: 4,
    element: "Hỏa",
    skills: ["Đòn xoáy", "Phá lớp", "Ám ảnh"],
    traits: ["Dồn sát thương", "Bạo lực kiểm soát"],
  },
];