# Supabase 연결 방법 (무료 플랜)

1. [Supabase](https://supabase.com/dashboard)에서 **Free** 프로젝트를 만든다. 결제수단 등록이나 Pro 전환은 하지 않는다.
2. Dashboard의 **Authentication → Providers → Anonymous**에서 `Allow anonymous sign-ins`를 켠다.
3. **SQL Editor**에서 `schema.sql` 전체를 실행한다.
4. **Project Settings → API**에서 Project URL과 **Publishable key**를 복사한다. (구형 프로젝트의 `anon` 키도 사용 가능)
5. `.env.example`을 복사해 `.env`로 이름을 바꾼 뒤 두 값을 채운다.
6. `npm run dev`로 실행한다.

`service_role` 또는 `secret` 키는 절대로 `.env`나 프런트엔드 코드에 넣지 않는다.

## 무료 플랜 운영 메모

- 무료 프로젝트는 1주일 동안 사용하지 않으면 일시 정지될 수 있다.
- 이 앱은 이미지·파일 업로드와 Realtime 구독을 사용하지 않는다.
- 익명 로그인은 사용자 레코드를 만들므로, 공개 서비스 전에는 무료 Cloudflare Turnstile을 붙여 자동 가입/스팸을 막는 것을 권장한다.
