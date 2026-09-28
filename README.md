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

The local cache is stored in `data/records.json`. Settings, including mail and Notion secrets, are stored in `data/settings.json`. Upload a resume to `data/resume.pdf`. All of these stay on this machine.

The **Dashboard** reads from Notion when connected. Intake still writes a local copy so Send and dedupe work offline of Notion reads.

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

For the dashboard and AI workflow, add these properties (exact names):

| Property | Type | Set by |
| --- | --- | --- |
| Record ID | Text | Fieldnote on intake |
| Workflow | Select or Status | Fieldnote (`Queued`), your LLM (`Ready`), Fieldnote on send (`Sent`) |
| Company | Text | Intake, then the LLM worker when the job text names one |
| AI Subject | Text | Your LLM worker |
| AI Body | Text | Your LLM worker |
| Draft To | Email | Fieldnote / you |
| Sent Message ID | Text | Fieldnote after send |
| Last Reply At | Date | Fieldnote IMAP sync |
| Last Reply Snippet | Text | Fieldnote IMAP sync |
| Has Unread Reply | Checkbox | Fieldnote IMAP sync |

The page body always contains the source link, contact lines, template draft, and description.

### LLM worker

Fieldnote does not call the model from the website. On the same machine, `npm run worker` polls Notion for rows whose Workflow is `Queued` and whose AI Body is empty. It calls the llama.cpp server at `LLM_BASE_URL` (default `http://127.0.0.1:8080`), then writes **AI Subject**, **AI Body**, **Company** when the job text names one, and sets Workflow to `Ready`.

Use the same Notion integration token and database ID as in Fieldnote Settings. Set `SENDER_NAME` so the email signs off with that name. Leave `llama-server` running; the worker only needs HTTP on localhost.

## Gmail send and resume

In **Settings → Mail**, configure Gmail SMTP with an app password (`smtp.gmail.com`, port `587`, implicit TLS off).

Upload a **resume PDF** in Settings. **Send mail** on a brief attaches it when the file is present.

When **Workflow** is `Ready` and AI fields are filled, the brief editor prefills from Notion before you send.

## Reply snippets (IMAP)

**Settings → Inbox (IMAP)** defaults to Gmail (`imap.gmail.com`, port `993`). It reuses the same username and app password as SMTP.

On the **Dashboard**, **Refresh replies** scans the inbox for messages that reply to a sent **Message-ID** and updates the Notion row with a short snippet and unread flag.

## Connect a Google Sheet

1. Create a spreadsheet.
2. **Extensions → Apps Script**, and paste `integrations/google-apps-script.js`.
3. Deploy as a web app. Execute as yourself. Access: anyone with the link.
4. Paste the `/exec` URL into Settings.

The script writes a `Briefs` tab. A later send updates the row with the same `recordId`. **Check sheet** sends a probe and does not add a row.

Only `script.google.com` and `googleusercontent.com` webhook URLs are accepted.

## Sign in

On localhost the desk is open until `FIELDNOTE_PASSWORD` is set. Any other host, including `llm-server.local`, asks for that password. It is stored as an httpOnly cookie in the browser.

Mail still uses a Gmail app password in Settings. That password is not the desk login.

## AI writer

Run the site and the worker on the GPU host, next to `llama-server`:

```bash
npm install
npm start
npm run worker
```

`npm start` serves the UI on port 43123. `npm run worker` is a separate Node loop. It reads `LLM_BASE_URL` (default `http://127.0.0.1:8080`) and posts to `/v1/chat/completions`. Optional `LLM_MODEL` is sent when set. The model reply is JSON with `subject`, `body`, and `company`.

Opening a **Ready** row copies that subject, body, and company onto the local brief, so the editor is the mail you send.

The Workflow select needs options named `Queued`, `AI pending`, `Ready`, `AI failed`, and `Sent`.

## Before you put this on the internet

Set `FIELDNOTE_PASSWORD`. Any host other than localhost asks for it. Publish only the UI port. Leave `llama-server` on localhost.
