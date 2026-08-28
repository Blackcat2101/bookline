# BookLine

โปรเจ็กต์ take-home assignment: ระบบล็อกอิน, ระบบจองนัดหมายที่ป้องกันการจองเวลาซ้ำ, และการส่งแจ้งเตือนผ่าน LINE จริงเมื่อจองสำเร็จ

## Tech stack ที่เลือกใช้ และเหตุผล

- **Next.js 16 (App Router) + React 19** — มีอยู่แล้วในโปรเจ็กต์ตั้งต้น และ Server Actions ทำให้ฟอร์มแก้ไขข้อมูลบนเซิร์ฟเวอร์ได้โดยตรงโดยไม่ต้องเขียน REST/JSON API แยกเอง ลดความซับซ้อนสำหรับงานที่มีเวลาแค่ 2 วัน
- **PostgreSQL + Prisma** — ฐานข้อมูลเชิงสัมพันธ์จริงให้ `UNIQUE` constraint บน slot การจอง "ฟรี ๆ" ซึ่งเป็นวิธีที่ง่ายและน่าเชื่อถือที่สุดในการรับประกันว่าไม่มีการจองซ้ำ แม้จะมี request เข้ามาพร้อมกัน (การเช็คแบบ `SELECT` แล้วค่อย `INSERT` ในโค้ดแอปพลิเคชันเองจะมีช่องโหว่ race condition)
- **jose (JWT) เก็บใน httpOnly cookie** — เลือกใช้แทนตาราง session ในฐานข้อมูลเพื่อความเรียบง่ายและไม่ต้องมี infrastructure เพิ่ม เนื้อหาใน JWT มีแค่ id ของ user, มีการเซ็นชื่อกำกับ (ไม่ใช่แค่ encode เฉย ๆ) และ cookie ตั้งเป็น `httpOnly`, `sameSite: lax`, และ `secure` ในโหมด production ทำให้ JS ฝั่ง client อ่าน/ปลอมแปลงไม่ได้ และไม่ถูกส่งข้าม site ข้อเสียเทียบกับ session ในฐานข้อมูลคือ token จะ revoke ก่อนหมดอายุ (7 วัน) ไม่ได้ ซึ่งยอมรับได้ในขอบเขตของงานนี้ ถ้าเป็นโปรดักต์จริงควรใช้ auth library ที่ดูแลต่อเนื่อง (NextAuth/Better Auth) หรือเพิ่มตาราง session
- **bcryptjs** สำหรับแฮชรหัสผ่าน (cost factor 10) — ไม่มีการเก็บหรือ log รหัสผ่านแบบ plain text เด็ดขาด
- **LINE Messaging API (Push Message)** — เรียกจากฝั่งเซิร์ฟเวอร์ หลังจากบันทึกการจองลงฐานข้อมูลสำเร็จแล้ว โดยเก็บ channel access token ไว้ใน env var ที่ฝั่งเซิร์ฟเวอร์เท่านั้น
- **LINE Login (OpenID Connect)** — เป็นฟีเจอร์เสริม เพิ่มเติมจาก email/password ไม่ใช่การแทนที่ ผู้ใช้ที่ล็อกอินแล้วสามารถเชื่อมบัญชี LINE ของตัวเองเพื่อให้การแจ้งเตือนการจองส่งไปหา *ตัวเอง/ผู้จอง* ไม่ใช่แค่แอดมิน เลือกทำเป็นออปชันเสริมแทนที่จะแทนที่ email/password เพราะโจทย์อนุญาตให้เลือก auth method ได้เอง และวิธีเดิมก็ implement + ทดสอบเสร็จแล้ว

## โครงสร้างโปรเจ็กต์

```
app/
  actions/auth.ts        Server Actions: register, login, logout (thin wrapper)
  actions/bookings.ts     Server Actions: createBooking, cancelBooking (thin wrapper)
  login/, register/       หน้าฟอร์ม auth (client form + useActionState)
  bookings/                หน้าที่ต้อง login ก่อน: ดู/สร้าง/ยกเลิกการจอง, สถานะเชื่อม LINE
  api/line/connect/        Route Handler: เริ่ม redirect ไปหน้า LINE Login
  api/line/callback/        Route Handler: OAuth callback, บันทึก LINE userId ที่เชื่อมไว้
lib/
  auth-service.ts          registerUser/loginUser — business logic ที่เทสได้ ไม่พึ่ง Next API
  booking-service.ts        createBookingForUser/cancelBookingForUser — เช่นเดียวกัน
  db.ts                     Prisma client singleton
  session.ts                 เข้ารหัส/ถอดรหัส JWT + จัดการ cookie
  dal.ts                     verifySession()/getCurrentUser() — "data access layer"
  line.ts                     helper สำหรับส่ง push ผ่าน LINE Messaging API
  line-login.ts               LINE Login (OIDC) สร้าง authorize URL + แลก/ยืนยัน token
proxy.ts                     ป้องกัน route (ของแทน middleware.ts เดิมใน Next 16)
prisma/schema.prisma         โมเดล User, Booking
tests/                        ชุดทดสอบ Vitest (ดูหัวข้อ Testing ด้านล่าง)
```

