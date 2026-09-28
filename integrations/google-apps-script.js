/**
 * Bound this script to the Google Sheet (Extensions → Apps Script).
 * Deploy → New deployment → Web app.
 * Execute as: Me
 * Who has access: Anyone
 * Paste the /exec URL into Fieldnote → Settings → Google Sheet.
 *
 * A probe from "Check sheet" does not write a row.
 * Later sends update the row whose recordId matches.
 */

const HEADERS = [
  "recordId",
  "filedAt",
  "status",
  "kind",
  "title",
  "company",
  "location",
  "employmentType",
  "author",
  "authorUrl",
  "emails",
  "phones",
  "url",
  "submittedUrl",
  "publishedAt",
  "description",
  "draftTo",
  "draftSubject",
  "sentAt",
]

function doPost(e) {
  const data = JSON.parse(e.postData.contents)
  if (data.probe) {
    return json_({ ok: true, probe: true })
  }

  const sheet = sheet_()
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS)
  }

  const row = HEADERS.map((header) => data[header] ?? "")
  const idColumn = 1
  const recordId = data.recordId
  const last = sheet.getLastRow()
  if (recordId && last >= 2) {
    const ids = sheet.getRange(2, idColumn, last - 1, 1).getValues()
    for (let index = 0; index < ids.length; index += 1) {
      if (ids[index][0] === recordId) {
        sheet.getRange(index + 2, 1, 1, HEADERS.length).setValues([row])
        return json_({ ok: true, updated: true })
      }
    }
  }

  sheet.appendRow(row)
  return json_({ ok: true, appended: true })
}

function sheet_() {
  const spreadsheet = SpreadsheetApp.getActive()
  return spreadsheet.getSheetByName("Briefs") || spreadsheet.insertSheet("Briefs")
}

function json_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON
  )
}
