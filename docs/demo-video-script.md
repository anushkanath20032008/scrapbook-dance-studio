# ChoreoStudio demo video: script and shot list

Final video: `public/demo.mp4` (1920x1080, 44 s, about 3 MB, voiceover included), poster `public/demo-poster.jpg`, wired into the landing page "See it in action" section (`DEMO_VIDEO_URL` in `src/routes/index.tsx`).

Sample data only (Anand K., Bela S., Chirag R., Naina K., fake numbers 98000 0000x). Dancers are adults and never use the app. Nothing about automated WhatsApp sending (a future Studio+ feature). Console screens are the real console markup and styles (`console.css` is `src/styles.css` minus the Tailwind lines) filled with sample data; the WhatsApp chat panels are mock-ups, labelled "Sample chats", using the exact reminder wording from `src/lib/manual-reminders.ts`.

## Voiceover (Niki voice, female, cheerful and a little excited at the end, about 41 s)

> It's the fifth of the month. Who has paid? Open Choreo Studio, and the month is already sorted. Overdue shows up in red, with the total at the top, and everyone who still owes is listed below. No notebook. No scrolling through chats. Tap Remind on WhatsApp, and each unpaid dancer's chat opens with their own amount already filled in. You press send, from your own number. Anand replies: paid! Now open To verify, check it against your bank, and confirm. The totals update right away. Free for your first month. No card needed. Start your free trial at choreostudio dot live!

## Shot list

| Time | Screen | Caption |
|------|--------|---------|
| 0-3.7 | Cream retro window: "It's the 5th. Who paid?" | |
| 3.5-17 | Overview: red Overdue total, 3 unpaid listed (Anand 16 days overdue, Bela 9, Naina 6) | The month, already sorted / Overdue in red |
| 17-25.5 | Remind on WhatsApp pressed; three sample chats slide in with each dancer's own name and amount | Their own name and amount / You tap send |
| 25.5-27 | Anand's chat: "paid" | A dancer replies: paid |
| 27-33 | To verify: Anand's claim (UPI, ref), Confirm pressed, notice, queue empty | Check it against your bank |
| 33-35.4 | Overview again: Overdue 5,900 to 4,100, Collected 2,100 to 3,900, Paid 1 to 2 of 4 | Confirmed, the totals update |
| 35.4-44 | Blue end card: "Free for your first month." Start free trial, choreostudio.live, No card needed | |

## Rebuild

Source composition: `docs/demo-video/index.html` (HyperFrames). Needs Chrome and ffmpeg/ffprobe on PATH.

```bash
cd docs/demo-video
npx hyperframes@0.8.181 render --quality standard --output ../../public/demo.mp4
```

Audio is `docs/demo-video/assets/voiceover.mp3` (generated through Runway, about 22 credits across two takes). To change the words, regenerate it and retime the `tl` entries at the bottom of `index.html` (pauses in the audio were used as cue points).

## Known limits

- The video is assembled from HTML, not recorded from a live session, because the owner account in the browser pane held different data. Numbers on screen are sample numbers that add up (Billed 8,000, Collected 2,100 then 3,900).
- Total is 44 s, under the 60 to 90 s target, because the story is tight at natural speaking pace.
- No music. Runway's free plan cannot generate video or music.