LINE Login ใช้ Route Handler ธรรมดา (`app/api/line/*`) แทนที่จะเป็น Server Action เพราะเป็น OAuth flow แบบ GET ที่เริ่มจากการกดลิงก์ แล้วจบด้วย callback จาก provider ภายนอกพร้อม query params — ตรงกับรูปแบบที่ Route Handler ถูกออกแบบมารองรับ ไม่ใช่รูปแบบ form-mutation ที่ Server Action เหมาะกับ

Server Actions ใน `app/actions/` จะจัดการแค่เรื่องที่เกี่ยวกับเว็บโดยตรง (อ่าน `FormData`, cookie ของ session, `redirect()`, revalidate cache, ยิง LINE push) ส่วนกฎเกณฑ์จริง ๆ — แฮชรหัสผ่าน, เช็ค email ซ้ำ, ปฏิเสธการจองซ้ำ, เช็คความเป็นเจ้าของ — อยู่ใน `lib/auth-service.ts` และ `lib/booking-service.ts` ซึ่งไม่พึ่งพาอะไรนอกจาก Prisma การแยกแบบนี้ทำให้เขียนเทสได้โดยไม่ต้องสร้าง Next.js request context เต็มรูปแบบ

## วิธีติดตั้งและรัน

สิ่งที่ต้องมี: Node 20+, Docker (สำหรับ Postgres แบบ local) หรือ Postgres instance ใดก็ได้ที่เข้าถึงได้

```bash
npm install

# สตาร์ท Postgres แบบ local (ดู docker-compose.yml)
docker compose up -d

# คัดลอก env vars แล้วกรอกค่า (ดูรายละเอียดด้านล่าง)
cp .env.example .env

# สร้าง schema ในฐานข้อมูล
npx prisma migrate dev --name init

npm run dev
```

เปิด http://localhost:3000 — จะ redirect ไปหน้า `/login` สมัครบัญชี, ล็อกอิน, แล้วลองจองเวลาได้เลย

## การทดสอบ (Testing)

```bash
npm test
```

รันชุดทดสอบ Vitest ใน `tests/` กับฐานข้อมูลแยกต่างหากชื่อ `bookline_test` (สร้างครั้งเดียวด้วย
`docker exec <container> psql -U postgres -c "CREATE DATABASE bookline_test"` connection string อยู่ใน
`.env.test`) Vitest global setup จะรัน migration และล้างข้อมูลในตารางให้ทุกครั้งก่อนเริ่มเทส เพราะฉะนั้นรันซ้ำกี่ครั้งก็ปลอดภัย และไม่แตะข้อมูล dev ในฐานข้อมูล `bookline` เลย

ครอบคลุมกฎที่สำคัญจริง ๆ ต่อความถูกต้องและความปลอดภัย: รหัสผ่านถูกแฮชและไม่เก็บเป็น plain text, ปฏิเสธ email ซ้ำและรหัสผ่านสั้นเกินไป, login ด้วยรหัสผิดกับ login ด้วยบัญชีที่ไม่มีอยู่จริงจะได้ error message แบบเดียวกัน (generic), จองเวลาเดียวกันซ้ำไม่ได้แม้จะเป็นคนละ user, ยกเลิกการจองของคนอื่นไม่ได้, และ slot ที่ถูกยกเลิกจะว่างให้คนอื่นจองต่อได้ นอกจากนี้ยังครอบคลุมการเข้ารหัส/ถอดรหัส session JWT และการปฏิเสธ token ที่ถูกแก้ไข

## Environment variables

