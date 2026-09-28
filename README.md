# Fieldnote

Fieldnote turns a public LinkedIn job or post link into a brief you can file, then a mail draft you send yourself.

Paste a URL. The app reads the public page, keeps the title, company, location, author, description, and any email or phone written in that text, and files the brief. It drafts a message. Nothing is emailed until you press **Send**.

## Run it

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

```bash
npm test
npm run lint
```

The local pipeline is stored in `data/records.json`. Settings, including mail and Notion secrets, are stored in `data/settings.json`. Both files stay on this machine.

## What a run does

1. **Intake.** You paste a `linkedin.com` or `lnkd.in` URL. The server follows redirects and only continues while the host is still LinkedIn.
2. **Extract.** Public JSON-LD and page text supply the job or post fields. Emails and phone numbers are taken from that text, not from LinkedIn’s private graph.
3. **File.** The brief is always written to the local pipeline. If Notion or a Google Sheet webhook is configured, the same brief is sent there. A failed destination does not drop the local copy.
4. **Draft.** A short mail is filled in with the recipient, subject, and a note you can edit.
5. **Send.** **Send mail** delivers through your SMTP server. **Open in mail app** hands the same draft to your own mail client. Both are deliberate clicks.

Filing the same unsent link again updates that brief instead of creating a second one.

## What it cannot read

LinkedIn often hides job details behind a sign-in wall. Fieldnote does not log in, store a LinkedIn session, or try to get around that wall. When the public page has no post or job body, Intake stops and tells you.

Use a public post URL or a job URL that still exposes its posting text without an account.

## Connect mail

In **Settings → Mail**, use the SMTP server you already send from.

For Gmail, use an [app password](https://myaccount.google.com/apppasswords) with:

- Host `smtp.gmail.com`
- Port `587`
- Implicit TLS off

**Check SMTP** only logs in. It does not send a message.

You can also put the same values in the environment. See `env.example`. Values saved in Settings override the environment for this machine.

## Connect Notion

1. Create an integration at [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations).
2. Share the destination database with that integration.
3. Paste the token and the database ID or URL into Settings.

The database needs a title property. These names are filled when they exist: Email, Phone, URL, Company, Location, Author, Status (Filed / Sent), Kind.

The page body always contains the source link, contact lines, draft, and description.

## Connect a Google Sheet

1. Create a spreadsheet.
2. **Extensions → Apps Script**, and paste `integrations/google-apps-script.js`.
3. Deploy as a web app. Execute as yourself. Access: anyone with the link.
4. Paste the `/exec` URL into Settings.

The script writes a `Briefs` tab. A later send updates the row with the same `recordId`. **Check sheet** sends a probe and does not add a row.

Only `script.google.com` and `googleusercontent.com` webhook URLs are accepted.

## Before you put this on the internet

On localhost the desk is open. Anywhere else it refuses requests until `FIELDNOTE_KEY` is set. Enter that key once in the browser tab. Without the lock, anyone who could open the site could send mail with the saved SMTP login.

Local files do not persist on a serverless host. Use Notion or the sheet as the record when you deploy.
