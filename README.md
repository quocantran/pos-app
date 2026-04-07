# POS Production Package

Thư mục này là gói chạy production cho máy khách. Mục tiêu là:
- Máy khách chỉ cần clone repo, cấu hình database, chạy start.bat.
- Không cần chạy build ở máy khách.
- Không cần cài npm ở máy khách.

## 1. Dành cho máy khách (lần đầu)

1. Cài Git (một lần duy nhất)
   - Tải tại: https://git-scm.com/download/win

2. Clone repo
   ```cmd
   git clone https://github.com/YOUR_USERNAME/pos-production.git
   cd pos-production
   ```

3. Cấu hình database trong backend\.env 1
   - Mở file backend\.env
   - Điền đúng thông tin MySQL của máy khách

4. Chạy hệ thống
   - Double-click start.bat

## 2. Máy khách lấy code mới khi bạn đã push

1. Đóng POS đang chạy (nếu đang mở)
2. Double-click update.bat
3. Chọn Y khi script hỏi "Start POS system now?" để mở lại ngay

Lưu ý quan trọng:
- update.bat dùng git fetch + git reset --hard để đồng bộ tuyệt đối với GitHub.
- Mọi chỉnh sửa code local ở máy khách sẽ bị ghi đè.
- File backend\.env của máy khách được backup/restore tự động khi update.

## 3. Quy trình của bạn khi muốn cập nhật phiên bản mới

Thực hiện trên máy dev của bạn:

1. Cập nhật code trong source chính ở thư mục pos
2. Mở pos-production và chạy:
   ```cmd
   build.bat
   ```
3. Test nhanh bản đóng gói:
   - Kiểm tra backend\.env
   - Chạy start.bat
   - Xác nhận đăng nhập, bán hàng, báo cáo chạy bình thường
4. Tăng version trong version.txt (ví dụ 1.0.1 -> 1.0.2)
5. Commit và push repo pos-production:
   ```cmd
   git add -A
   git commit -m "Release v1.0.2"
   git push origin main
   ```

Sau khi bạn push xong, máy khách chỉ cần chạy update.bat để nhận code mới.

## 4. build.bat đóng gói những gì

build.bat tự động:
- Build frontend từ pos/Web-pos
- Copy frontend dist vào frontend/dist
- Copy backend source, migrations, seeders
- Tạo backend/src/app.js bản production (backend phục vụ frontend)
- Tạo backend/.env.example và backend/.env (nếu chưa có)
- Cài production dependencies vào backend/node_modules
- Tự copy node.exe từ máy dev vào node/node.exe nếu tìm thấy

## 5. Cấu trúc tối thiểu cần có trong repo

```
pos-production/
├── backend/
│   ├── src/
│   ├── migrations/
│   ├── seeders/
│   ├── node_modules/
│   ├── .env.example
│   └── package.json
├── frontend/
│   └── dist/
├── node/
│   └── node.exe
├── start.bat
├── update.bat
├── build.bat
└── version.txt
```

## 6. Xử lý lỗi nhanh

- Báo "Node.js not found"
  - Kiểm tra file node/node.exe có tồn tại không
- Báo lỗi database
  - Kiểm tra MySQL đang chạy
  - Kiểm tra đúng thông tin trong backend/.env
- Start không lên trang
  - Chạy update.bat rồi chạy lại start.bat

## 7. Vì sao backend vẫn có src code?

Với stack hiện tại (Node.js + Express + Sequelize), backend chạy ở môi trường Node runtime nên vẫn cần mã JavaScript để thực thi.

Khác biệt với frontend:
- Frontend React được build ra file tĩnh (HTML/CSS/JS) để trình duyệt tải.
- Backend không phải file tĩnh, mà là chương trình server chạy liên tục và kết nối DB.

Vì vậy gói production backend thường vẫn gồm:
- backend/src
- backend/node_modules
- backend/package.json
- backend/.env

Nếu muốn ẩn bớt source backend, có thể dùng hướng nâng cao:
- Bundler backend (ncc/esbuild) để gom thành 1-2 file lớn.
- Đóng gói thành .exe (pkg/nexe).

Lưu ý: các hướng này phức tạp hơn, khó debug hơn, và vẫn không bảo mật tuyệt đối mã nguồn.

## 8. Mở Chrome như ứng dụng thông thường

`start.bat` mở Chrome ở cửa sổ bình thường (maximized), có thanh tiêu đề và nút thu nhỏ/phóng to/đóng như ứng dụng Windows thông thường.

Luồng khởi động đã được tối ưu cho máy khách:
- Nếu backend POS đã chạy sẵn: script chỉ mở lại giao diện frontend.
- Nếu backend chưa chạy: script tự khởi động backend rồi mở giao diện.
- Chỉ báo lỗi khi cổng đang bị ứng dụng khác (không phải POS) chiếm dụng.

Nếu máy khách vẫn mở như trình duyệt thường, kiểm tra:
- Chính sách công ty/Windows chặn tham số kiosk.
- Máy không có Chrome chuẩn ở đường dẫn mặc định.
- Có phần mềm quản lý endpoint ghi đè launch flags.

## 9. Đưa start ra Desktop máy khách

Không cần sửa đường dẫn trong `start.bat` vì script đã dùng đường dẫn tương đối theo vị trí của chính nó (`%~dp0`).

Quan trọng:
- Không copy riêng mỗi file start.bat ra Desktop.
- Giữ nguyên thư mục `pos-production`.
- Tạo shortcut từ Desktop trỏ về file start.bat bên trong thư mục dự án.

Có 2 cách:

1. Thủ công:
- Chuột phải `start.bat` -> Send to -> Desktop (create shortcut)

2. Tự động:
- Chạy file `create-desktop-shortcut.bat`
- Script sẽ tạo shortcut `POS System.lnk` trên Desktop của user hiện tại
