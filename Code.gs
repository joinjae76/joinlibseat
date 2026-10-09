/**
 * 도서관 좌석 예약 시스템 - Google Apps Script (Code.gs)
 * 
 * 구글 스프레드시트 구조 (사용자 시트: '시트1'):
 * A: 예약일시 | B: 층 | C: 열람실 | D: 좌석번호 | E: 회원번호 | F: 회원명 | G: 상태 | H: 비고
 */

// =================================================================
// 1. 웹앱 진입점 (doGet) - 웹 화면 서빙 및 API 요청 처리
// =================================================================
function doGet(e) {
  // A. 외부 API 요청인 경우 (URL 파라미터 action 처리)
  if (e && e.parameter && e.parameter.action) {
    return handleApiRequest(e);
  }

  // B. 웹 브라우저 접속 시 HTML 화면 출력
  // (Index 파일이 없더라도 에러 없이 100% 동작하도록 다중 안전장치 적용)
  let htmlOutput;
  try {
    // 1순위: 'Index' 파일 검색
    htmlOutput = HtmlService.createHtmlOutputFromFile('Index');
  } catch (err1) {
    try {
      // 2순위: 'Index.html' 파일 검색
      htmlOutput = HtmlService.createHtmlOutputFromFile('Index.html');
    } catch (err2) {
      // 3순위: HTML 파일이 아예 없을 경우 인라인 내장 코드로 무중단 서빙
      htmlOutput = HtmlService.createHtmlOutput(getInlineHtml());
    }
  }

  return htmlOutput
    .setTitle('스마트 도서관 좌석 예약 시스템')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// =================================================================
// 2. 외부 POST 요청 처리 (doPost)
// =================================================================
function doPost(e) {
  try {
    let payload = {};
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action || 'reserveSeat';
    let result = {};

    if (action === 'reserveSeat') {
      result = reserveSeat(payload);
    } else if (action === 'getBookedSeats') {
      result = {
        status: 'success',
        bookedSeats: getBookedSeats(payload.date, payload.floor, payload.room)
      };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// GET 방식 API 및 JSONP 지원 (웹 크로스오리진 연동 완벽 대응)
function handleApiRequest(e) {
  const action = e.parameter.action;
  let result = {};

  try {
    if (action === 'getBookedSeats') {
      const date = e.parameter.date;
      const floor = e.parameter.floor;
      const room = e.parameter.room;
      result = {
        status: 'success',
        bookedSeats: getBookedSeats(date, floor, room)
      };
    } else if (action === 'reserveSeat') {
      const formData = {
        date: e.parameter.date,
        floor: e.parameter.floor,
        room: e.parameter.room,
        seatNo: parseInt(e.parameter.seatNo, 10),
        memberId: e.parameter.memberId,
        memberName: e.parameter.memberName,
        note: e.parameter.note || ''
      };
      result = reserveSeat(formData);
    }
  } catch (err) {
    result = { status: 'error', message: err.message };
  }

  const output = ContentService.createTextOutput();
  if (e.parameter.callback) {
    // JSONP 콜백 포맷
    output.setContent(e.parameter.callback + '(' + JSON.stringify(result) + ')');
    output.setMimeType(ContentService.MimeType.JAVASCRIPT);
  } else {
    output.setContent(JSON.stringify(result));
    output.setMimeType(ContentService.MimeType.JSON);
  }
  return output;
}

// =================================================================
// 3. 예약 현황 조회 (getBookedSeats)
// =================================================================
function getBookedSeats(date, floor, room) {
  try {
    const sheet = getReservationSheet();
    const lastRow = sheet.getLastRow();

    // 데이터가 헤더 행뿐이거나 없으면 빈 배열 반환
    if (lastRow <= 1) {
      return [];
    }

    // A열~H열 전체 데이터 취득
    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    const booked = [];
    const targetDateStr = normalizeDate(date);

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowDate = normalizeDate(row[0]);
      const rowFloor = String(row[1]).trim();
      const rowRoom = String(row[2]).trim();
      const rawSeatNo = row[3];
      const rowStatus = String(row[6]).trim(); // G열: 상태

      // 취소된 예약은 제외
      const isCancelled = (rowStatus === '취소' || rowStatus === 'CANCEL');

      if (!isCancelled && rowDate === targetDateStr && rowFloor === String(floor).trim() && rowRoom === String(room).trim()) {
        const seatNo = parseInt(rawSeatNo, 10);
        if (!isNaN(seatNo) && !booked.includes(seatNo)) {
          booked.push(seatNo);
        }
      }
    }

    return booked.sort((a, b) => a - b);
  } catch (error) {
    Logger.log('getBookedSeats 오류: ' + error.message);
    throw new Error('좌석 조회 실패: ' + error.message);
  }
}

// =================================================================
// 4. 좌석 예약 실행 (reserveSeat) - Pure Number 검증 및 시트 저장
// =================================================================
function reserveSeat(formData) {
  // 동시 예약 충돌 방지용 ScriptLock
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // 최대 10초 대기

  try {
    if (!formData) {
      throw new Error('예약 데이터가 전송되지 않았습니다.');
    }

    const date = String(formData.date || '').trim();
    const floor = String(formData.floor || '').trim();
    const room = String(formData.room || '').trim();
    
    // ★ 필수: seatNo는 반드시 Pure Number 타입(숫자)으로 변환 및 검증
    const pureSeatNo = parseInt(formData.seatNo, 10);
    if (isNaN(pureSeatNo) || pureSeatNo <= 0 || pureSeatNo > 30) {
      throw new Error('유효한 좌석 번호가 아닙니다 (1~30 사이의 숫자): ' + formData.seatNo);
    }

    const memberId = String(formData.memberId || '').trim();
    const memberName = String(formData.memberName || '').trim();
    const note = String(formData.note || '').trim();

    if (!date || !floor || !room || !memberId || !memberName) {
      throw new Error('필수 정보(날짜, 층, 열람실, 회원번호, 회원명)를 모두 입력해야 합니다.');
    }

    // 중복 예약 여부 확인
    const booked = getBookedSeats(date, floor, room);
    if (booked.includes(pureSeatNo)) {
      throw new Error(`이미 예약된 좌석입니다: [${floor} ${room} ${pureSeatNo}번 좌석]. 다른 좌석을 선택해주세요.`);
    }

    // 시트 인스턴스 획득
    const sheet = getReservationSheet();

    // 스프레드시트 A열~H열 순서:
    // A: 예약일시 | B: 층 | C: 열람실 | D: 좌석번호 | E: 회원번호 | F: 회원명 | G: 상태 | H: 비고
    const rowData = [
      date,         // A: 예약일시 (YYYY-MM-DD)
      floor,        // B: 층
      room,         // C: 열람실
      pureSeatNo,   // D: 좌석번호 (Pure Number 숫자)
      memberId,     // E: 회원번호
      memberName,   // F: 회원명
      '예약완료',   // G: 상태
      note          // H: 비고
    ];

    sheet.appendRow(rowData);
    SpreadsheetApp.flush(); // 즉시 스프레드시트에 영구 반영

    Logger.log('좌석 예약 성공: ' + JSON.stringify(rowData));

    return {
      status: 'success',
      message: `${memberName}님의 좌석 예약이 성공적으로 완료되었습니다! (${floor} ${room} ${pureSeatNo}번 좌석)`,
      data: {
        date: date,
        floor: floor,
        room: room,
        seatNo: pureSeatNo
      }
    };
  } catch (error) {
    Logger.log('reserveSeat 오류: ' + error.message);
    throw new Error(error.message);
  } finally {
    lock.releaseLock();
  }
}

// =================================================================
// 5. 시트 객체 획득 보조 함수 (사용자 시트: '시트1' 최우선 타겟팅)
// =================================================================
function getReservationSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('활성 스프레드시트를 찾을 수 없습니다. 스프레드시트의 [확장 프로그램] -> [Apps Script]에서 실행해주세요.');
  }

  // 사용자의 실제 시트명인 '시트1'을 1순위로 조회, 없으면 '예약현황' 또는 첫 번째 시트 사용
  let sheet = ss.getSheetByName('시트1') || ss.getSheetByName('예약현황') || ss.getSheets()[0];

  // 1행에 헤더가 없는 경우 자동으로 8개 컬럼 헤더 생성
  if (sheet.getLastRow() === 0) {
    const headers = ['예약일시', '층', '열람실', '좌석번호', '회원번호', '회원명', '상태', '비고'];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#E2E8F0');
  }

  return sheet;
}

// 날짜 문자열 정규화 (YYYY-MM-DD)
function normalizeDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Seoul', 'yyyy-MM-dd');
  }
  const str = String(val).trim();
  const match = str.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (match) {
    const y = match[1];
    const m = String(match[2]).padStart(2, '0');
    const d = String(match[3]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return str.substring(0, 10);
}

// =================================================================
// 6. [테스트용 함수] GAS 에디터에서 [실행] 버튼으로 시트 연동 즉시 검증
// =================================================================
function testReservation() {
  const testData = {
    date: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'),
    floor: '1층',
    room: '1열람실',
    seatNo: 1,
    memberId: 'TEST-001',
    memberName: '테스트회원',
    note: 'Apps Script 직접 실행 테스트'
  };
  
  const result = reserveSeat(testData);
  Logger.log('테스트 결과: ' + JSON.stringify(result));
  return result;
}

// =================================================================
// 7. 인라인 HTML 서빙용 백업 코드 (Index 파일이 누락되어도 100% 동작)
// =================================================================
function getInlineHtml() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>도서관 좌석 예약 시스템</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;600;700&display=swap');
    body { font-family: 'Pretendard', sans-serif; }
  </style>
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen flex flex-col p-4 sm:p-6">
  <div class="max-w-4xl mx-auto w-full space-y-6">
    <header class="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
      <div>
        <h1 class="text-lg font-bold text-slate-900">도서관 좌석 예약 시스템</h1>
        <p class="text-xs text-slate-500">실시간 구글 시트 연동 좌석 현황</p>
      </div>
      <span class="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded">연동 완료</span>
    </header>

    <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label class="text-xs font-medium text-slate-600">예약 날짜</label>
          <input type="date" id="dateInput" class="w-full mt-1 p-2 border border-slate-300 rounded text-sm bg-slate-50">
        </div>
        <div>
          <label class="text-xs font-medium text-slate-600">층</label>
          <select id="floorSelect" class="w-full mt-1 p-2 border border-slate-300 rounded text-sm bg-slate-50">
            <option>1층</option><option>2층</option><option>3층</option>
          </select>
        </div>
        <div>
          <label class="text-xs font-medium text-slate-600">열람실</label>
          <select id="roomSelect" class="w-full mt-1 p-2 border border-slate-300 rounded text-sm bg-slate-50">
            <option>1열람실</option><option>2열람실</option><option>3열람실</option><option>4열람실</option><option>5열람실</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <div>
          <label class="text-xs font-medium text-slate-600">회원번호 *</label>
          <input type="text" id="memberId" placeholder="예: M10023" class="w-full mt-1 p-2 border border-slate-300 rounded text-sm">
        </div>
        <div>
          <label class="text-xs font-medium text-slate-600">회원명 *</label>
          <input type="text" id="memberName" placeholder="예: 홍길동" class="w-full mt-1 p-2 border border-slate-300 rounded text-sm">
        </div>
        <div>
          <label class="text-xs font-medium text-slate-600">비고</label>
          <input type="text" id="note" placeholder="선택사항" class="w-full mt-1 p-2 border border-slate-300 rounded text-sm">
        </div>
      </div>
    </div>

    <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-bold text-slate-900" id="gridTitle">좌석 배치도 (30석)</h2>
        <div class="flex gap-3 text-xs text-slate-500">
          <span>⚪ 가능</span><span class="text-blue-600 font-bold">🔵 선택</span><span class="text-slate-400">⚫ 예약완료</span>
        </div>
      </div>
      <div id="grid" class="grid grid-cols-6 gap-2"></div>
    </div>

    <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
      <span id="statusMsg" class="text-xs text-slate-500">좌석과 회원 정보를 입력하세요.</span>
      <button id="submitBtn" onclick="reserve()" disabled class="px-5 py-2.5 bg-blue-600 disabled:bg-slate-300 text-white font-bold rounded-lg text-sm">예약하기</button>
    </div>
  </div>

  <script>
    let booked = [];
    let selected = null;
    const dateInput = document.getElementById('dateInput');
    const floorSelect = document.getElementById('floorSelect');
    const roomSelect = document.getElementById('roomSelect');
    const memberId = document.getElementById('memberId');
    const memberName = document.getElementById('memberName');
    const note = document.getElementById('note');
    const submitBtn = document.getElementById('submitBtn');
    const statusMsg = document.getElementById('statusMsg');

    window.onload = () => {
      const today = new Date().toISOString().split('T')[0];
      dateInput.value = today;
      dateInput.onchange = load;
      floorSelect.onchange = load;
      roomSelect.onchange = load;
      memberId.oninput = checkValid;
      memberName.oninput = checkValid;
      load();
    };

    function load() {
      selected = null;
      if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
          .withSuccessHandler(render)
          .withFailureHandler(err => alert('조회 실패: ' + err))
          .getBookedSeats(dateInput.value, floorSelect.value, roomSelect.value);
      }
    }

    function render(list) {
      booked = (list || []).map(Number);
      const grid = document.getElementById('grid');
      grid.innerHTML = '';
      for (let i = 1; i <= 30; i++) {
        const btn = document.createElement('button');
        const isBooked = booked.includes(i);
        const isSel = selected === i;
        btn.className = 'h-14 rounded-lg font-bold text-xs flex flex-col items-center justify-center ' +
          (isBooked ? 'bg-slate-200 text-slate-400 cursor-not-allowed' :
           isSel ? 'bg-blue-600 text-white ring-2 ring-blue-300' :
           'bg-white border border-slate-200 text-slate-700 hover:bg-blue-50');
        btn.innerHTML = '<span>' + i + '</span><span class="text-[10px]">' + (isBooked ? '예약됨' : isSel ? '선택' : '가능') + '</span>';
        if (!isBooked) {
          btn.onclick = () => { selected = (selected === i ? null : i); render(booked); };
        }
        grid.appendChild(btn);
      }
      checkValid();
    }

    function checkValid() {
      const ok = selected && memberId.value.trim() && memberName.value.trim();
      submitBtn.disabled = !ok;
      statusMsg.textContent = selected ? (selected + '번 좌석 선택됨') : '좌석을 선택하세요';
    }

    function reserve() {
      if (!selected) return;
      submitBtn.disabled = true;
      submitBtn.textContent = '처리 중...';
      const form = {
        date: dateInput.value,
        floor: floorSelect.value,
        room: roomSelect.value,
        seatNo: parseInt(selected, 10),
        memberId: memberId.value.trim(),
        memberName: memberName.value.trim(),
        note: note.value.trim()
      };
      google.script.run
        .withSuccessHandler(res => {
          alert(res.message);
          selected = null;
          note.value = '';
          submitBtn.textContent = '예약하기';
          load();
        })
        .withFailureHandler(err => {
          alert('예약 실패: ' + err);
          submitBtn.textContent = '예약하기';
          checkValid();
        })
        .reserveSeat(form);
    }
  </script>
</body>
</html>`;
}