| ตัวแปร | คำอธิบาย |
| --- | --- |
| `DATABASE_URL` | connection string ของ Postgres ค่าเริ่มต้นตรงกับ `docker-compose.yml` |
| `JWT_SECRET` | secret แบบสุ่มใช้เซ็น session JWT สร้างได้ด้วย `openssl rand -base64 32` |
| `LINE_CHANNEL_ACCESS_TOKEN` | channel access token แบบ long-lived ของ LINE Messaging API channel (LINE Developers Console → channel ของคุณ → แท็บ Messaging API) |
| `LINE_USER_ID` | `userId` ที่จะรับการแจ้งเตือนฝั่งแอดมิน ต้องเพิ่ม LINE Official Account เป็นเพื่อนก่อน แล้วไปเอา `userId` ของตัวเองมา (เช่นจาก webhook log หรือช่อง "test" ใน Developers Console) |
| `LINE_LOGIN_CHANNEL_ID` / `LINE_LOGIN_CHANNEL_SECRET` | มาจาก LINE Login channel (LINE Developers Console) **ต้อง link กับ LINE Official Account ตัวเดียวกับ** `LINE_CHANNEL_ACCESS_TOKEN` ด้านบน ผ่านช่อง "Linked LINE Official Account" ของ channel — ถ้าไม่ link กัน `userId` ที่ LINE Login ส่งกลับมาจะอยู่คนละ namespace กับที่ Messaging API ใช้ ทำให้ push ไปหา user แต่ละคนไม่สำเร็จแบบเงียบ ๆ |
| `LINE_LOGIN_REDIRECT_URI` | ต้องตรงกับ Callback URL ที่ลงทะเบียนไว้ใน LINE Login channel เป๊ะ ๆ เช่น `http://localhost:3000/api/line/callback` |

## การตัดสินใจออกแบบที่สำคัญ

