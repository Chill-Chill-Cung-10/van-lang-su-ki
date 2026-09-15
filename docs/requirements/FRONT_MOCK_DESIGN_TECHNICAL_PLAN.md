# Ke hoach ky thuat Front Mock Design - Thanh 01 Van Lang

## 1. Muc tieu va quyet dinh pham vi

Tai lieu nay chuyen yeu cau mock giao dien thanh mot lat cat doc co the choi duoc cua **Dau An Dai Viet AI**: nguoi hoc bat dau tai `/`, di qua cau chuyen chuyen sinh, vao ban do chu S, chon Thanh 01 - Van Lang, hoc bang Bi Kip, va dung kien thuc de vuot Boss.

Quyet dinh MVP:

- Van Lang la thanh duy nhat mo trong ban mock. Cac thanh con lai hien thi trang thai khoa/sap mo va khong co loi vao truc tiep.
- Bich Dang 938 van la chuong mau trong tai lieu Version 0, nhung khong nam trong luong mock nay. Noi dung va cau hoi hien tai tap trung vao ma tran chuyen mon Van Lang.
- Gameplay cot loi dung Phaser 2D/2.5D; React Three Fiber chi la lop canh quan va hien thi nhan vat tai dung luc can thiet, co fallback cho thiet bi yeu. Khong them game server, multiplayer, PvP hoac Unity WebGL.
- Repo dang co Next.js o `frontend/` va Fastify o `backend/`. De giu dung cau truc hien co, frontend se goi cac API tien trinh/noi dung cua Fastify khi du lieu that san sang; khong tao them backend hoac dich vu game moi.

## 2. Luong nguoi choi va dinh tuyen

| URL | Vai tro | Hanh vi |
| --- | --- | --- |
| `/` | Diem vao duy nhat cua nguoi choi | Render `VanlangGameShell`: Onboarding -> map -> pho ban -> phan thuong. |
| `/game-mock` | Duong dan cu | Redirect server-side ve `/` de khong ton tai hai luong game. |
| `/avatar` | Cong cu xem avatar doc lap | Giu route de tranh mat chuc nang, khong hien tren dieu huong nguoi choi. |
| `/admin` | Cong cu quan tri doc lap | Giu route de tranh mat chuc nang, khong hien tren dieu huong nguoi choi. |

May trang thai cua hanh trinh:

1. `story[0..3]`: bon canh chu chay ve hoc sinh nam 2040 quay ve Van Lang. Nut Truoc/Sau, canh cuoi hien `Da hieu`.
2. `map.guide`: Nguoi Canh Cong Thoi Gian gioi thieu cach di chuyen, gap NPC va dung Bi Kip.
3. `map.select`: Ban do chu S hien 12 thanh; Van Lang mo, 11 thanh con lai khoa. Click Van Lang mo modal chap nhan thu thach.
4. `dungeon.explore`: Nguoi choi di chuyen WASD (va dieu khien cham tren mobile), `Space` khi dung gan NPC.
5. `dungeon.learn`: NPC giao nhiem vu, mo Bi Kip va kiem tra dieu kien hoc lieu truoc thu thach.
6. `dungeon.boss`: Tra loi cau hoi dung Bi Kip; dung gay sat thuong/nhan thuong, sai ghi nhan noi dung can cung co.
7. `reward`: Cap nhat Bi Kip, linh hon, XP/Battle Pass va tien trinh; nguoi choi co the xem tab Nhan vat, Bi Kip, BXH, Battle Pass hoac quay lai ban do.

Khong co landing page, chon man hinh hay route trung gian trong luong nay. Trang thai mock duoc luu localStorage de tai lai khong mat tien trinh; nguoi choi co the reset trong pham vi debug neu can.

## 3. Noi dung Van Lang duoc phep mock

Nguon chu yeu la `DE_AN_NGAN_HANG_CAU_HOI_THANH_VAN_LANG.docx`, bam SGK Lich su va Dia li 6 - Ket noi tri thuc, Bai 14. Mock chi dung du lieu co nhan nguon va phan biet ro su kien/khảo co voi truyen thuyet.

| Bi Kip | Chu de | Cach dua vao mock |
| --- | --- | --- |
| BK01 - Dau Vet Vuong Quoc | Hinh thanh, khong gian, Phong Chau | Nhiem vu dau tien va cau hoi mo dau. |
| BK02 - Mat Lenh Vua Hung | Hung Vuong, Lac hau, Lac tuong, Bo chinh | Hoi thoai NPC va Boss mau. |
| BK03 - Hat Ngoc Giua Dai Ngan | Lua nuoc, song nuoc, san xuat | Nhiem vu thu thap/hoc lieu. |
| BK04 - Bi Thuat Cua Lua | Luyen kim, duc dong, thu cong | Vat pham va NPC nghe nhan mo rong. |
| BK05 - Mat Ma Dong Son | Hien vat, trong dong, suy luan | Man quan sat vat pham 3D/2D. |
| BK06 - Dem Hoi Lac Viet | Doi song vat chat, tinh than | Nhiem vu phu va hoi thoai. |
| BK07 - Huyen An Lac Hong | Truyen thuyet va gioi han chung cu | Noi dung co nhan Truyen thuyet, khong dong nhat voi su kien da kiem chung. |

