/**
 * 캠핑장 관리 앱 — Google Sheets 동기화
 *
 * 설정:
 * 1. 아래 SYNC_TOKEN 을 임의 문자열로 변경 (앱에도 같은 값 입력)
 * 2. 배포 > 새 배포 > 유형: 웹 앱
 *    - 실행 주체: 나
 *    - 액세스: 모든 사용자
 * 3. 웹 앱 URL 을 캠핑장 앱 설정에 입력
 */

const SYNC_TOKEN = "your-secret-token-change-me";
const DATA_SHEET = "_sync";

function doGet(e) {
  try {
    if (!checkToken(e)) return jsonOutput({ error: "Unauthorized" });
    return jsonOutput(readData());
  } catch (err) {
    return jsonOutput({ error: String(err) });
  }
}

function doPost(e) {
  try {
    if (!checkToken(e)) return jsonOutput({ error: "Unauthorized" });
    const body = e.postData && e.postData.contents;
    if (!body) return jsonOutput({ error: "Empty body" });
    const data = JSON.parse(body);
    writeData(body, data);
    return jsonOutput({ ok: true, exportedAt: data.exportedAt || null });
  } catch (err) {
    return jsonOutput({ error: String(err) });
  }
}

function checkToken(e) {
  const token = (e.parameter && e.parameter.token) || "";
  return token === SYNC_TOKEN;
}

function getDataSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(DATA_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(DATA_SHEET);
    sheet.hideSheet();
  }
  return sheet;
}

function readData() {
  const raw = getDataSheet().getRange("A1").getValue();
  if (!raw) return emptyData();
  try {
    return JSON.parse(raw);
  } catch (err) {
    return emptyData();
  }
}

function writeData(rawJson, data) {
  const sheet = getDataSheet();
  sheet.getRange("A1").setValue(rawJson);
  sheet.getRange("B1").setValue(data.exportedAt || new Date().toISOString());
  refreshReservationSheet(data.reservations || []);
}

function emptyData() {
  return {
    version: 4,
    exportedAt: null,
    categories: [],
    products: [],
    reservations: [],
    sales: [],
    sites: [],
    siteTypes: [],
  };
}

function refreshReservationSheet(reservations) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const name = "예약";
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  const headers = [
    "사이트번호",
    "타입",
    "이용객",
    "연락처",
    "입실일",
    "몇박",
    "추가인원",
    "입금가",
    "결제여부",
    "입실여부",
    "특이사항",
    "기타",
  ];

  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (!reservations.length) return;

  const rows = reservations.map((r) => [
    r.siteNumber || "",
    r.type || "",
    r.guest || "",
    r.contact || "",
    r.checkInDate || "",
    r.nights || 0,
    r.extraGuests || 0,
    r.deposit || 0,
    r.paid || "",
    r.checkedIn || "",
    r.notes || "",
    r.etc || "",
  ]);
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