- **โมเดลการจองเป็นปฏิทินกลางที่ทุกคนใช้ร่วมกัน** `Booking.startsAt` มี `UNIQUE` constraint ระดับฐานข้อมูล ทำให้ *ใครก็ตาม* ที่จองวันเวลาเดียวกับที่มีอยู่แล้วจะถูกปฏิเสธ — นี่คือสิ่งที่โจทย์หมายถึงตอนบอกว่า "ป้องกันการจองวันเวลาเดียวกันซ้ำ" และการบังคับที่ระดับฐานข้อมูล (ไม่ใช่แค่เช็คแล้วค่อย insert ในโค้ด) ช่วยป้องกัน race condition ระหว่าง 2 request ที่เข้ามาพร้อมกันสำหรับ slot เดียวกัน
- **การยกเลิกคือการลบแถวทิ้งเลย** วิธีนี้ทำให้ unique constraint เรียบง่าย (slot ที่ถูกยกเลิกว่างทันที) แลกกับการไม่มีประวัติการยกเลิกเก็บไว้ เมื่อโจทย์บอกว่า "โครงสร้างข้อมูลให้ผู้สมัครออกแบบเอง" และเวลามีแค่ 2 วัน จึงเลือกทางที่ง่ายกว่า
- **การป้องกัน route มี 2 ชั้น**: `proxy.ts` ทำ redirect แบบ optimistic สำหรับ `/bookings` โดยเช็คจาก JWT cookie (เร็ว แต่เป็นแค่ UX ให้ดูดีขึ้น) และทุก Server Action จะเรียก `verifySession()` เองอีกชั้นก่อนแตะฐานข้อมูล — การเช็คสิทธิ์จริงจึงเกิดขึ้นที่ฝั่งเซิร์ฟเวอร์ ใกล้กับข้อมูลจริง ไม่ใช่แค่ที่ชั้นนอกสุด
- **การเช็คความเป็นเจ้าของตอนยกเลิก**: `cancelBookingForUser` จะโหลดการจองมาเช็คก่อนว่า `booking.userId` ตรงกับ `userId` ของ session ไหม แล้วค่อยลบ — user จึงยกเลิกการจองของคนอื่นด้วยการเดา/ปลอมแปลง booking id ไม่ได้ แทนที่จะ throw error (ซึ่งจะไปโชว์เป็นหน้า error ทั่วไปของ Next) ฟังก์ชันนี้จะ return ผลลัพธ์แบบมี type ทำให้ error แสดงเป็นข้อความ inline ธรรมดา เหมือน validation error จุดอื่น ๆ ในแอป
- **การแจ้งเตือน LINE เป็นแบบ best-effort ไม่ใช่ transactional** การจองจะถูกบันทึกลงฐานข้อมูลก่อน แล้วค่อยยิง LINE push ตามหลัง ถ้ายิงไม่สำเร็จจะแค่ log ไว้ฝั่งเซิร์ฟเวอร์ ไม่ rollback การจอง — การจองไม่ควรหายไปเพียงเพราะ third-party API มีปัญหาชั่วคราว ในฝั่ง create booking นั้น `createBooking` จะ `await` การยิง push จริง (แทนที่จะยิงแล้วไม่รอผล) เพื่อให้ข้อความแจ้งผลลัพธ์บอกความจริงได้ว่าส่งสำเร็จหรือไม่ ไม่ใช่ยืนยันว่าสำเร็จเสมอ (หลักฐานว่าแจ้งเตือนทำงานจริง: ดูสกรีนช็อตที่แนบมาพร้อม repo นี้)
- **เรื่อง timezone**: การอ่านค่าจาก `datetime-local` input และการ parse ด้วย `new Date(...)` สมมติว่า browser กับ server อยู่ timezone เดียวกัน ถ้าเป็นโปรดักต์จริงต้องระบุ timezone ให้ชัดเจน (เก็บเป็น UTC แล้วค่อย format ตาม locale ของ user)
- **มีผู้รับแจ้งเตือน 2 คนที่เป็นอิสระต่อกัน ไม่ใช่แค่คนเดียว** โจทย์บอกว่าต้อง "ส่งแจ้งเตือนไป LINE เมื่อจองสำเร็จ" โดยไม่ได้ระบุว่าส่งหาใคร — ตีความได้ทั้ง "แอดมินต้องรู้" และ "คนจองต้องได้ใบยืนยัน" แทนที่จะเลือกแบบใดแบบหนึ่ง `createBooking` และ `cancelBooking` จะส่งทั้งคู่: หาแอดมินที่ตั้งไว้คงที่ (`LINE_USER_ID`) เสมอ และหา `lineUserId` ของเจ้าของการจองเองถ้าเขาเชื่อม LINE ไว้แล้ว ทั้งสองทางเป็นอิสระต่อกัน — การแจ้งเตือนฝั่ง user ล้มเหลว (หรือไม่มีเลย) จะไม่กระทบการแจ้งเตือนฝั่งแอดมินหรือตัวการจองเอง
- **LINE Login เป็นของเสริม ไม่ใช่การแทนที่ email/password** และขั้นตอนแลกเปลี่ยน OAuth ทำที่ฝั่งเซิร์ฟเวอร์พร้อมการยืนยันจริง ไม่เชื่อข้อมูลจาก client ตรง ๆ: `lib/line-login.ts` ส่ง `id_token` ที่ได้ไปยืนยันที่ endpoint `/oauth2/v2.1/verify` ของ LINE เอง (LINE เซ็น ID token ด้วย HS256 ซึ่งเป็น algorithm แบบ shared-secret ที่ JWKS แบบสาธารณะยืนยันไม่ได้ นี่คือวิธีที่ LINE แนะนำไว้เอง ไม่ใช่ทางลัดแก้บั๊ก) และ callback route จะเช็คค่า `state` ที่ผ่าน httpOnly cookie ไปกลับ (ป้องกัน CSRF) กับ `nonce` ที่ฝังอยู่ใน token (ป้องกัน replay) ก่อนจะบันทึก `lineUserId` ลงฐานข้อมูล ถ้า `lineUserId` ถูกใช้ไปแล้วโดยบัญชีอื่น จะถูกปฏิเสธ ไม่ใช่ย้ายไปให้บัญชีใหม่แบบเงียบ ๆ
- **คำขอ authorize ของ LINE Login ตั้งค่า `bot_prompt=normal`** การ push ข้อความไปหาคนที่ยังไม่เคยเพิ่ม Official Account เป็นเพื่อน จะได้รับคำตอบว่าสำเร็จจาก LINE API แต่ข้อความจะไม่ถูกส่งถึงจริง ๆ — เจอปัญหานี้ตอนทดสอบจากเครื่องที่สอง `bot_prompt` จะรวมขั้นตอน "เพิ่ม BookLine เป็นเพื่อน" เข้ากับหน้า consent ของ LINE Login เดียวกันเลย ทำให้การเชื่อมบัญชีกับการรับแจ้งเตือนได้จริงเกิดขึ้นในขั้นตอนเดียว ไม่ต้องแยกทำ 2 รอบ

## สิ่งที่ยังไม่ได้ทำ

- ยังไม่มีระบบ reset รหัสผ่าน / ยืนยันอีเมล
- ยังไม่มี pagination สำหรับรายการจอง (ในสเกลนี้ยังไม่จำเป็น)
- ยังไม่มี rate limiting สำหรับ login/register
- การทดสอบครอบคลุมแค่ระดับ service layer (business rule) ยังไม่ได้ทำแบบ end-to-end ผ่านชั้น HTTP/Server Action หรือ UI จริง — ส่วนนั้นตรวจสอบด้วยมือระหว่างพัฒนาแทน
- Session JWT ยัง revoke ก่อนหมดอายุ 7 วันไม่ได้ (ไม่มีตาราง session หรือ blocklist ฝั่งเซิร์ฟเวอร์)