Moi cau hoi that can co `Question_ID`, `Castle_ID`, `BiKip_ID`, `Knowledge_ID`, loai cau, do kho, dap an/rubric, giai thich, nguon, `History_Status`, nguoi duyet va trang thai duyet. AI chi duoc chon/tao bien the tu hat nhan da duyet, khong tu dat them su kien lich su.

## 4. Thiet ke ky thuat

### Frontend

- `frontend/src/app/page.tsx`: diem vao `/`, render shell game.
- `frontend/src/app/game-mock/page.tsx`: redirect ve `/`.
- `frontend/src/app/_components/vanlang-game-shell.tsx`: state machine giao dien, onboarding, map, HUD, modal, am thanh va keyboard accessibility.
- `frontend/src/app/_components/vanlang-dungeon-world.tsx`: canh R3F isometric lazy-load; giu canvas phu tro, khong thay the gameplay 2D/2.5D.
- `frontend/src/app/_components/vanlang-mock-data.ts`: du lieu mock typed theo thanh, NPC, Bi Kip, quest, cau hoi va phan thuong. Khi co API, thay adapter du lieu, khong viet lai component.
- Tai nguyen GLB trong `assets/characters/` duoc toi uu truoc khi dua vao runtime: texture WebP 1K, geometry/animation can thiet, lazy loading, loading state va fallback tinh khi WebGL/bo nho khong dap ung.

### Backend va du lieu that

- Tiep tuc dung `GET/PATCH /api/progress` cua Fastify cho tien trinh da dang nhap; localStorage chi la fallback mock/offline.
- Them API noi dung theo mot hop dong on dinh khi doi chuyen mon cung cap du lieu: castle, codex, quest, question, attempt, reward. Hanh vi random/chon cau nam o server, co truy vet `Knowledge_ID` va phien ban noi dung.
- Luu ket qua moi luot tra loi: dung/sai, thoi gian, goi y, chu de, do kho, `Knowledge_ID`; tach XP, Level va Thong thao lich su theo yeu cau Version 0.
- API AI chi chay server-side, gioi han theo kho tri thuc da duyet va tra ve trich dan/noi dung co the truy vet. Khong dua secret sang trinh duyet.

### Hieu nang, UX va kha nang truy cap

- Dark HUD neon tiet che, tuong phan dat WCAG AA, focus ro rang, va nhan/aria cho cac nut icon.
- Ho tro `prefers-reduced-motion`; chu chay, particle, parallax va ambient audio phai co the tat.
- Audio chi khoi tao sau thao tac nguoi dung; co nut mute/unmute luu trang thai.
- Canvas 3D chi tai trong dungeon va phai co loading/fallback. Kiem tra desktop, tablet va mobile; khong de HUD che nut tuong tac hay noi dung cau hoi.
- WASD/Space co tuong duong tren touch; focus khong bi mac ket trong modal.

## 5. Ke hoach trien khai

### Pha 1 - Hop nhat diem vao

1. Chuyen `/` sang hanh trinh Van Lang va redirect `/game-mock` ve `/`.
2. Bo navigation phu khoi header cua luong nguoi choi; giu cac route cong cu doc lap de khong xoa chuc nang hien huu.
3. Ghi nhan thay doi trong `CHANGELOGS.md` va kiem tra URL goc/redirect.

### Pha 2 - Hoan thien vertical slice

1. Chot 4 canh onboarding, loi thoai mascot va modal vao Thanh Van Lang.
2. Map hien 12 diem den theo config, chi Van Lang mo.
3. Hoan thien quest BK01 -> NPC -> Boss -> reward, sau do mo rong dan BK02-BK07 khi giao vien duyet.
4. Dinh nghia ro failure loop: sai cau hoi -> giai thich + Bi Kip can xem lai -> thu lai, khong reset tien trinh.

### Pha 3 - Noi du lieu duoc kiem duyet

1. Chuyen mock data sang schema/API va them review status.
2. Xay bo chon cau server-side co do phu Bi Kip, do kho va chong lap; chua can ca 1.100 cau de demo.
3. Ket noi tien trinh, thong thao va reward voi backend theo tai khoan.

### Pha 4 - Polish 3D va kiem thu

1. Profiling GLB/canvas, kiem tra fallback va ngan sach tai nguyen tren mobile.
2. Test luong hoan chinh bang keyboard, touch, reduced motion va mute.
3. Chay lint, typecheck, build, smoke test `/` va redirect `/game-mock`; dong bo CodeGraph sau moi thay doi code.

## 6. Dieu kien nghiem thu cua mock

- Mo `/` la bat dau onboarding, khong hien landing page cu.
- Nguoi choi di qua day du bon canh, nhan huong dan mascot, vao map va chi co Van Lang co the mo.
- Chap nhan thu thach dua vao dungeon; WASD va Space hoat dong, co thay the touch.
- Nhiem vu NPC mo Bi Kip; Boss yeu cau van dung du lieu tu Bi Kip va cap reward khi dung.
- Tab Nhan vat va Bi Kip hien dung tien trinh; refresh khong lam mat mock progress.
- `/game-mock` khong tao them mot ban game khac ma quay ve `/`.
- Khong co noi dung truyen thuyet duoc trinh bay nhu du lieu da kiem chung; du lieu mock co nguon/noi dung cho doi duyet duoc ghi nhan ro.
