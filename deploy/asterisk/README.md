# Free voice reminders: Oracle Cloud + Asterisk + Linphone

This setup calls the user's **Linphone** app over free SIP when a task is due.
There is no Twilio, no PSTN number, and no per-minute cost. The only account
cost is the Oracle Cloud Always Free VM.

> **You do not need this guide for the default free path.** With
> `VOICE_PROVIDER=inapp`, Nova Notes sends a Web Push and speaks the reminder in
> the app using the device's text-to-speech. Use this Asterisk/Linphone setup
> only if you want a real SIP call that rings a separate Linphone app.

```
task due ──> Nova scheduler ──> Asterisk ARI ──> sip.linphone.org ──> Linphone app
                    │
                    ├── Web Push at T-30 / T-10 (works with the app closed)
                    └── retry at T+5 / T+10 if the call is not answered
```

Both the bot and the user need a free `@sip.linphone.org` account. SIP-to-SIP
calls between Linphone accounts are free.

---

## 1. Create the two Linphone accounts

Do this from a phone or the Linphone desktop app.

1. Install **Linphone**.
2. Create the **user** account, for example `alice@sip.linphone.org`.
3. Create a **separate bot** account, for example `nova-bot@sip.linphone.org`.
   Use a different email; the bot is a normal SIP account, not a special API.
4. On the user's phone, open Linphone → Settings → **Accept incoming calls**,
   and allow background activity / disable battery optimisation. If Android
   kills Linphone, calls will ring but never reach the app.
5. Keep both passwords safe. The bot password goes in `pjsip.conf`; the user
   password is never needed by Nova.

> Linphone's free service is best-effort. There is no SLA and no guaranteed
> delivery. That is why Web Push is the first notification and the call is the
> escalation.

---

## 2. Create the Oracle Cloud Always Free VM

1. Oracle Cloud → Compute → Instances → **Create instance**.
2. Shape: **Ampere A1 (ARM)** if available, otherwise the AMD micro shape.
   Both are within Always Free.
3. Image: **Ubuntu 22.04** or **24.04**.
4. Assign a public IPv4 address (ephemeral is fine; reserve it if you can).
5. Open these ports in the instance's **security list / network security group**:

   | Port | Protocol | Purpose |
   | --- | --- | --- |
   | 22 | TCP | SSH |
   | 80, 443 | TCP | HTTPS app + Web Push |
   | 5060 | UDP | SIP signalling |
   | 10000–10100 | UDP | RTP audio |

   Do **not** open `8088` (ARI). It stays on loopback.

6. On the VM:

   ```bash
   sudo apt update
   sudo apt install -y asterisk ffmpeg ufw git
   sudo ufw allow OpenSSH
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw allow 5060/udp
   sudo ufw allow 10000:10100/udp
   sudo ufw enable
   ```

7. Install Node.js 20+ (NodeSource or nvm) and confirm:

   ```bash
   node --version   # v20 or newer
   npm --version
   ffmpeg -version
   ```

---

## 3. Configure Asterisk

Copy the examples and replace the placeholders:

```bash
sudo cp deploy/asterisk/pjsip.conf.example   /etc/asterisk/pjsip.conf
sudo cp deploy/asterisk/ari.conf.example     /etc/asterisk/ari.conf
sudo cp deploy/asterisk/http.conf.example    /etc/asterisk/http.conf
sudo cp deploy/asterisk/rtp.conf.example     /etc/asterisk/rtp.conf
sudo cp deploy/asterisk/extensions.conf.example /etc/asterisk/extensions.conf
```

In `/etc/asterisk/pjsip.conf` replace:

- `BOT_USER` → the bot's SIP username (without `@sip.linphone.org`)
- `BOT_PASSWORD` → the bot's SIP password
- `PUBLIC_IP` → the VM's public IPv4 address

In `/etc/asterisk/ari.conf` replace `CHANGE_ME_ARI_PASSWORD` with a long random
password. The backend uses the same value as `ARI_PASSWORD`.

Restart and verify registration:

```bash
sudo systemctl restart asterisk
sudo asterisk -rx "pjsip show registrations"
sudo asterisk -rx "pjsip show endpoints"
```

You want the `linphone` registration to say **Registered**. If it says
`Rejected` or `Unregistered`, check the bot username/password and outbound
UDP 5060.

Quick manual call test (optional):

```bash
sudo asterisk -rx "channel originate PJSIP/alice@linphone application Playback hello-world"
```

---

## 4. Configure the Nova backend

```bash
cd ~/nova-notes/backend
cp .env.example .env
nano .env
```

Set at least:

```dotenv
MONGODB_URI=...
JWT_SECRET=...

VOICE_PROVIDER=ari
ARI_URL=http://127.0.0.1:8088
ARI_USER=nova
ARI_PASSWORD=the-same-password-as-ari.conf
ARI_APP=nova-voice
VOICE_SIP_TRUNK=linphone
# Optional; leave blank to use callerid from pjsip.conf.
VOICE_CALLER_ID=

# Let Asterisk find the cached WAV prompts.
ASTERISK_SOUNDS_DIR=/usr/share/asterisk/sounds
ASTERISK_SOUND_PREFIX=nova

# Generate once and keep them stable, or let dev mode create backend/var/vapid.json
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com

CRON_SECRET=long-random-value
```

Give the backend user write access to the sounds tree so cached prompts can be
published (Asterisk only needs to read them):

```bash
sudo mkdir -p /usr/share/asterisk/sounds/nova /usr/share/asterisk/sounds/en/nova
sudo chown -R ubuntu:ubuntu /usr/share/asterisk/sounds/nova /usr/share/asterisk/sounds/en/nova
# Asterisk runs as its own user; cached prompts are non-secret and must be readable.
sudo chmod -R a+rX /usr/share/asterisk/sounds/nova /usr/share/asterisk/sounds/en/nova
```

The backend also chmods each cached prompt to `0644` after copying it.

Install and run the smoke test:

```bash
npm ci
npm run voice:smoke
npm run voice:smoke -- --call alice@sip.linphone.org
```

The first command checks ARI status, `ffmpeg`, and TTS. The second places a real
call. Answer it in Linphone; you should hear the English prompt and pressing
`1` should be logged.

> The first TTS synthesis takes a few seconds. Later calls reuse the cached WAV
> in `backend/var/tts` and are instant.

---

## 5. Run the backend 24/7

Use the provided unit file:

```bash
sudo cp deploy/systemd/nova-backend.service /etc/systemd/system/
sudo nano /etc/systemd/system/nova-backend.service   # set User/WorkingDirectory
sudo systemctl daemon-reload
sudo systemctl enable --now nova-backend
sudo journalctl -u nova-backend -f
```

The scheduler runs inside the backend every 30 seconds. The unit sets
`NODE_ENV=production`, which is required so the localhost bypass on
`/api/internal/tick` is disabled behind a reverse proxy. If you host the API
somewhere that sleeps, point an external cron at:

```bash
curl -X POST https://your-domain/api/internal/tick \
  -H "x-cron-secret: $CRON_SECRET"
```

`/api/internal/tick` refuses requests unless `CRON_SECRET` matches (or the
request comes from localhost when no secret is configured).

---

## 6. HTTPS for the app and Web Push

Service workers and Web Push require HTTPS (localhost is exempt). Put Caddy or
nginx in front of the frontend and proxy `/api` to port 5001. A minimal Caddy
config is in `deploy/Caddyfile.example`.

The SIP path does **not** need HTTPS, but the app does.

---

## 7. Test the full flow

1. Open the app over HTTPS and sign in.
2. Profile → **Voice call reminders**.
3. Enter the user's SIP address, tick consent, and save.
4. Press **Send verification call**, answer Linphone, and enter the 6-digit code.
5. Press **Test call**.
6. Create a task due 12–15 minutes from now. You should get a Web Push at T-10
   and a call at T-0. A task created inside the 10-minute window still gets the
   call, but the push stage has already passed.
7. During the call: `1` completes the task, `2` snoozes 15 minutes, `9` turns
   voice reminders off.

In development (`VOICE_PROVIDER=console`) the verification code is returned to
the browser and calls are only logged. That lets you test the whole UI without
Asterisk.

---

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Registration is `Rejected` | Bot username/password; `client_uri`; outbound UDP 5060. If Linphone requires TLS, change the transport to `transport-tls`, use port 5061, and open 5061/tcp |
| Call connects but no audio | Oracle security list **and** ufw allow 10000–10100/udp; `external_media_address` is the public IP; `direct_media=no` |
| Call rings but Linphone never wakes | Disable battery optimisation for Linphone; allow background data |
| `ARI connect` fails | `http.conf` enabled, `ari.conf` user, port 8088 on loopback, backend `ARI_PASSWORD` matches |
| TTS fails | `ffmpeg -version`; `ASTERISK_SOUNDS_DIR` writable by the backend user |
| `sound:nova/...` not found | Copy cache into `/usr/share/asterisk/sounds/nova/`; set `ASTERISK_SOUNDS_DIR` |
| Push never arrives | HTTPS, notification permission, VAPID keys unchanged since subscribing |

## Abuse and safety notes

- Voice calls require an explicit consent checkbox and a verified SIP address.
- Calls are capped per user per local day (`MAX_CALLS_PER_USER_PER_DAY`).
- Quiet hours suppress calls but still allow push.
- Pressing `9` disables voice reminders immediately.
- ARI is bound to `127.0.0.1` and must never be exposed.
- Do not log SIP passwords or VAPID private keys. `backend/var/` is gitignored.
- This is a public app: keep the auth rate limit, the per-user call cap, and the
  verification step enabled.
