# WhatsApp Business setup for Studio+ (what is left)

The code is done (branch `feat/studio-plus-whatsapp`). Nothing sends until the steps below are finished. They need your own Meta and Vercel sign-ins.

## 1. Meta (developers.facebook.com)
1. Create a Meta Business account (business.facebook.com) if you do not have one, and start business verification. Verification can take days.
2. At developers.facebook.com create an app of type **Business**, and add the **WhatsApp** product.
3. Add a phone number that is not already on WhatsApp, and note its **Phone number ID**.
4. Create a **System User** access token with `whatsapp_business_messaging` and `whatsapp_business_management` (a permanent token; the test token expires in 24 hours).
5. Note the **App secret** (App settings > Basic).

Until verification finishes, Meta gives a test number that can message up to five numbers you add by hand. That is enough for a test send.

## 2. Message templates (WhatsApp Manager > Message templates)
Category: **Utility**. Language: **English (en)**. The names and the order of the variables must match exactly.

**`fee_due_reminder`**
```
Hi {{1}}, a reminder from {{3}}: {{2}}'s fee for {{5}} ({{4}}) is due on {{6}}. Thank you!
```

**`fee_overdue_reminder`**
```
Hi {{1}}, {{2}}'s fee for {{5}} ({{4}}) at {{3}} was due on {{6}} and is still pending. Please pay when you can. Thank you!
```

Variables: {{1}} recipient name, {{2}} dancer name, {{3}} studio, {{4}} amount, {{5}} month, {{6}} due date.
Sample values for the review form: Asha, Asha, Rhythm Studio, ₹2,500, November 2026, 10 Nov.

## 3. Vercel (Project > Settings > Environment Variables, Production)
| Name | Value |
|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | from step 1.3 |
| `WHATSAPP_ACCESS_TOKEN` | from step 1.4 |
| `WHATSAPP_APP_SECRET` | from step 1.5 |
| `WHATSAPP_VERIFY_TOKEN` | any long random string you make up |
| `CRON_SECRET` | any long random string (Vercel sends it to the send job) |
| `WHATSAPP_TEMPLATE_LANGUAGE` | only if the templates are not `en` |

Redeploy after saving.

## 4. Meta webhook (App > WhatsApp > Configuration)
- Callback URL: `https://www.choreostudio.live/api/webhooks/whatsapp`
- Verify token: the same `WHATSAPP_VERIFY_TOKEN`
- Subscribe to the **messages** field (this carries delivered, read and failed updates).

## 5. Merge and check
1. Merge the PR for `feat/studio-plus-whatsapp`.
2. `https://www.choreostudio.live/api/webhooks/whatsapp` should stop answering 503.
3. In the app, on a Studio+ studio, open Messages and turn automated WhatsApp on, queue a reminder to your own number, and wait for the job.

## Known limits
- The send job runs once a day at 9:00 am IST (`vercel.json`), because Vercel's free plan allows no more. On Vercel Pro change the schedule to `*/5 * * * *`.
- The pricing page still says Studio+ is coming soon with no checkout, so no studio can buy the plan yet.
- No real message has ever been sent; tests use a fake WhatsApp server.
