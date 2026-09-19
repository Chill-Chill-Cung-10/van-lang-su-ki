export type CongHuyenSuQuestion = {
  [key: string]: unknown;
  piece_id: string;
  order: number;
  asset_id: string;
  difficulty: string;
  question: string;
  options: Record<"A" | "B" | "C" | "D", string>;
  answer: "A" | "B" | "C" | "D";
  explanation: string;
};

export type CongHuyenSuCard = {
  [key: string]: unknown;
  knowledge_id: string;
  sequence: number;
  title: string;
  story_transition?: string;
  card_text: string;
  source_type: string;
  claim_status: string;
  questions: CongHuyenSuQuestion[];
};

export const congHuyenSuCards: CongHuyenSuCard[] = [
  {
    "knowledge_id": "BK_01",
    "sequence": 1,
    "title": "Danh Xưng Khởi Nguyên",
    "story_transition": "Tấm bia mất tên. Người chơi phải gọi đúng danh xưng đầu tiên để đánh thức ba mảnh đá.",
    "card_text": "Muốn phục hồi bia đá, trước hết phải gọi đúng tên người đã bị Sương Quên Lãng xóa mất. Theo sử cũ, Kinh Dương Vương có tên là Lộc Tục. Câu chuyện về ông thuộc lớp huyền sử được người xưa ghi lại. Vì vậy, hãy nhớ cách nói cẩn trọng: “theo sử cũ”, chứ không coi hình tượng trong game là chân dung lịch sử đã được xác nhận.",
    "source_type": "Tư liệu thành văn + huyền sử",
    "claim_status": "Huyền sử được sử cũ ghi lại",
    "source_ids": [
      "S1",
      "G1"
    ],
    "ai_tags": [
      "kinh-duong-vuong"
    ],
    "audit_status": "Source-grounded; cần giáo viên duyệt",
    "questions": [
      {
        "piece_id": "piece_01",
        "order": 1,
        "asset_id": "stone_piece_01",
        "difficulty": "Dễ",
        "question": "Theo sử cũ, tên của Kinh Dương Vương là gì?",
        "options": {
          "A": "Lộc Tục",
          "B": "Sùng Lãm",
          "C": "Thục Phán",
          "D": "Lang Liêu"
        },
        "answer": "A",
        "explanation": "Theo sử cũ, Kinh Dương Vương có tên là Lộc Tục.",
        "source_ids": [
          "S1",
          "G1"
        ],
        "ai_tags": [
          "kinh-duong-vuong"
        ],
        "bank_ref": "M01-01",
        "answerable_from_card": true,
        "teacher_review": "required"
      },
      {
        "piece_id": "piece_02",
        "order": 2,
        "asset_id": "stone_piece_02",
        "difficulty": "Vừa",
        "question": "Cách viết nào cẩn trọng và phù hợp nhất?",
        "options": {
          "A": "Khảo cổ học đã chứng minh Kinh Dương Vương chắc chắn có tên Lộc Tục.",
          "B": "Theo sử cũ, Kinh Dương Vương có tên là Lộc Tục.",
          "C": "Lộc Tục là tên do trò chơi sáng tạo.",
          "D": "Hình 3D của Kinh Dương Vương chứng minh tên thật của ông."
        },
        "answer": "B",
        "explanation": "Cụm “theo sử cũ” giữ đúng mức độ chắc chắn của nguồn.",
        "source_ids": [
          "S1",
          "G1"
        ],
        "ai_tags": [
          "kinh-duong-vuong"
        ],
        "bank_ref": "M01-05",
        "answerable_from_card": true,
        "teacher_review": "required"
      },
      {
        "piece_id": "piece_03",
        "order": 3,
        "asset_id": "stone_piece_03",
        "difficulty": "Khó",
        "question": "Game dựng một hình tượng Kinh Dương Vương rất uy nghiêm. Điều nào đúng?",
        "options": {
          "A": "Đây chính là chân dung thật của ông.",
          "B": "Hình 3D quan trọng hơn sử liệu.",
          "C": "Tạo hình là phỏng dựng của game; thông tin về tên vẫn phải dựa vào nguồn.",
          "D": "Chỉ cần hình ảnh giống cổ xưa thì có thể coi là chứng cứ."
        },
        "answer": "C",
        "explanation": "Tạo hình game là phỏng dựng mỹ thuật, không phải chứng cứ lịch sử trực tiếp.",
        "source_ids": [
          "G1"
        ],
        "ai_tags": [
          "kinh-duong-vuong"
        ],
        "bank_ref": "Thiết kế mới từ G1",
        "answerable_from_card": true,
        "teacher_review": "required"
      }
    ]
  },
  {
    "knowledge_id": "BK_02",
    "sequence": 2,
    "title": "Dấu Mực Hồng Bàng",
    "story_transition": "Tên đã hiện, nhưng Người Giữ Sử yêu cầu tìm nơi tên ấy được ghi lại.",
    "card_text": "Một cái tên chưa đủ. Người giữ sử phải biết tên ấy được ghi ở đâu. Trong Đại Việt sử ký toàn thư, mục Kinh Dương Vương nằm ở Kỷ Hồng Bàng thị. Đây là tư liệu thành văn: nó cho biết câu chuyện đã được người xưa ghi chép, nhưng bản thân việc được chép trong sách không có nghĩa mọi chi tiết đều đã được khảo cổ xác nhận.",
    "source_type": "Tư liệu thành văn",
    "claim_status": "Vị trí ghi chép trong sử cũ; không đồng nhất với chứng cứ khảo cổ",
    "source_ids": [
      "S1",
      "G1"
    ],
    "ai_tags": [
      "ky-hong-bang",
      "dai-viet-su-ky"
    ],
    "audit_status": "Source-grounded; cần giáo viên duyệt",
    "questions": [
      {
        "piece_id": "piece_04",
        "order": 4,
        "asset_id": "stone_piece_04",
        "difficulty": "Dễ",
        "question": "Trong Đại Việt sử ký toàn thư, Kinh Dương Vương được đặt ở phần nào?",
        "options": {
          "A": "Kỷ Nhà Thục",
          "B": "Kỷ Nhà Triệu",
          "C": "Kỷ Hồng Bàng thị",
          "D": "Kỷ Trưng Nữ Vương"
        },
        "answer": "C",
        "explanation": "Mục Kinh Dương Vương nằm trong Kỷ Hồng Bàng thị.",
        "source_ids": [
          "S1",
          "G1"
        ],
        "ai_tags": [
          "ky-hong-bang"
        ],
        "bank_ref": "M01-07",
        "answerable_from_card": true,
        "teacher_review": "required"
      },
      {
        "piece_id": "piece_05",
        "order": 5,
        "asset_id": "stone_piece_05",
        "difficulty": "Vừa",
        "question": "Đại Việt sử ký toàn thư trong câu hỏi này được dùng với vai trò nào?",
        "options": {
          "A": "Tư liệu thành văn",
          "B": "Hiện vật khảo cổ",
          "C": "Vật phẩm gameplay",
          "D": "Bản đồ hành chính"
        },
        "answer": "A",
        "explanation": "Đây là nguồn văn bản được ghi chép bằng chữ.",
        "source_ids": [
          "S1",
          "G1"
        ],
        "ai_tags": [
          "dai-viet-su-ky"
        ],
        "bank_ref": "M01-09",
        "answerable_from_card": true,
        "teacher_review": "required"
      },
      {
        "piece_id": "piece_06",
        "order": 6,
        "asset_id": "stone_piece_06",
        "difficulty": "Khó",
        "question": "Việc một câu chuyện xuất hiện trong sử cũ cho phép kết luận chắc chắn nhất điều gì?",
        "options": {
          "A": "Mọi chi tiết trong câu chuyện đều đã được khảo cổ xác nhận.",
          "B": "Người xưa đã ghi lại câu chuyện trong tư liệu thành văn.",
          "C": "Các hình ảnh minh họa hiện nay đều là chân dung thật.",
          "D": "Có thể xác định chính xác mọi địa điểm trong câu chuyện."
        },
        "answer": "B",
        "explanation": "Sử cũ cho biết câu chuyện đã được ghi chép; điều đó không tự động xác nhận mọi chi tiết bằng khảo cổ.",
        "source_ids": [
          "S1",
          "G1"
        ],
        "ai_tags": [
          "gioi-han-su-lieu"
        ],
        "bank_ref": "Thiết kế mới từ S1/G1",
        "answerable_from_card": true,
        "teacher_review": "required"
      }
    ]
  },
  {
    "knowledge_id": "BK_03",
    "sequence": 3,
    "title": "Con Mắt Người Giữ Sử",
    "story_transition": "Người chơi đã tìm được văn bản, giờ phải học cách không nhầm 'được ghi chép' với 'được khảo cổ xác nhận'.",
    "card_text": "Người học sử phải nhìn bằng hai con mắt. Một mắt hỏi: “Thông tin này đến từ nguồn nào?”; mắt kia hỏi: “Nó chắc chắn đến mức nào?”. Một câu chuyện có thể được ghi trong sách nhưng vẫn thuộc lớp huyền sử. Huyền sử có giá trị về ký ức và văn hóa, nhưng không đồng nghĩa với chứng cứ khảo cổ trực tiếp về một nhân vật.",
    "source_type": "Phương pháp đọc nguồn",
    "claim_status": "Phân biệt nguồn và mức độ chắc chắn",
    "source_ids": [
      "G1"
    ],
    "ai_tags": [
      "huyen-su",
      "gioi-han-su-lieu",
      "chung-cu-truc-tiep"
    ],
    "audit_status": "Source-grounded; cần giáo viên duyệt",
    "questions": [
      {
        "piece_id": "piece_07",
        "order": 7,
        "asset_id": "stone_piece_07",
        "difficulty": "Dễ",
        "question": "Trong Chặng 1, Kinh Dương Vương được trình bày thuộc lớp nào?",
        "options": {
          "A": "Nhân vật có tiểu sử khảo cổ hoàn chỉnh",
          "B": "Nhân vật huyền sử",
          "C": "NPC do game sáng tạo",
          "D": "Nhân vật thời hiện đại"
        },
        "answer": "B",
        "explanation": "Tài liệu Chặng 1 xác định Kinh Dương Vương thuộc lớp huyền sử.",
        "source_ids": [
          "G1"
        ],
        "ai_tags": [
          "huyen-su"
        ],
        "bank_ref": "Thiết kế mới từ G1",
        "answerable_from_card": true,
        "teacher_review": "required"
      },
      {
        "piece_id": "piece_08",
        "order": 8,
        "asset_id": "stone_piece_08",
        "difficulty": "Vừa",
        "question": "Một câu chuyện được ghi trong sử cũ có thể đồng thời thuộc lớp huyền sử không?",
        "options": {
          "A": "Có",
          "B": "Không, cứ vào sử sách là trở thành chứng cứ khảo cổ",
          "C": "Chỉ khi có hình 3D",
          "D": "Chỉ khi game xác nhận"
        },
        "answer": "A",
        "explanation": "Nguồn ghi chép và mức độ chắc chắn của nội dung là hai việc khác nhau.",
        "source_ids": [
          "G1"
        ],
        "ai_tags": [
          "huyen-su",
          "gioi-han-su-lieu"
        ],
        "bank_ref": "Thiết kế mới từ G1",
        "answerable_from_card": true,
        "teacher_review": "required"
      },
      {
        "piece_id": "piece_09",
        "order": 9,
        "asset_id": "stone_piece_09",
        "difficulty": "Khó",
        "question": "Nếu tìm thấy một hiện vật cổ của cộng đồng sống trong thời xa xưa, có thể lập tức khẳng định hiện vật đó thuộc trực tiếp về Kinh Dương Vương không?",
        "options": {
          "A": "Có, vì cùng thời xa xưa",
          "B": "Có, nếu hiện vật đẹp",
          "C": "Không; muốn gắn trực tiếp với một cá nhân cần chứng cứ riêng",
          "D": "Có, nếu đặt hiện vật cạnh tượng Kinh Dương Vương"
        },
        "answer": "C",
        "explanation": "Tài liệu yêu cầu không gắn trực tiếp hiện vật khảo cổ với Kinh Dương Vương khi chưa có chứng cứ.",
        "source_ids": [
          "G1"
        ],
        "ai_tags": [
          "chung-cu-truc-tiep"
        ],
        "bank_ref": "Thiết kế mới từ G1",
        "answerable_from_card": true,
        "teacher_review": "required"
      }
    ]
  },
  {
    "knowledge_id": "BK_04",
    "sequence": 4,
    "title": "Xích Quỷ Trong Màn Sương",
    "story_transition": "Bia đã có tên người. Một tên xứ hiện ra trong màn sương và cần được đọc đúng bản chất.",
    "card_text": "Khi danh tính đã sáng rõ, một tên khác hiện lên trên bia: Xích Quỷ. Trong hệ thống truyền thuyết và sử cũ, tên Xích Quỷ được gắn với Kinh Dương Vương. Nhưng hãy giữ vững phép đọc sử: đây là tên xuất hiện trong câu chuyện nguồn gốc, không phải một tỉnh hay đơn vị hành chính hiện đại mà ta có thể đem bản đồ ngày nay áp vào.",
    "source_type": "Huyền sử + tư liệu thành văn",
    "claim_status": "Tên xứ trong truyền thuyết/sử cũ",
    "source_ids": [
      "S1",
      "G1"
    ],
    "ai_tags": [
      "xich-quy"
    ],
    "audit_status": "Source-grounded; cần giáo viên duyệt",
    "questions": [
      {
        "piece_id": "piece_10",
        "order": 10,
        "asset_id": "stone_piece_10",
        "difficulty": "Dễ",
        "question": "Tên nào được truyền thuyết và sử cũ gắn với Kinh Dương Vương?",
        "options": {
          "A": "Âu Lạc",
          "B": "Đại Việt",
          "C": "Xích Quỷ",
          "D": "Đại Nam"
        },
        "answer": "C",
        "explanation": "Xích Quỷ là tên xuất hiện trong truyền thuyết và sử cũ liên quan Kinh Dương Vương.",
        "source_ids": [
          "S1",
          "G1"
        ],
        "ai_tags": [
          "xich-quy"
        ],
        "bank_ref": "M03-01",
        "answerable_from_card": true,
        "teacher_review": "required"
      },
      {
        "piece_id": "piece_11",
        "order": 11,
        "asset_id": "stone_piece_11",
        "difficulty": "Vừa",
        "question": "Cách nói nào phù hợp nhất?",
        "options": {
          "A": "Xích Quỷ chắc chắn là một tỉnh thời cổ.",
          "B": "Theo truyền thuyết và sử cũ, tên Xích Quỷ được gắn với Kinh Dương Vương.",
          "C": "Xích Quỷ là địa danh do game tự đặt.",
          "D": "Xích Quỷ có đường biên giống Việt Nam hiện nay."
        },
        "answer": "B",
        "explanation": "Cách nói này nêu rõ loại nguồn và không khẳng định quá mức.",
        "source_ids": [
          "S1",
          "G1"
        ],
        "ai_tags": [
          "xich-quy"
        ],
        "bank_ref": "Thiết kế mới từ S1/G1",
        "answerable_from_card": true,
        "teacher_review": "required"
      },
      {
        "piece_id": "piece_12",
        "order": 12,
        "asset_id": "stone_piece_12",
        "difficulty": "Khó",
        "question": "Điều nào vượt quá những gì Bí kíp cho phép kết luận?",
        "options": {
          "A": "Tên Xích Quỷ xuất hiện trong câu chuyện nguồn gốc.",
          "B": "Sử cũ có ghi tên Xích Quỷ.",
          "C": "Có thể lấy một tỉnh hiện đại làm chính xác lãnh thổ Xích Quỷ.",
          "D": "Khi nói về Xích Quỷ cần nêu rõ tính chất nguồn."
        },
        "answer": "C",
        "explanation": "Không có căn cứ để đồng nhất Xích Quỷ với một tỉnh hiện đại.",
        "source_ids": [
          "G1"
        ],
        "ai_tags": [
          "xich-quy",
          "gioi-han-su-lieu"
        ],
        "bank_ref": "Thiết kế mới từ G1",
        "answerable_from_card": true,
        "teacher_review": "required"
      }
    ]
  },
  {
    "knowledge_id": "BK_05",
    "sequence": 5,
    "title": "Biên Giới Không Được Vẽ Bừa",
    "story_transition": "Sương Quên Lãng đã vẽ thêm đường biên hiện đại. Người chơi phải xóa phần không có căn cứ.",
    "card_text": "Sương Quên Lãng nguy hiểm nhất khi biến điều chưa biết thành điều tưởng như chắc chắn. Với Xích Quỷ, chưa có đủ căn cứ để vẽ một đường biên chính xác như bản đồ quốc gia hiện đại. Biên giới Việt Nam ngày nay không phải bằng chứng về đường biên Xích Quỷ. Vì thế, bản đồ trong game chỉ được gọi là “không gian huyền sử được phỏng dựng”.",
    "source_type": "Giới hạn sử liệu + thiết kế game",
    "claim_status": "Chưa đủ chứng cứ cho đường biên chính xác",
    "source_ids": [
      "G1"
    ],
    "ai_tags": [
      "duong-bien",
      "bien-gioi-hien-dai",
      "ban-do-phong-dung"
    ],
    "audit_status": "Source-grounded; cần giáo viên duyệt",
    "questions": [
      {
        "piece_id": "piece_13",
        "order": 13,
        "asset_id": "stone_piece_13",
        "difficulty": "Dễ",
        "question": "Có thể vẽ chính xác đường biên Xích Quỷ như một quốc gia hiện đại không?",
        "options": {
          "A": "Có",
          "B": "Chưa có đủ chứng cứ để làm vậy",
          "C": "Có thể dùng ngay biên giới Việt Nam",
          "D": "Có thể dựa vào hình đẹp nhất"
        },
        "answer": "B",
        "explanation": "Tài liệu nêu chưa có đủ chứng cứ để xác định đường biên Xích Quỷ chính xác.",
        "source_ids": [
          "G1"
        ],
        "ai_tags": [
          "duong-bien"
        ],
        "bank_ref": "M03-07",
        "answerable_from_card": true,
        "teacher_review": "required"
      },
      {
        "piece_id": "piece_14",
        "order": 14,
        "asset_id": "stone_piece_14",
        "difficulty": "Vừa",
        "question": "Vì sao không nên lấy biên giới Việt Nam hiện nay làm đường biên Xích Quỷ?",
        "options": {
          "A": "Vì bản đồ hiện đại không có giá trị",
          "B": "Vì hai thông tin thuộc bối cảnh khác nhau và không có chứng cứ cho việc áp nguyên đường biên",
          "C": "Vì Xích Quỷ không có tên trong sử cũ",
          "D": "Vì game không được dùng bản đồ"
        },
        "answer": "B",
        "explanation": "Biên giới hiện đại không phải bằng chứng để xác định đường biên của không gian huyền sử.",
        "source_ids": [
          "G1"
        ],
        "ai_tags": [
          "bien-gioi-hien-dai"
        ],
        "bank_ref": "M03-16",
        "answerable_from_card": true,
        "teacher_review": "required"
      },
      {
        "piece_id": "piece_15",
        "order": 15,
        "asset_id": "stone_piece_15",
        "difficulty": "Khó",
        "question": "Dòng chú thích nào nên đặt dưới bản đồ Xích Quỷ của game?",
        "options": {
          "A": "Bản đồ khảo cổ chính thức",
          "B": "Bản đồ hành chính Xích Quỷ",
          "C": "Không gian huyền sử được phỏng dựng từ truyền thuyết",
          "D": "Biên giới Việt Nam thời Kinh Dương Vương"
        },
        "answer": "C",
        "explanation": "Bản đồ trong game là phương tiện kể chuyện và phải được ghi rõ là phỏng dựng.",
        "source_ids": [
          "G1"
        ],
        "ai_tags": [
          "ban-do-phong-dung"
        ],
        "bank_ref": "M03-23",
        "answerable_from_card": true,
        "teacher_review": "required"
      }
    ]
  },
  {
    "knowledge_id": "BK_06",
    "sequence": 6,
    "title": "Huyết Mạch Mở Lối",
    "story_transition": "Sau tên người và tên xứ, bia lộ ra dấu nối sang người kế tiếp trong tuyến huyền sử.",
    "card_text": "Tấm bia đã có tên người và tên xứ. Giờ đến dấu vết của người nối tiếp. Theo truyền thuyết, Kinh Dương Vương sinh Sùng Lãm, tức Lạc Long Quân. Lạc Long Quân kết duyên với Âu Cơ; câu chuyện tiếp tục dẫn đến nguồn gốc các Vua Hùng. Đây là trình tự của truyền thuyết, không phải gia phả đã được khảo cổ xác nhận.",
    "source_type": "Huyền sử/truyền thuyết",
    "claim_status": "Quan hệ nhân vật theo truyền thuyết",
    "source_ids": [
      "S2",
      "G1"
    ],
    "ai_tags": [
      "pha-he",
      "sung-lam"
    ],
    "audit_status": "Source-grounded; cần giáo viên duyệt",
    "questions": [
      {
        "piece_id": "piece_16",
        "order": 16,
        "asset_id": "stone_piece_16",
        "difficulty": "Dễ",
        "question": "Sùng Lãm là tên gắn với nhân vật nào trong truyền thuyết?",
        "options": {
          "A": "An Dương Vương",
          "B": "Lạc Long Quân",
          "C": "Thánh Gióng",
          "D": "Lang Liêu"
        },
        "answer": "B",
        "explanation": "Sùng Lãm là tên của Lạc Long Quân trong tuyến huyền sử được dùng ở Chặng 1.",
        "source_ids": [
          "S2",
          "G1"
        ],
        "ai_tags": [
          "sung-lam"
        ],
        "bank_ref": "M02-01",
        "answerable_from_card": true,
        "teacher_review": "required"
      },
      {
        "piece_id": "piece_17",
        "order": 17,
        "asset_id": "stone_piece_17",
        "difficulty": "Vừa",
        "question": "Theo truyền thuyết, quan hệ giữa Kinh Dương Vương và Lạc Long Quân là gì?",
        "options": {
          "A": "Hai anh em",
          "B": "Thầy và trò",
          "C": "Cha và con",
          "D": "Hai vị tướng"
        },
        "answer": "C",
        "explanation": "Theo truyền thuyết, Kinh Dương Vương sinh Sùng Lãm, tức Lạc Long Quân.",
        "source_ids": [
          "S2",
          "G1"
        ],
        "ai_tags": [
          "pha-he",
          "sung-lam"
        ],
        "bank_ref": "M02-04",
        "answerable_from_card": true,
        "teacher_review": "required"
      },
      {
        "piece_id": "piece_18",
        "order": 18,
        "asset_id": "stone_piece_18",
        "difficulty": "Khó",
        "question": "Trình tự nào đúng với tuyến truyền thuyết nguồn gốc đang được học?",
        "options": {
          "A": "Lạc Long Quân → Kinh Dương Vương → các Vua Hùng",
          "B": "Các Vua Hùng → Kinh Dương Vương → Lạc Long Quân",
          "C": "Kinh Dương Vương → Lạc Long Quân → nguồn gốc các Vua Hùng",
          "D": "Kinh Dương Vương → các Vua Hùng → Lạc Long Quân"
        },
        "answer": "C",
        "explanation": "Tuyến học đi từ Kinh Dương Vương đến Lạc Long Quân, rồi tiếp nối câu chuyện nguồn gốc các Vua Hùng.",
        "source_ids": [
          "S2",
          "G1"
        ],
        "ai_tags": [
          "pha-he"
        ],
        "bank_ref": "Thiết kế mới từ S2/G1",
        "answerable_from_card": true,
        "teacher_review": "required"
      }
    ]
  },
  {
    "knowledge_id": "BK_07",
    "sequence": 7,
    "title": "Phán Quyết Của Người Giữ Sử",
    "story_transition": "Trước mảnh cuối, Người Giữ Sử yêu cầu phân loại đúng mọi dấu vết đã gặp.",
    "card_text": "Trước khi ghép mảnh cuối, hãy phân biệt bốn lớp thông tin. Truyền thuyết/huyền sử kể về Kinh Dương Vương, Xích Quỷ và quan hệ nhân vật. Tư liệu thành văn là những văn bản như Đại Việt sử ký toàn thư. Khảo cổ nghiên cứu di tích, hiện vật và đời sống vật chất của cộng đồng cổ. Hư cấu game gồm Lạc Nhi, Sương Quên Lãng, Vương Ấn và các cơ chế thử thách.",
    "source_type": "Phân loại nguồn",
    "claim_status": "Khung phân loại dùng trong Chặng 1",
    "source_ids": [
      "G1"
    ],
    "ai_tags": [
      "bon-loai-nguon",
      "mau-thong-tin"
    ],
    "audit_status": "Source-grounded; cần giáo viên duyệt",
    "questions": [
      {
        "piece_id": "piece_19",
        "order": 19,
        "asset_id": "stone_piece_19",
        "difficulty": "Dễ",
        "question": "Lạc Nhi và Sương Quên Lãng thuộc nhóm nào?",
        "options": {
          "A": "Tư liệu thành văn",
          "B": "Huyền sử",
          "C": "Khảo cổ",
          "D": "Hư cấu phục vụ gameplay"
        },
        "answer": "D",
        "explanation": "Lạc Nhi và Sương Quên Lãng là các yếu tố hư cấu của game.",
        "source_ids": [
          "G1"
        ],
        "ai_tags": [
          "bon-loai-nguon"
        ],
        "bank_ref": "M07-01",
        "answerable_from_card": true,
        "teacher_review": "required"
      },
      {
        "piece_id": "piece_20",
        "order": 20,
        "asset_id": "stone_piece_20",
        "difficulty": "Vừa",
        "question": "Nội dung nào là ví dụ rõ nhất về tư liệu thành văn?",
        "options": {
          "A": "Một dòng ghi chép trong Đại Việt sử ký toàn thư",
          "B": "Lạc Nhi bay cạnh người chơi",
          "C": "Một Vương Ấn phát sáng",
          "D": "Bản đồ 3D do đội game dựng"
        },
        "answer": "A",
        "explanation": "Đại Việt sử ký toàn thư là tư liệu thành văn; các lựa chọn còn lại là thành phần game.",
        "source_ids": [
          "S1",
          "G1"
        ],
        "ai_tags": [
          "bon-loai-nguon"
        ],
        "bank_ref": "M07-04",
        "answerable_from_card": true,
        "teacher_review": "required"
      },
      {
        "piece_id": "piece_21",
        "order": 21,
        "asset_id": "stone_piece_21",
        "difficulty": "Khó",
        "question": "Với câu: “Đại Việt sử ký toàn thư ghi Kinh Dương Vương có tên Lộc Tục”, cách hiểu nào đầy đủ nhất?",
        "options": {
          "A": "Vì xuất hiện trong sách nên mọi chi tiết về Kinh Dương Vương đã được khảo cổ chứng minh.",
          "B": "Nguồn ghi là tư liệu thành văn; nội dung thuộc lớp huyền sử và không tự động trở thành chứng cứ khảo cổ trực tiếp.",
          "C": "Đây hoàn toàn là chi tiết do game sáng tạo.",
          "D": "Chỉ hình 3D mới giúp xác định thông tin này."
        },
        "answer": "B",
        "explanation": "Câu cuối kiểm tra đồng thời loại nguồn và giới hạn của kết luận lịch sử.",
        "source_ids": [
          "S1",
          "G1"
        ],
        "ai_tags": [
          "bon-loai-nguon",
          "huyen-su",
          "gioi-han-su-lieu"
        ],
        "bank_ref": "M07-05",
        "answerable_from_card": true,
        "teacher_review": "required"
      }
    ]
  }
];

export const congHuyenSuQuestions = congHuyenSuCards.flatMap((card) => card.questions);
