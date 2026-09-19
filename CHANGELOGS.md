# Changelogs

Tài liệu này ghi nhận các thay đổi đáng chú ý theo từng phiên bản. Dự án sử dụng quy ước [Semantic Versioning](https://semver.org/) và định dạng gần với [Keep a Changelog](https://keepachangelog.com/).

## Unreleased

### Added

- Giới hạn mục **Editor Mode** trong menu cho tài khoản quản trị được cấu hình sẵn; các tài khoản người chơi thông thường không còn nhìn thấy tùy chọn này.

- Chỉ hiển thị cổng từ **Cổng Huyền Sử** đến **Viễn Chinh Môn** sau khi người chơi hoàn thành thử thách Kinh Dương Vương; marker và trigger dịch chuyển đều được khóa trước thời điểm này.

- Thêm model 3D Viễn Chinh Môn vào map Viễn Chinh Môn và thư viện tài nguyên của Map Editor.

- Nâng cấp toàn diện hệ thống Cổng Dịch Chuyển (Portal Point) theo hiệu ứng Gamification & phong cách Cổ phong Đông Sơn (Văn Lang):
  - **Trận Pháp 3D Dưới Mặt Đất (Three.js FX)**: Thay thế vòng tròn phẳng tím đơn điệu bằng Trận Pháp Thái Dương Trống Đồng đa tầng; vòng hoa văn ngoài xoay thuận chiều, vòng thái dương trung tâm xoay nghịch chiều tạo xoáy linh khí thôi miên thị giác, sóng linh khí lan tỏa từ tâm ra biên theo chu kỳ nhịp thở, cột linh quang thiên đình (Ethereal Beacon Column) vươn cao với nhịp thở năng lượng và cụm linh hạt vàng kim bay lơ lửng quanh bán kính cổng.
  - **Giao Diện Thẻ Linh Môn Bài Tinh Gọn (Minimal Gamified Floating Marker)**: Thiết kế lệnh bài Đông Sơn tinh gọn, giảm hơn 65% kích thước che khuất tầm nhìn; bố cục 2 dòng thanh thoát với huy hiệu Thái Dương Trống Đồng 8 cánh (12px) đặt cạnh Tên Map Dát Vàng Kim (`✹ ĐIỆN 18 TRỤ`) và dòng hành động tối giản `▼ Bước vào` (8px), viền kim loại 1px cùng 4 góc chạm khắc vi mô tinh tế, bay bổng lơ lửng sát mặt đất.
  - **Màn Hình Chuyển Cảnh Dịch Chuyển Điện Ảnh (Cinematic Portal Transition)**: Nâng cấp overlay chuyển map thành khung cảnh mở cổng linh môn hoành tráng với huy hiệu Trống Đồng xoay hào quang, tiêu đề tiến nhập vùng đất mới và hiệu ứng sương mù thời không huyền bí.
  - **Đồng Bộ Nhận Diện Toàn Dự Án**: Chuyển đổi toàn bộ màu sắc portal trigger trong 3D Editor Overlay và Map Editor Canvas sang tông Vàng Kim & Đồng Thau (`#ffd066`, `#e8a83e`, `#8a531e`), loại bỏ triệt để màu tím neon lạc quẻ.

- Nâng cấp toàn diện trải nghiệm Ngữ Liệu Bí Kíp (Codex / Lore Corpus) trong Thử thách Phiến Đá Kinh Dương Vương:
  - Tích hợp ngăn tra cứu Bí kíp trực tiếp ngay trong Modal câu hỏi giải ấn (`stone-quiz-codex-accordion`): tự động nhận diện Bí kíp tương ứng với mảnh đá đang chọn, cho phép mở/thu gọn đọc ngữ liệu lịch sử và đối chiếu dữ kiện khi trả lời câu hỏi mà không cần đóng modal.
  - Tích hợp liên kết tương tác hai chiều Bí kíp ↔ Mảnh đá: mỗi thẻ Bí kíp hiển thị 3 chip mảnh đá tương ứng (`#1 - #3`, `#4 - #6`,...) cùng trạng thái mở khóa; bấm trực tiếp vào chip mảnh đá trên Bí kíp để kích hoạt mở ngay câu hỏi giải ấn mảnh đó.
  - Bổ sung thanh công cụ tìm kiếm dữ kiện sử liệu tức thời và bộ lọc theo trạng thái (Tất cả / Chưa xong / Đã xong), cùng nút "Thu tất cả" / "Mở tất cả".
  - Hiển thị nhãn phân loại nguồn tư liệu (Sử cũ, Huyền sử, Khảo cổ...) và mức độ xác thực sử học rõ ràng, tôn trọng tính cẩn trọng lịch sử.

### Fixed

- Phiên bản hóa URL của bộ 21 mảnh Phiến đá Kinh Dương Vương để trình duyệt tải đúng asset mới sau khi triển khai; bổ sung kiểm thử bảo đảm mảnh chân dung `#3` luôn đứng đầu khay.

- Đưa mảnh chân dung Kinh Dương Vương (mảnh số 3) lên đầu khay phục dựng để mảnh này luôn hiển thị ngay cả khi khay phải cuộn.

- Sửa lỗi hiển thị xô lệch, bẹp dí thẻ và cắt cụt chữ trong Dock Ngữ liệu Bí kíp:
  - Bổ sung `flex-shrink: 0` và loại bỏ ép chiều cao gây méo mó giao diện trên viewport hẹp/mobile.
  - Hiển thị đầy đủ toàn văn ngữ liệu với khoảng cách dòng và kích thước chữ tiêu chuẩn (`line-height: 1.65`), không còn bị cắt lửng giữa dòng hay co rút thành vạch mỏng 10px.

- Cho phép người chơi tự do lựa chọn và mở khóa bất kỳ mảnh đá nào trong 21 mảnh Phiến Đá Kinh Dương Vương:
  - Loại bỏ ràng buộc mở khóa tuần tự theo hàng đợi câu hỏi (`save.questionQueue`), mọi mảnh đá chưa giải ấn đều có thể bấm chọn trực tiếp trên bảng 21 mảnh.
  - Khi chọn mảnh bất kỳ, modal thử thách sẽ hiển thị đúng câu hỏi của mảnh cổ thạch tương ứng.
  - Trả lời chính xác sẽ mở khóa mảnh đó và cập nhật trạng thái đã giải ấn; trả lời sai sẽ đưa câu hỏi mảnh đó về cuối hàng đợi, cho phép người chơi thử lại hoặc đổi sang giải ấn mảnh khác.

- Nâng cấp trải nghiệm ghép 21 mảnh Phiến Đá Kinh Dương Vương (Assembly Phase):
  - Đồng bộ kích thước chuẩn đồng nhất cho toàn bộ 21 ô ghép (5 hàng: 5-4-4-4-4) và các khối mảnh ở khay; loại bỏ chênh lệch kích thước bounding box cũ, yêu cầu người chơi quan sát hoa văn cổ thạch để ghép đúng vị trí.
  - Thiết kế bố cục ghép 2 cột (Bàn ghép bên trái và Khay mảnh/điều khiển bên phải) vừa trọn vẹn trong tầm nhìn viewport (`no-scroll viewport`), loại bỏ việc phải cuộn trang lên xuống khi kéo thả.
  - Tích hợp cơ chế Drag and Hold bằng Pointer Events mượt mà: nhấn giữ nâng nổi mảnh đá với viền sáng hào quang, tự do thả vào bất kỳ ô nào, hoán đổi vị trí giữa các ô, hoặc bấm vào mảnh trên bảng để hoàn trả về khay. Đồng thời duy trì hỗ trợ click-to-pick / click-to-place và HTML5 drag.
  - Bổ sung nút "⚡ Hoàn Thành Thử Thách", kích hoạt khi đã đặt đủ 21/21 mảnh:
    - Nếu sai thứ tự manifest: kích hoạt hiệu ứng rung chấn bàn ghép (`puzzle-shake`) và hoạt họa 21 mảnh rơi rụng xoay lốc rời khỏi bàn cờ (`piece-tumble-fall`), hoàn trả toàn bộ mảnh về khay kèm thông báo để người chơi ghép lại từ đầu.
    - Nếu đúng toàn bộ 21 mảnh: kích hoạt hiệu ứng bừng sáng linh khí hợp nhất (`piece-fuse-glow`), hòa nhập thành linh tượng Kinh Dương Vương hoàn chỉnh (`statue-reveal`), kèm Modal Gamification vinh danh Đại Thành Công.
  - Tích hợp bộ tổng hợp âm thanh Web Audio API tự nhiên (`playCrumble` tiếng sụp đổ đá vỡ và `playVictory` khúc khải hoàn ngũ cung).

- Thay pool câu hỏi Phiến đá Kinh Dương Vương bằng gói cố định **Cổng Huyền Sử — 21 Mảnh**: 7 bí kíp và 21 câu hỏi được lưu phía client. Câu trả lời sai được chuyển xuống cuối hàng đợi, còn câu đúng bị loại khỏi hàng đợi và mở mảnh đá tương ứng, không còn gọi database/API chấm câu hỏi.
- Viết lại dẫn nhập phó bản bằng hội thoại nhiều lượt của Lạc Nhi và Nini; cuối nhiệm vụ chỉ còn nút **Chấp nhận**. Khi chấp nhận, modal gamification mở lần lượt 7 bí kíp trước khi người chơi tới bản đồ phiến đá.

- Nâng cấp trải nghiệm mở khóa Phiến đá Kinh Dương Vương với phong cách cổ phong thần thoại và gamification:
  - Hiệu ứng Hover "Click to Unlock" trên từng mảnh đá: nâng nổi 3D, vệt sáng thần khí (`stone-rune-sweep`) quét qua mặt đá, 4 góc viền đồng cổ phong, huy hiệu phong ấn "Mở khóa" nổi lên với nhịp thở linh khí (`pulse-glow`), kèm âm thanh click êm ái.
  - Modal Thử Thách 2 Phần độc lập:
    - Phần (1) - Bệ Linh Thạch (Cột trái): Chiêm ngưỡng cận cảnh mảnh đá đang phong ấn trên đài tế cổ vật với vòng hào quang linh khí xoay nhẹ; khi trả lời đúng sẽ kích hoạt hoạt ảnh bùng nổ giải ấn (`relic-unlock-burst`).
    - Phần (2) - Thử Thách Ký Ức (Cột phải): Trình bày câu hỏi cùng 4 lựa chọn A, B, C, D có huy hiệu ấn chú đồng xu, hiệu ứng hover trượt ngang mượt mà (`translateX(6px)`), phản hồi trả lời Đúng (ngọc bích phát quang, âm ngũ cung khánh chuông thăng hoa) và Sai (rung chấn `shake`, huyết ngọc đỏ cảnh báo, âm trầm gõ đá).
  - Tích hợp bộ tổng hợp âm thanh Web Audio API tự nhiên (`PuzzleSoundFx`) cho trải nghiệm tương tác trực quan, sống động mà không phụ thuộc file âm thanh ngoài.


- Thiết kế lại giao diện Phiến đá Kinh Dương Vương thành bố cục 2 phần: phần phiến đá chiếm 2/3 (gồm bảng 21 mảnh đá, tiến độ mở khóa / phục dựng và khối câu hỏi trắc nghiệm) và phần bí kíp chiếm 1/3 (hiển thị danh sách các ngữ liệu, tư liệu lịch sử đã thu thập để người chơi tra cứu trực tiếp khi trả lời câu hỏi).

- Bổ sung cờ local `NEXT_PUBLIC_PUZZLE_BYPASS` để kiểm thử giao diện phục dựng: khi bật, mọi đáp án của thử thách Kinh Dương Vương được tính đúng mà không gọi API chấm điểm.

- Thay bộ 20 mảnh đá Kinh Dương Vương bằng 21 asset mới. Sau khi trả lời đúng để mở khóa đủ 21 mảnh, người chơi chuyển sang màn phục dựng, kéo-thả (hoặc chọn mảnh rồi chọn khuôn) để ghép đúng hình tượng Kinh Dương Vương.

- Hiển thị tên đã đăng ký của tài khoản thay cho nhãn “Người chơi” ở các lượt hội thoại của nhân vật người chơi.

- Bổ sung thiết lập **Hướng nhìn khi spawn (°)** trong Map Editor. Hướng được lưu trong map, hiện bằng đường chỉ hướng tại marker Spawn và được áp dụng khi nhân vật xuất hiện tại Spawn Point; map cũ tự giữ hướng cũ 180°.

- Khóa portal point trên map có Lạc Nhi cho đến khi người chơi hoàn tất lần hội thoại đầu tiên với NPC này; trạng thái được lưu theo map/NPC, đồng thời khóa cả marker 3D và trigger chuyển map, rồi gỡ dấu `!` khỏi nameplate của Lạc Nhi.

- Thay logo người chơi trong HUD phó bản bằng biểu tượng nhân vật do người dùng cung cấp, crop cận nhân vật để lấp đầy khung tròn và tối ưu qua Next Image.

- Triển khai vertical slice thử thách Phiến đá Kinh Dương Vương trên `map2`: pool 20 câu M01 từ PostgreSQL, chấm đáp án phía backend, ghép 20 mảnh có persistence theo tài khoản, completion reveal NPC/hội thoại, asset GLB tối ưu và E2E happy path.

- Cho phép đổi tên hiển thị của map đang chọn ngay trong Flow Inspector; tên mới cập nhật tức thời trên node và các danh sách, sau đó được lưu cùng revision bằng Save Flow mà không thay đổi Map ID hoặc liên kết portal.

- Bổ sung chỉ dẫn trực quan trong Dungeon Runtime: portal point có vòng sáng, nhãn lấy đúng tên map đích đã lưu và hiệu ứng nhận diện; mọi NPC có name label cùng biểu tượng `!` để báo hiệu vị trí cần tương tác, riêng nameplate của Lạc Nhi được tăng kích thước để dễ đọc, đồng thời tôn trọng thiết lập giảm chuyển động của hệ điều hành.

- Bổ sung tính năng thiết lập chuỗi hội thoại nhiều lượt (Multi-conversation Chain) cho NPC trong Map Editor và Dungeon Runtime:
  - Mở rộng schema `@van-lang/map-contract`: bổ sung `dialogueChain?: MapNpcDialogueStep[]` vào `MapNpcSchemaV3` (hỗ trợ tới 64 lượt thoại, mỗi lượt gồm `id`, `speaker`, `text`), đảm bảo tương thích ngược 100% với `dialogue` đơn lẻ cũ qua helper `getNpcDialogueChain`.
  - Thiết kế component chuyên dụng `NpcDialogueChainEditor` trong Map Editor:
    - Trình bày dạng danh sách thẻ (Step Cards) gọn gàng, hiển thị badge lượt `Câu x/N`, chip gán nhanh người nói (`NPC`, `Người chơi`), bộ đếm ký tự `x/2000` và các nút thao tác nhanh: di chuyển thứ tự (`↑`/`↓`), nhân bản (`⧉`), xóa (`×`).
    - Nút "Thêm câu thoại", tính năng "Nhập nhanh" kịch bản thô nhiều dòng (tự phân tích dòng hoặc tiền tố `NPC:` / `Player:`), và chế độ "Xem trước" (Preview) mô phỏng dòng bong bóng thoại trực tiếp trong editor.
    - Đồng bộ tự động 2 chiều giữa `dialogueChain` và trường `dialogue` cơ bản của NPC.
  - Cải tiến Dungeon Gameplay Runtime (`vanlang-dungeon-screen`):
    - Hỗ trợ duyệt chuỗi thoại nhiều bước: hiển thị nhãn người nói tương ứng, nút chuyển lượt thoại `Tiếp tục (x/N) ➔` / `Xong (N/N) ➔`, nút quay lại `← Trước`.
    - Hỗ trợ phím tắt `Space` thông minh: nhấn để hoàn tất hiệu ứng gõ chữ (typewriter) ngay lập tức, hoặc nhấn để chuyển sang câu thoại tiếp theo, cùng nút đóng thoại an toàn.

- Bổ sung các thông số tinh chỉnh Scale (tỉ lệ kích thước) và Facing° (góc xoay hướng mặt / Rotation Y) cho NPC trong Map Editor:
  - Cho phép thiết lập trực tiếp `Scale` (mặc định 1.0) và `Facing°` (mặc định 0°) ngay trong form import GLB của NPC.
  - Bổ sung các trường điều khiển `Facing°` (Rotation Y), `Scale` (đồng đều uniform), các trục chi tiết (`Scale X/Y/Z`, `Rotation X/Z°`) trong panel NPC Inspector khi chọn NPC trên map.
- Cải tiến giao diện chọn Portal và hiển thị hành trình liên kết map:
  - Sinh ID portal tự động theo chuẩn rõ ràng gồm cả nguồn và đích: `portal-[map-nguồn]-to-[map-đích]-[số]` (ví dụ `portal-vanlang-to-map2-1`), giúp phân biệt tức thì vị trí và hướng kết nối thay vì ID gây nhầm lẫn trước đây.
  - Định dạng lại danh sách dropdown chọn portal hiển thị đầy đủ tên bản đồ nguồn, tên bản đồ đích, ID cổng và entrypoint đích: `[Tên Map Nguồn ➔ Tên Map Đích] · ID ➔ Entry`.
  - Bổ sung thẻ tóm tắt hành trình cổng (Portal Route Card) trong Flow Inspector thể hiện trực quan bản đồ xuất phát, bản đồ đích đến và điểm đón (Entrypoint).
  - Hiển thị nhãn đích đến của portal (`➔ [map-đích] ([id])`) trực tiếp trên marker ở Viewport 2D, Viewport 3D Overlay và Flow MiniMap.

### Fixed

- Khắc phục lỗi hiển thị khối câu hỏi ở dưới đáy khung phiến đá bắt cuộn trang: loại bỏ hoàn toàn phần câu hỏi nằm dưới bảng đá, chuyển sang Modal thử thách độc lập (Popup Overlay) hiển thị trực diện ngay giữa màn hình khi người chơi chọn mảnh đá để khai ấn.

- Tinh chỉnh nameplate của phiến đá và NPC trong Dungeon Runtime: tên giờ luôn nằm trên một dòng, nền gỗ tối với viền vàng và dùng cùng font Be Vietnam Pro với tên ingame để hỗ trợ tiếng Việt rõ ràng trên cảnh 3D.

- Đồng bộ typography của hộp thử thách Phiến đá Kinh Dương Vương sang Be Vietnam Pro, khắc phục lỗi dấu tiếng Việt ở tiêu đề, tiến độ và nội dung puzzle.

- Khôi phục chuyển giao độc quyền của thử thách Phiến đá Kinh Dương Vương: trước khi ghép đủ 20 mảnh chỉ hiển thị phiến đá kèm nhãn tên đã đặt trong Map Editor; hoàn tất thì phiến đá và nhãn biến mất, Kinh Dương Vương mới hiện để đối thoại.

- Sửa lỗi model GLB dùng một material bị biến thành mảng material khi clone để fade, khiến Three.js không render mesh không có geometry groups; Đấu trường và các NPC import giờ giữ đúng kiểu material đơn hoặc mảng ban đầu.

- Tạm gỡ điều kiện ẩn model Kinh Dương Vương theo tiến độ phục dựng phiến đá để kiểm chứng độc lập khả năng tải và hiển thị GLB của NPC trong Dungeon Runtime.

- Khôi phục 5 object 3D của `map2` từ revision lịch sử cuối còn đầy đủ và cập nhật flow `vanlang` revision-safe để runtime qua portal dùng đúng map revision mới, đồng thời giữ nguyên spawn, walkable polygons, entrypoint, portal và asset thử thách Kinh Dương Vương.

- Chỉnh lại hộp hội thoại NPC trong Dungeon: bỏ thanh tên màu đỏ, đặt tên NPC vào ô vàng có sẵn trên khung thoại, và thêm khoảng đệm để nội dung luôn nằm gọn trong vùng nền đen.

- Thiết lập cơ chế runtime bỏ qua portal chiều về khi đặt portal và entrypoint đồng vị trí (co-located):

  - Phân biệt rõ rệt giữa điểm Spawn khi mới vào game (`navigation.spawn`) và điểm đến khi Teleport qua Portal:
    - Khi người chơi mới vào game (từ cốt truyện, menu mở đầu, hoặc màn loading), nhân vật luôn luôn xuất hiện tại đúng điểm **Spawn Point** của bản đồ (`navigation.spawn` - tâm đài tế trống đồng Đông Sơn), loại bỏ lỗi rơi nhầm vào portal point trên cầu do việc gán entrypoint `default`.
    - Khi người chơi chủ động bước qua cổng portal giữa các map, nhân vật xuất hiện chính xác tại **Portal point đón của map đích** (`returnPortal.trigger.center`), đồng thời cổng chiều về được tạm bỏ qua (`suppressedPortals`) để chống giật lặp chuyển map.
  - Cập nhật Map Editor tự động đồng bộ vị trí Entrypoint khi người dùng kéo thả Portal point trên cả Viewport 2D và Flow MiniMap, đồng thời hỗ trợ công cụ căn chỉnh 1-click (Smart Co-location Snap) giữa Portal và Entrypoint tại cả Tab Map và Tab Map Flow, thay thế cảnh báo khoảng cách cũ bằng huy hiệu xác nhận chuẩn 2 chiều (`flow-colocation-badge`).

- Sửa lỗi chuyển qua lại giữa các map khiến nhân vật 3D biến mất và input di chuyển bị khóa cho tới khi refresh, bằng cách tách riêng instance GLTF của nhân vật cho scene hiện tại và scene preload.

- Sửa runtime bỏ qua entry point `default` khi vào map trực tiếp: nhân vật giờ spawn theo tọa độ và hướng đã lưu trong Map Editor, trong khi chuyển map qua portal vẫn dùng đúng entry point đích.

- Sửa lỗi tương phản màu chữ (font color) trên hệ thống Windows trong Map Editor: áp dụng `color-scheme: dark` toàn cục và đồng bộ styling cho các thẻ `<select>`, `<option>` và `<optgroup>` để menu xổ xuống của trình duyệt không còn bị trắng nền và làm chìm chữ màu sáng.

- Bổ sung UI thiết lập Map Flow 2 chiều (Bidirectional Portal) và công cụ Kéo - Thả (Drag & Drop) trực tiếp trong Flow:
  - Nút tạo portal 2 chiều 1-click `⇄ 2 chiều (A ⇄ B)` trong Inspector, tự động sinh 2 portal đối ứng với khoảng cách an toàn và liên kết với entrypoint đối ứng.
  - Hỗ trợ kéo thả nối dây trực tiếp trên canvas (Drag-to-Connect) từ chốt Output sang node hoặc chốt Input của map đích, mở menu ngữ cảnh chọn tạo 1 chiều hoặc 2 chiều.
  - Trực quan hóa đồ thị Map Flow bằng mũi tên định hướng SVG (`marker-end`) và tách 2 đường cong quadratic uốn lệch sang 2 phía khi có kết nối 2 chiều giữa 2 map, giúp nhìn rõ chiều di chuyển và click chọn portal dễ dàng.
  - Tích hợp khung bản đồ mini tương tác (`FlowMiniMap`) ngay trong Flow Inspector: cho phép cầm chuột kéo thả trực tiếp Portal Trigger (chấm tím) và Entry Point (chấm xanh) trên mặt bằng bản đồ mà không cần chuyển tab.
  - Thêm khối nhận diện cặp portal 2 chiều (Paired Portal Section) với nút 1-click bổ sung cổng chiều về nếu còn thiếu, nút xoá cả 2 chiều, cảnh báo va chạm khi portal trigger quá sát entrypoint (<2m) kèm nút tự động giãn cách an toàn (+2.0m).
- Bổ sung cấu hình và kéo thả điểm Spawn (`navigation.spawn`) trong Map Editor: thêm trường số `Spawn X` và `Spawn Z` trong mục Map Settings, hỗ trợ kéo thả trực tiếp marker Spawn trên cả Viewport 2D và Viewport Overlay 3D, đồng thời tự động căn spawn về vị trí hợp lệ gần nhất khi lưu bản đồ.
- Tích hợp hệ thống cảnh báo và định vị vị trí Spawn Point hợp lệ: gắn thẻ cảnh báo trực quan riêng cho Spawn trong danh sách validation với chẩn đoán chi tiết nguyên nhân vi phạm (ngoài vùng walkable, chạm mép polygon hoặc va chạm vật cản), hiển thị vòng tròn footprint bán kính nhân vật (`playerRadius`) đổi màu xanh/đỏ trực tiếp trên cả 2D và 3D Overlay, kèm banner hướng dẫn và nút đưa nhanh về vị trí hợp lệ gần nhất (`nearestValidPoint`).

- Thêm ngân hàng 340 câu hỏi trắc nghiệm Chặng 1 (Kinh Dương Vương): migration tạo bảng `stages` (13 ải) và `questions` (340 câu, 4 mức độ Bloom, 4 nhóm nguồn), Drizzle schema, dữ liệu JSON chuẩn hóa từ Excel, seed script idempotent và hai API endpoint (`GET /api/questions/stage/:code` rút câu ngẫu nhiên theo cơ cấu mức độ, `POST /api/questions/answer` ghi nhận kết quả vào `learning_attempts` và trả phản hồi chi tiết).
- Cho phép giữ và kéo trực tiếp mọi entrypoint và NPC trên viewport 2D, đồng bộ lựa chọn, tọa độ và trạng thái chưa lưu với inspector hiện có.
- Đồng bộ vùng đang chọn giữa viewport 2D, góc nhìn 3D và Overlay; hiển thị entrypoint cùng portal point trực tiếp trong cả hai chế độ 3D.
- Cho phép quản lý entrypoint ngay trong tab Map, đặt nhanh tọa độ/hướng từ scene object đang chọn và preview nhân vật tại đúng điểm mà portal Map Flow sẽ teleport tới.
- Thêm vertical slice import NPC GLB: backend validate/tối ưu và lưu asset theo SHA-256, Map Document V3 tương thích V1/V2, editor đặt/chọn/dịch chuyển NPC, runtime render model thật và hội thoại bằng Space hoặc cảm ứng.
- Thêm Map Flow PR 1: clone map thành revision 1, graph node/portal/entry point có snapshot revision, Save Flow PostgreSQL atomic với ETag/validation, và runtime transition có preload, rollback, cooldown cùng persistence qua refresh.
- Hoàn thiện luồng tạo map trong Map Editor: nút tạo map dễ thấy, chọn map mẫu, cấu hình entrypoint/portal theo từng bước, đồng bộ portal khi đổi ID entrypoint và sửa thao tác kéo node Map Flow.
- Đồng bộ Save của Map tab với snapshot Map Flow, tự cập nhật portal khi đổi ID entrypoint và thêm portal point/trigger có thể kéo trực tiếp trên viewport 2D.
- Bổ sung viewport Overlay 3D cho walkable/collider theo transform runtime, kéo/chọn/chèn vector point trực tiếp đồng bộ với viewport 2D, tạo nhanh vùng chữ nhật, nhập tọa độ X/Z thủ công và nút Lưu map luôn hiện trên header.
- Các script migration và seed backend tự nạp cấu hình local từ `.env.local`.
- Thêm Map Editor Mode end-to-end cho map document dùng chung: asset/scene inspector, transform 2D/3D, walkable polygon, collider overlay, dirty state và save revision có ETag.
- Thêm chế độ chuyển đổi giữa viewport chỉnh vùng 2D và preview GLB 3D dùng đúng camera, model, NPC cùng transform của runtime.
- Thêm package `@van-lang/map-contract` chứa schema Zod V1, semantic validation, collision geometry và fixture canonical Văn Lang dùng chung cho frontend/backend.
- Thêm Maps API list/load/save, revision bất biến được activate nguyên tử, write gate local, migration runner và seed Văn Lang idempotent.
- Chuyển runtime Văn Lang sang đọc document đã validate, hỗ trợ fallback bundled, renderer layer 2D/3D và collision theo transform hiện tại.
- Tái dựng phó bản Văn Lang thành đấu trường chuyển sinh toàn màn hình với background PNG, scene/nhân vật GLB runtime tối ưu, navmesh tam giác hóa, animation `Idle`/`Run`, WASD và điều khiển chạm.
- Thêm hội thoại Huyền Quan Canh Thời lần đầu theo từng tài khoản, HUD Wuxia sau onboarding và các drawer gọn cho nhiệm vụ, bí kíp, phần thưởng, rời phó bản.
- Bổ sung fallback tĩnh khi WebGL/model lỗi và giữ lối thoát an toàn về Bản đồ Ký Ức.
- Thay màn map dạng dashboard bằng bản đồ ký ức toàn màn hình: mây tách khi khai mở, bốn ornament Đông Sơn và tám layer triều đại tương tác độc lập.
- Bổ sung lối quay về màn hình chính từ Bản đồ Ký ức và thiết kế lại nút rời phó bản theo phong cách đồng cổ.
- Tự động tách mây khai mở Bản đồ Ký ức khi người chơi vừa tiến vào, không còn yêu cầu thao tác chạm.
- Phủ xích đồng và huy hiệu ổ khóa lên các triều đại chưa mở, kèm tooltip sử thi “Coming soon” khi hover hoặc focus.
- Thêm cinematic loading riêng cho Văn Lang với text layer cấu hình độc lập và tiến độ preload thật cho cảnh 3D, nhân vật cùng đạo cụ phó bản.
- Thêm bốn slide cốt truyện mở đầu cho tài khoản mới, dùng ảnh tư liệu Văn Lang, hiệu ứng đánh chữ và chuyển thẳng tới bản đồ sau cảnh cuối.
- Thêm luồng đăng ký/đăng nhập cục bộ không cần email xác thực hoặc OTP trước khi vào game.
- Thêm màn menu mở đầu điện ảnh `Văn Lang Sử Ký` theo ngôn ngữ Đông Sơn, hỗ trợ bàn phím, responsive và reduced motion.
- Giải nén gói hướng dẫn thiết kế tham khảo vào `docs/van-lang-agent-pack` mà không ghi đè cấu hình dự án.
- Hợp nhất điểm vào trải nghiệm người chơi tại `/`: luồng Văn Lang thay thế trang giới thiệu cũ, còn `/game-mock` chuyển hướng tương thích về `/`.
- Thêm kế hoạch kỹ thuật Front Mock Design, đối chiếu yêu cầu Version 0 và đề án ngân hàng câu hỏi Thành Văn Lang.
- Tích hợp phó bản 3D Văn Lang bằng React Three Fiber: camera isometric, map modular CC0, NPC beacon và HUD theo ngữ cảnh.
- Tối ưu hai model nhân vật GLB từ khoảng 27 MB xuống khoảng 4.9 MB mỗi file, giữ animation và dùng texture WebP 1K cho runtime.

- Thêm GitHub Actions CI cho push/pull request vào `main`, gồm frozen install, lint, typecheck, build và kiểm tra Docker Compose.
- Chuẩn hóa package manager thành pnpm 11.19.0 bằng Corepack, `packageManager`, `engineStrict` và preinstall guard.
- Bổ sung hướng dẫn pnpm/frozen lockfile; ngăn commit lockfile của npm, yarn hoặc bun.
- Tách ứng dụng thành hai workspace độc lập: `frontend/` dùng Next.js và `backend/` dùng Fastify.
- Di chuyển API, database, storage và cấu hình secret sang backend; bổ sung CORS và biến `NEXT_PUBLIC_API_BASE_URL`.
- Cập nhật README và tài liệu kiến trúc theo cấu trúc mới.
- Thêm cấu hình CodeGraph MCP cục bộ, metadata index và quy trình bắt buộc kiểm tra/đồng bộ CodeGraph trong `AGENTS.md`.
- Thêm repository-local skill `karpathy-guidelines` cho hoạt động viết, review, debug và refactor code.

- Hoàn thiện luồng mock màn hình `game-mock` theo thiết kế isometric ARPG: onboarding kể chuyện, map phó bản Văn Lang mở khóa, dungeon tương tác NPC và boss.
- Hoàn thiện logic điều khiển cơ bản (WASD, Space), âm thanh SFX/Ambient tương tác, HUD Tab nhân vật/bí kíp/leaderboard/battle pass, và modal nhiệm vụ.
- Chuẩn hóa dữ liệu mock Văn Lang (`vanlang-mock-data.ts`) để sát nội dung dự án, bổ sung trường nguồn cho tất cả bí kíp.
- Bổ sung/hoàn thiện trải nghiệm hiển thị âm thanh và tương tác UI trong `vanlang-game-shell.tsx` theo tông neon/dark game HUD.
- Bổ sung ảnh bối cảnh isometric Văn Lang, responsive HUD, focus bàn phím, reduced-motion và chặn thao tác phía sau modal.

### Fixed

- Loại bỏ lối vào viewport 2D dùng phép chiếu hard-code lệch với runtime; chuyển chỉnh/tạo walkable polygon, entrypoint, portal và NPC sang cùng world-space, camera và root transform của mode 3D/Overlay.
- Tự sửa portal trigger ngoài navmesh khi lưu, hiển thị marker spawn trong viewport 2D và overlay 3D, đồng thời bổ sung kiểm thử browser cho spawn và dịch chuyển portal tới entry point.
- Tự động đưa entry point nằm sát mép hoặc ngoài navmesh về vị trí hợp lệ gần nhất khi lưu map, đồng thời cập nhật lại tọa độ đã lưu trên giao diện.
- Sửa Save Flow khi map active đã có revision mới hơn revision mà flow đang pin; backend cấp revision kế tiếp từ revision lớn nhất nên không còn lỗi trùng khóa và rollback toàn bộ thao tác lưu.
- Chặn trigger portal overlap và khóa đồng bộ transition in-flight để tránh double dispatch, bounce loop hoặc mất map/vị trí nguồn khi tải map đích lỗi hay refresh giữa chừng.
- Harden Map Editor/runtime trước dữ liệu map lỗi, save đồng thời/thất bại, dirty navigation, polygon không hợp lệ, coordinate drift khi resize và collision tunneling/recovery với collider transform hoặc chồng lấn.
- Xoay phép chiếu điều khiển theo camera đấu trường để W/S đối nhau 180°, A/D lệch đúng ±90° và hướng mặt nhân vật khớp với chuyển động.
- Hiển thị toàn bộ map 2D trong cùng khung 16:9 với lớp 3D, thu nhỏ nhân vật/NPC/HUD, khôi phục màu thanh máu và làm mượt chuyển động WASD liên tục.
- Đồng bộ góc xoay map 3D với nền 2D, sửa hướng mặt nhân vật theo vector di chuyển, blend `Idle`/`Walk`/`Run` và thêm typewriter không tràn khung cho mọi hội thoại NPC.
- Căn lại tên nhân vật, nội dung và cụm nút hội thoại theo bounding box tỷ lệ của khung Wuxia; giữ vùng đọc cuộn được và bố cục mobile tối thiểu 16 px.
- Giới hạn vùng di chuyển phó bản theo sân tròn trung tâm và ba lối đi thực tế: cầu phía trên, sân phụ bên trái và cầu thang phía dưới.

## 0.1.0 - 2026-09-12

### Added

- Giới hạn mục **Editor Mode** trong menu cho tài khoản quản trị được cấu hình sẵn; các tài khoản người chơi thông thường không còn nhìn thấy tùy chọn này.

- Thêm model 3D Viễn Chinh Môn vào map Viễn Chinh Môn và thư viện tài nguyên của Map Editor.

- Tích hợp phó bản 3D Văn Lang bằng React Three Fiber: camera isometric, map modular CC0, NPC beacon và HUD theo ngữ cảnh.
- Tối ưu hai model nhân vật GLB từ khoảng 27 MB xuống khoảng 4.9 MB mỗi file, giữ animation và dùng texture WebP 1K cho runtime.

- Khởi tạo ứng dụng Next.js full-stack bằng TypeScript và Tailwind CSS.
- Thêm scene Phaser 2D mẫu cho gameplay lịch sử.
- Thêm màn xem avatar 3D tải theo nhu cầu bằng React Three Fiber.
- Thêm API health check, lưu tiến trình và gia sư AI phía máy chủ.
- Thêm PostgreSQL, MinIO, Mailpit và Adminer cho môi trường local bằng Docker Compose.
- Thêm schema dữ liệu ban đầu và các file cấu hình môi trường mẫu.
- Thêm tài liệu hướng dẫn tiếp nhận dự án trong README.
- Tách toàn bộ quản lý NPC trong Map Editor sang tab riêng, bổ sung danh sách chọn/xóa NPC theo map, upload ảnh đại diện NPC/người chơi và hiển thị ảnh theo người nói trong khung hội thoại với chế độ `contain`.
- Cho phép giữ và kéo trực tiếp mô hình NPC bằng chuột hoặc cảm ứng trong viewport 3D của Map Editor để cập nhật vị trí X/Z; vẫn giữ gizmo và các trường tọa độ làm phương án tinh chỉnh thay thế.
- Căn lại ảnh đại diện vào đúng ô vuông, căn giữa tên trong nameplate và chuyển nội dung hội thoại sang font Unicode hỗ trợ tiếng Việt ổn định.
