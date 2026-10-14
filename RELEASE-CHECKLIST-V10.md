# Release checklist — Nihongo Dasar V10

- [ ] Set and verify Firebase Admin environment variables in Vercel.
- [ ] Confirm `ADMIN_EMAILS` contains only intended admin accounts.
- [ ] Run `npm run audit` and `npm run audit:vocabulary` in the release workspace.
- [ ] Deploy to staging, not production, first.
- [ ] Test login failure messages and WhatsApp help link.
- [ ] Add a safe test entry to translation history and confirm it renders as text; confirm markup is not executed.
- [ ] Test translation, TTS, logout, device-lock claim/heartbeat/release on two devices.
- [ ] Test admin create/update/reset/delete flows with a non-admin test account.
- [ ] Test Android Chrome and desktop browsers.
- [ ] Have a Japanese-language educator/native speaker review vocabulary and generated examples.
- [ ] Back up the current production deployment before release.
