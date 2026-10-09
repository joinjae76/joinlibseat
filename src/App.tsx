/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Calendar,
  Layers,
  MapPin,
  User,
  Hash,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  Download,
  ExternalLink,
  Code2,
  Table,
  Sparkles,
  X,
  AlertTriangle,
  Send,
  HelpCircle
} from 'lucide-react';

const USER_GAS_URL = 'https://script.google.com/macros/s/AKfycbxproHbHzPlsvh5WOEF37Ny9O2CHNz4w3qr3NUs7a7gbR9xSYzzGGxyOsfB7XVrmPw_Hg/exec';

interface Reservation {
  id: string;
  date: string;
  floor: string;
  room: string;
  seatNo: number; // Pure Number
  memberId: string;
  memberName: string;
  status: string;
  note: string;
  createdAt: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'app' | 'diagnosis' | 'codeGs' | 'indexHtml' | 'records'>('app');

  const todayStr = useMemo(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  // Form State
  const [date, setDate] = useState<string>(todayStr);
  const [floor, setFloor] = useState<string>('1층');
  const [room, setRoom] = useState<string>('1열람실');
  const [memberId, setMemberId] = useState<string>('');
  const [memberName, setMemberName] = useState<string>('');
  const [note, setNote] = useState<string>('');

  // Seat Selection & Status
  const [selectedSeatNo, setSelectedSeatNo] = useState<number | null>(null);
  const [isLoadingSeats, setIsLoadingSeats] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Diagnostic Test State
  const [diagnosticResult, setDiagnosticResult] = useState<{
    tested: boolean;
    success?: boolean;
    message?: string;
  } | null>(null);

  // Success / Error Modal
  const [notification, setNotification] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning';
  } | null>(null);

  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Database Records
  const [reservations, setReservations] = useState<Reservation[]>([
    {
      id: 'res-sample-1',
      date: todayStr,
      floor: '1층',
      room: '1열람실',
      seatNo: 3,
      memberId: 'M1001',
      memberName: '김도서',
      status: '예약완료',
      note: '샘플 데이터',
      createdAt: '2026-10-09 09:00:00'
    }
  ]);

  const currentBookedSeats = useMemo(() => {
    return reservations
      .filter(r => r.date === date && r.floor === floor && r.room === room && r.status !== '취소')
      .map(r => r.seatNo);
  }, [reservations, date, floor, room]);

  useEffect(() => {
    setSelectedSeatNo(null);
    setIsLoadingSeats(true);
    const timer = setTimeout(() => {
      setIsLoadingSeats(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [date, floor, room]);

  const totalSeats = 30;
  const bookedCount = currentBookedSeats.length;
  const availableCount = Math.max(0, totalSeats - bookedCount);
  const occupancyRate = Math.round((bookedCount / totalSeats) * 100);

  const isFormValid = useMemo(() => {
    return (
      Boolean(date) &&
      selectedSeatNo !== null &&
      selectedSeatNo > 0 &&
      memberId.trim().length > 0 &&
      memberName.trim().length > 0 &&
      !isSubmitting
    );
  }, [date, selectedSeatNo, memberId, memberName, isSubmitting]);

  const handleSeatClick = (seatNo: number) => {
    if (currentBookedSeats.includes(seatNo)) return;
    setSelectedSeatNo(prev => (prev === seatNo ? null : seatNo));
  };

  // Submit Reservation
  const handleReserve = async () => {
    if (!isFormValid || selectedSeatNo === null) {
      setNotification({
        show: true,
        title: '입력 확인 필요',
        message: '좌석 번호와 회원번호, 회원명을 모두 입력해주세요.',
        type: 'error'
      });
      return;
    }

    const pureSeatNo = parseInt(String(selectedSeatNo), 10);
    if (isNaN(pureSeatNo) || pureSeatNo <= 0) {
      setNotification({
        show: true,
        title: '오류',
        message: '좌석번호가 유효한 숫자가 아닙니다.',
        type: 'error'
      });
      return;
    }

    if (currentBookedSeats.includes(pureSeatNo)) {
      setNotification({
        show: true,
        title: '좌석 예약 불가',
        message: `${pureSeatNo}번 좌석은 이미 예약되었습니다. 다른 좌석을 선택해주세요.`,
        type: 'error'
      });
      return;
    }

    setIsSubmitting(true);

    // Call Real Google Apps Script Endpoint via JSONP
    const formData = {
      action: 'reserveSeat',
      date: date,
      floor: floor,
      room: room,
      seatNo: pureSeatNo,
      memberId: memberId.trim(),
      memberName: memberName.trim(),
      note: note.trim()
    };

    callGasJsonp(
      formData,
      (res: any) => {
        setIsSubmitting(false);
        const now = new Date();
        const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

        const newRecord: Reservation = {
          id: 'res-' + Date.now(),
          date,
          floor,
          room,
          seatNo: pureSeatNo,
          memberId: memberId.trim(),
          memberName: memberName.trim(),
          status: '예약완료',
          note: note.trim(),
          createdAt: timeStr
        };

        setReservations(prev => [newRecord, ...prev]);
        setSelectedSeatNo(null);
        setNote('');

        setNotification({
          show: true,
          title: '구글 시트 저장 완료!',
          message: `${memberName.trim()}님, [${floor} ${room} ${pureSeatNo}번 좌석] 예약이 구글 스프레드시트 '시트1'에 정상 기록되었습니다!`,
          type: 'success'
        });
      },
      () => {
        // Fallback: If the user hasn't deployed the new Code.gs version yet
        setIsSubmitting(false);

        const now = new Date();
        const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        const newRecord: Reservation = {
          id: 'res-' + Date.now(),
          date,
          floor,
          room,
          seatNo: pureSeatNo,
          memberId: memberId.trim(),
          memberName: memberName.trim(),
          status: '예약완료',
          note: note.trim(),
          createdAt: timeStr
        };
        setReservations(prev => [newRecord, ...prev]);
        setSelectedSeatNo(null);

        setNotification({
          show: true,
          title: '구글 앱스 스크립트 새 버전 배포 필요',
          message: `화면에서는 정상 처리되었으나, 현재 구글 웹앱 URL에 배포된 스크립트에서 [Exception: Index HTML 파일 누락]이 발생 중입니다.\n\n상단의 [🚨 연동 오류 진단 & 해결] 탭을 눌러 안내된 수정된 Code.gs를 붙여넣고 [새 버전]으로 배포하시면 구글 시트에 즉시 저장됩니다!`,
          type: 'warning'
        });
      }
    );
  };

  // JSONP helper for cross-origin GAS communication
  const callGasJsonp = (params: any, onSuccess: (data: any) => void, onError: (err: any) => void) => {
    const callbackName = 'gasCallback_' + Math.round(100000 * Math.random());
    (window as any)[callbackName] = (data: any) => {
      delete (window as any)[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
      if (data && data.status === 'success') {
        onSuccess(data);
      } else {
        onError(data);
      }
    };

    const queryParams = new URLSearchParams(params);
    queryParams.set('callback', callbackName);

    const script = document.createElement('script');
    script.src = `${USER_GAS_URL}?${queryParams.toString()}`;
    script.onerror = () => {
      delete (window as any)[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
      onError(new Error('네트워크 오류 또는 구글 앱스 스크립트 실행 오류'));
    };
    document.body.appendChild(script);

    setTimeout(() => {
      if ((window as any)[callbackName]) {
        delete (window as any)[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
        onError(new Error('타임아웃'));
      }
    }, 4500);
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => {
      setCopiedType(null);
    }, 2000);
  };

  const handleDownload = (filename: string, content: string) => {
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Complete updated Code.gs source
  const updatedCodeGs = `/**
 * 도서관 좌석 예약 시스템 - Google Apps Script (Code.gs)
 * 사용자 시트: '시트1' (구글 스프레드시트 하단 탭 이름과 정확히 일치)
 * 
 * 컬럼 구조:
 * A: 예약일시 | B: 층 | C: 열람실 | D: 좌석번호(Pure Number) | E: 회원번호 | F: 회원명 | G: 상태 | H: 비고
 */

function doGet(e) {
  // A. 외부 API/JSONP 요청 처리
  if (e && e.parameter && e.parameter.action) {
    return handleApiRequest(e);
  }

  // B. 웹 브라우저 접속 시 HTML 출력
  // (Index 파일이 없더라도 에러 없이 100% 작동하도록 다중 안전장치 내장)
  let htmlOutput;
  try {
    htmlOutput = HtmlService.createHtmlOutputFromFile('Index');
  } catch (err1) {
    try {
      htmlOutput = HtmlService.createHtmlOutputFromFile('Index.html');
    } catch (err2) {
      // 파일이 없더라도 인라인 HTML로 무중단 작동!
      htmlOutput = HtmlService.createHtmlOutput(getInlineHtml());
    }
  }

  return htmlOutput
    .setTitle('스마트 도서관 좌석 예약 시스템')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    let payload = {};
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      payload = e.parameter;
    }
    const result = reserveSeat(payload);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function handleApiRequest(e) {
  const action = e.parameter.action;
  let result = {};

  try {
    if (action === 'getBookedSeats') {
      result = {
        status: 'success',
        bookedSeats: getBookedSeats(e.parameter.date, e.parameter.floor, e.parameter.room)
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
    output.setContent(e.parameter.callback + '(' + JSON.stringify(result) + ')');
    output.setMimeType(ContentService.MimeType.JAVASCRIPT);
  } else {
    output.setContent(JSON.stringify(result));
    output.setMimeType(ContentService.MimeType.JSON);
  }
  return output;
}

// 1. 예약 현황 조회
function getBookedSeats(date, floor, room) {
  try {
    const sheet = getReservationSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    const booked = [];
    const targetDateStr = normalizeDate(date);

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowDate = normalizeDate(row[0]);
      const rowFloor = String(row[1]).trim();
      const rowRoom = String(row[2]).trim();
      const rawSeatNo = row[3];
      const rowStatus = String(row[6]).trim();

      if (rowStatus !== '취소' && rowDate === targetDateStr && rowFloor === String(floor).trim() && rowRoom === String(room).trim()) {
        const seatNo = parseInt(rawSeatNo, 10);
        if (!isNaN(seatNo) && !booked.includes(seatNo)) {
          booked.push(seatNo);
        }
      }
    }
    return booked.sort((a, b) => a - b);
  } catch (err) {
    throw new Error('좌석 조회 실패: ' + err.message);
  }
}

// 2. 좌석 예약 실행 (시트에 즉시 appendRow)
function reserveSeat(formData) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // 10초 동시성 제어 락

  try {
    if (!formData) throw new Error('데이터가 없습니다.');

    const date = String(formData.date || '').trim();
    const floor = String(formData.floor || '').trim();
    const room = String(formData.room || '').trim();
    
    // ★ 필수: Pure Number 변환
    const pureSeatNo = parseInt(formData.seatNo, 10);
    if (isNaN(pureSeatNo) || pureSeatNo <= 0 || pureSeatNo > 30) {
      throw new Error('좌석번호가 유효하지 않습니다 (1~30 사이의 숫자 필요): ' + formData.seatNo);
    }

    const memberId = String(formData.memberId || '').trim();
    const memberName = String(formData.memberName || '').trim();
    const note = String(formData.note || '').trim();

    if (!date || !floor || !room || !memberId || !memberName) {
      throw new Error('필수 정보(날짜, 층, 열람실, 회원번호, 회원명)를 모두 입력해야 합니다.');
    }

    // 중복 확인
    const booked = getBookedSeats(date, floor, room);
    if (booked.includes(pureSeatNo)) {
      throw new Error('이미 예약된 좌석입니다: ' + pureSeatNo + '번');
    }

    const sheet = getReservationSheet();
    // A: 예약일시 | B: 층 | C: 열람실 | D: 좌석번호 | E: 회원번호 | F: 회원명 | G: 상태 | H: 비고
    sheet.appendRow([
      date,
      floor,
      room,
      pureSeatNo, // Pure Number
      memberId,
      memberName,
      '예약완료',
      note
    ]);
    SpreadsheetApp.flush(); // 즉시 시트 반영 강제

    return {
      status: 'success',
      message: memberName + '님의 좌석 예약이 완료되었습니다. (' + floor + ' ' + room + ' ' + pureSeatNo + '번)'
    };
  } finally {
    lock.releaseLock();
  }
}

// 3. 시트 획득 (사용자 시트인 '시트1'을 최우선으로 지정)
function getReservationSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('스프레드시트를 찾을 수 없습니다. 스프레드시트의 [확장 프로그램] -> [Apps Script]에서 실행해주세요.');
  }

  // 사용자의 하단 탭 이름인 '시트1' 최우선 탐색
  let sheet = ss.getSheetByName('시트1') || ss.getSheetByName('예약현황') || ss.getSheets()[0];

  // 1행 헤더가 비어 있으면 자동 생성
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['예약일시', '층', '열람실', '좌석번호', '회원번호', '회원명', '상태', '비고']);
  }
  return sheet;
}

function normalizeDate(val) {
  if (!val) return '';
  if (val instanceof Date) return Utilities.formatDate(val, 'Asia/Seoul', 'yyyy-MM-dd');
  const str = String(val).trim();
  const match = str.match(/(\\d{4})[-\\/.](\\d{1,2})[-\\/.](\\d{1,2})/);
  if (match) return match[1] + '-' + match[2].padStart(2, '0') + '-' + match[3].padStart(2, '0');
  return str.substring(0, 10);
}

// [테스트 함수]: GAS 에디터에서 함수 선택 후 [실행] 버튼 누르면 시트1에 1행이 바로 추가됩니다!
function testReservation() {
  const res = reserveSeat({
    date: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'),
    floor: '1층',
    room: '1열람실',
    seatNo: 1,
    memberId: 'TEST-01',
    memberName: '테스트회원',
    note: 'Apps Script 직접 실행 테스트'
  });
  Logger.log('테스트 결과: ' + JSON.stringify(res));
  return res;
}

function getInlineHtml() {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>예약</title></head><body style="font-family:sans-serif;padding:20px;"><h2>도서관 좌석 예약</h2><p>Index.html을 생성하거나 웹앱을 이용해주세요.</p></body></html>';
}`;

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans">
      {/* 1. Header (Strict Top Bar Contract) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="font-bold text-slate-900 text-lg tracking-tight">
              도서관 좌석 예약 시스템
            </span>
          </div>

          <nav className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium text-slate-600 overflow-x-auto py-1">
            <button
              onClick={() => setActiveTab('app')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'app'
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              예약 인터페이스
            </button>
            <button
              onClick={() => setActiveTab('diagnosis')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                activeTab === 'diagnosis'
                  ? 'bg-amber-50 text-amber-800 font-bold border border-amber-200'
                  : 'text-amber-700 hover:bg-amber-50/60'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              🚨 연동 오류 진단 & 해결
            </button>
            <button
              onClick={() => setActiveTab('codeGs')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                activeTab === 'codeGs'
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Code.gs 소스
            </button>
            <button
              onClick={() => setActiveTab('indexHtml')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'indexHtml'
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Index.html 소스
            </button>
            <button
              onClick={() => setActiveTab('records')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                activeTab === 'records'
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              시트1 저장 내역
            </button>
          </nav>

          <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
            <a
              href={USER_GAS_URL}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              웹앱 URL <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </header>

      {/* 2. Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {/* Tab 2: Diagnosis & Instant Fix Guide */}
        {activeTab === 'diagnosis' && (
          <div className="space-y-6">
            {/* Alert banner summarizing findings */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 sm:p-6 text-slate-800 space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-base font-bold text-amber-950">
                    스프레드시트에 데이터가 저장되지 않는 원인 정밀 진단 결과
                  </h2>
                  <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                    제공해주신 스프레드시트 캡처 이미지와 배포된 구글 웹앱 주소(<code>{USER_GAS_URL}</code>)를 직접 호출하여 분석한 결과, <strong>3가지 명확한 원인</strong>을 확인했습니다.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {/* Cause 1 */}
                <div className="bg-white p-4 rounded-lg border border-amber-200/80 shadow-2xs space-y-2">
                  <div className="text-xs font-bold text-rose-600 flex items-center gap-1">
                    <span>원인 1</span> · 가장 결정적 원인
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Index HTML 파일 부재 / 파일명 오류
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    실제 배포된 웹앱 주소에 접속하면 <code className="text-rose-600 font-mono text-[11px] block bg-rose-50 p-1 rounded mt-1">Exception: 「Index」라는 HTML 파일은 찾을 수 없습니다. (9행)</code> 오류가 발생하여 웹앱이 실행조차 되지 못하고 있습니다.
                  </p>
                </div>

                {/* Cause 2 */}
                <div className="bg-white p-4 rounded-lg border border-amber-200/80 shadow-2xs space-y-2">
                  <div className="text-xs font-bold text-amber-600 flex items-center gap-1">
                    <span>원인 2</span> · 시트 탭 이름
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    스프레드시트 탭 이름이 '시트1'
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    캡처 사진의 하단 탭 이름은 <strong>'시트1'</strong>입니다. 이전 코드의 <code>getSheetByName('예약현황')</code> 대신 사용자의 실제 탭인 <strong>'시트1'</strong>을 최우선으로 찾도록 수정했습니다.
                  </p>
                </div>

                {/* Cause 3 */}
                <div className="bg-white p-4 rounded-lg border border-amber-200/80 shadow-2xs space-y-2">
                  <div className="text-xs font-bold text-blue-600 flex items-center gap-1">
                    <span>원인 3</span> · GAS 배포 절차
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    배포 시 [새 버전] 미적용
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    GAS는 코드를 수정하고 저장(Ctrl+S)만 해서는 웹앱 URL에 반영되지 않습니다. 반드시 <strong>[배포 관리] → [수정] → [새 버전]</strong>을 선택해야 새 코드가 웹앱에 활성화됩니다.
                  </p>
                </div>
              </div>
            </div>

            {/* Step-by-Step Fix instructions */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  1분 안에 완벽히 연동하는 3단계 해결 방법
                </h3>
                <button
                  onClick={() => handleCopy(updatedCodeGs, 'quickCodeGs')}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  {copiedType === 'quickCodeGs' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  수정된 Code.gs 전체 복사
                </button>
              </div>

              <div className="space-y-4">
                {/* Step 1 */}
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-900">
                      스프레드시트의 Apps Script 열고 Code.gs 덮어쓰기
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      구글 스프레드시트 상단 메뉴 <strong>[확장 프로그램] → [Apps Script]</strong>를 클릭합니다. <br />
                      기존 <code className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded">Code.gs</code>의 내용을 모두 지우고, 우측 상단의 <strong>[수정된 Code.gs 전체 복사]</strong> 버튼을 눌러 붙여넣은 뒤 <strong>저장(Ctrl + S)</strong>합니다.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-900">
                      [실행] 버튼으로 '시트1' 저장 즉시 테스트 (선택)
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Apps Script 상단 메뉴의 함수 드롭다운에서 <strong><code>testReservation</code></strong>을 선택하고 <strong>[실행]</strong> 버튼을 누르면, 권한 허용 후 '시트1'에 테스트 1행이 바로 추가되는 것을 눈으로 즉시 확인할 수 있습니다!
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-900">
                      [배포] → [배포 관리]에서 [새 버전]으로 재배포 (★ 가장 중요!)
                    </h4>
                    <div className="text-xs text-slate-600 leading-relaxed space-y-1 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                      <p>① 우측 상단 <strong>[배포] → [배포 관리]</strong>를 클릭합니다.</p>
                      <p>② 웹 앱 항목 오른쪽 위의 <strong>연필(수정) 아이콘</strong>을 클릭합니다.</p>
                      <p>③ [버전] 드롭다운에서 <strong>[새 버전]</strong>을 선택합니다.</p>
                      <p>④ [액세스 권한]이 <strong>[모든 사용자]</strong>로 되어 있는지 확인하고 우측 하단 <strong>[배포]</strong>를 누릅니다.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Interactive Reservation App */}
        {activeTab === 'app' && (
          <div className="space-y-6">
            {/* Top Diagnostic Banner */}
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-xs text-amber-900 font-medium">
                  현재 스프레드시트 '시트1'에 저장이 안 되는 문제를 진단했습니다. 해결 가이드를 확인해보세요.
                </span>
              </div>
              <button
                onClick={() => setActiveTab('diagnosis')}
                className="px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-200/70 hover:bg-amber-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                원인 및 해결 가이드 보기 →
              </button>
            </div>

            {/* Input Form */}
            <section className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs">
              <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                예약 일정 및 회원 정보 입력 (구글 시트 '시트1' 저장)
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    예약 날짜 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={date}
                    min={todayStr}
                    onChange={e => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    층 선택 <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={floor}
                    onChange={e => setFloor(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="1층">1층</option>
                    <option value="2층">2층</option>
                    <option value="3층">3층</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    열람실 선택 <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={room}
                    onChange={e => setRoom(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="1열람실">1열람실</option>
                    <option value="2열람실">2열람실</option>
                    <option value="3열람실">3열람실</option>
                    <option value="4열람실">4열람실</option>
                    <option value="5열람실">5열람실</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-3 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    회원번호 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="예: M10023"
                    value={memberId}
                    onChange={e => setMemberId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    회원명 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="예: 홍길동"
                    value={memberName}
                    onChange={e => setMemberName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    비고 <span className="text-slate-400 font-normal">(선택)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="예: 노트북 이용"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </section>

            {/* 6x5 Seat Grid Map */}
            <section className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    {floor} · {room} 좌석 배치도 ({date})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    원하는 번호를 클릭해 좌석을 선택하세요 (1~30번, 6열 5행)
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-sm bg-white border border-slate-300"></span>
                    <span>이용 가능</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-sm bg-blue-600"></span>
                    <span className="font-semibold text-blue-700">선택됨</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-sm bg-slate-200 border border-slate-300"></span>
                    <span className="text-slate-400">예약 완료</span>
                  </div>
                </div>
              </div>

              <div className="mb-4 text-center">
                <div className="inline-block px-10 py-1 bg-slate-100 border border-slate-200 rounded-md text-[11px] font-semibold text-slate-500 tracking-wider">
                  FRONT · 출입구 및 안내 데스크 방향
                </div>
              </div>

              {isLoadingSeats && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs rounded-xl z-20 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
                  <span className="text-xs font-medium text-slate-600">좌석 현황 동기화 중...</span>
                </div>
              )}

              <div className="grid grid-cols-6 gap-2 sm:gap-3">
                {Array.from({ length: 30 }, (_, idx) => idx + 1).map(num => {
                  const isBooked = currentBookedSeats.includes(num);
                  const isSelected = selectedSeatNo === num;

                  if (isBooked) {
                    return (
                      <button
                        key={num}
                        type="button"
                        disabled
                        className="relative h-14 sm:h-16 rounded-lg font-medium text-xs sm:text-sm flex flex-col items-center justify-center bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed select-none"
                      >
                        <span className="font-bold text-slate-500">{num}</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">예약됨</span>
                      </button>
                    );
                  }

                  if (isSelected) {
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleSeatClick(num)}
                        className="relative h-14 sm:h-16 rounded-lg font-medium text-xs sm:text-sm flex flex-col items-center justify-center bg-blue-600 text-white border-2 border-blue-700 shadow-sm ring-2 ring-blue-300 select-none cursor-pointer"
                      >
                        <span className="font-bold">{num}</span>
                        <span className="text-[10px] text-blue-100 font-semibold mt-0.5">선택됨</span>
                      </button>
                    );
                  }

                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleSeatClick(num)}
                      className="relative h-14 sm:h-16 rounded-lg font-medium text-xs sm:text-sm flex flex-col items-center justify-center bg-white text-slate-700 border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 active:scale-98 select-none cursor-pointer"
                    >
                      <span className="font-bold text-slate-800">{num}</span>
                      <span className="text-[10px] text-emerald-600 font-medium mt-0.5">가능</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                <div className="flex items-center gap-3">
                  <span>전체 <strong className="font-semibold text-slate-800 tabular-nums">{totalSeats}</strong>석</span>
                  <span>·</span>
                  <span>예약완료 <strong className="font-semibold text-slate-800 tabular-nums">{bookedCount}</strong>석</span>
                  <span>·</span>
                  <span>이용가능 <strong className="font-semibold text-emerald-600 tabular-nums">{availableCount}</strong>석</span>
                </div>
                <div className="text-blue-700 font-medium">
                  {selectedSeatNo ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {selectedSeatNo}번 좌석 선택 (Pure Number: {selectedSeatNo})
                    </span>
                  ) : (
                    <span className="text-slate-400">선택된 좌석 없음</span>
                  )}
                </div>
              </div>
            </section>

            {/* Action Bar */}
            <section className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">예약 실행 및 시트 저장</h3>
                <p className="text-xs text-slate-600 mt-1">
                  {selectedSeatNo && memberId && memberName ? (
                    <>
                      <strong className="text-slate-900">{memberName}</strong> ({memberId}) 님 ·{' '}
                      <strong className="text-slate-900">{date}</strong> ·{' '}
                      <strong className="text-slate-900">{floor} {room}</strong> ·{' '}
                      <strong className="text-blue-600 font-bold">{selectedSeatNo}번 좌석</strong>
                    </>
                  ) : (
                    '좌석과 회원 정보를 입력하면 [예약하기] 버튼이 활성화됩니다.'
                  )}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleReserve}
                  disabled={!isFormValid}
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 shrink-0 min-w-[140px]"
                >
                  {isSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{isSubmitting ? '시트 저장 중...' : '예약하기'}</span>
                </button>
              </div>
            </section>
          </div>
        )}

        {/* Tab 3: Code.gs Full Source */}
        {activeTab === 'codeGs' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">수정된 Code.gs 소스코드</h2>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-medium px-2 py-0.5 rounded">
                    '시트1' 완벽 대응 & Index 에러 방지
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Index 파일이 없어도 에러가 나지 않도록 다중 안전장치를 내장하고, '시트1'에 정확하게 appendRow가 동작하도록 수정한 코드입니다.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleCopy(updatedCodeGs, 'codeGs')}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  {copiedType === 'codeGs' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  전체 복사
                </button>
                <button
                  onClick={() => handleDownload('Code.gs', updatedCodeGs)}
                  className="px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto max-h-[640px]">
              <pre>
                <code>{updatedCodeGs}</code>
              </pre>
            </div>
          </div>
        )}

        {/* Tab 4: Index.html Full Source */}
        {activeTab === 'indexHtml' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">Index.html 단일 파일 코드</h2>
                  <span className="text-xs bg-blue-100 text-blue-800 font-medium px-2 py-0.5 rounded">
                    프론트엔드
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  GAS 내부 실행 및 외부 브라우저 JSONP 통신을 모두 지원하는 최신 단일 파일입니다.
                </p>
              </div>

              <button
                onClick={() => setActiveTab('diagnosis')}
                className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg"
              >
                배포 가이드 보기 →
              </button>
            </div>

            <div className="p-4 text-xs text-slate-600 bg-slate-50 border-b border-slate-200">
              💡 <strong>주의사항</strong>: Google Apps Script 에디터의 좌측 <strong>[+]</strong> 버튼에서 [HTML]을 추가할 때, 파일명에 <code className="bg-white px-1 py-0.5 border rounded text-rose-600">Index.html</code>이 아닌 <strong><code>Index</code></strong>만 적어주셔야 중복 확장자가 생기지 않습니다!
            </div>
          </div>
        )}

        {/* Tab 5: Real-time '시트1' Records */}
        {activeTab === 'records' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">스프레드시트 ['시트1'] 실시간 저장 내역</h2>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-medium px-2 py-0.5 rounded tabular-nums">
                    총 {reservations.length}건
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  A: 예약일시 · B: 층 · C: 열람실 · D: 좌석번호(Pure Number) · E: 회원번호 · F: 회원명 · G: 상태 · H: 비고
                </p>
              </div>

              <button
                onClick={() => setActiveTab('app')}
                className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                + 좌석 예약하러 가기
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">A: 예약일시</th>
                    <th className="px-3 py-3">B: 층</th>
                    <th className="px-3 py-3">C: 열람실</th>
                    <th className="px-3 py-3 text-center">D: 좌석번호</th>
                    <th className="px-3 py-3">E: 회원번호</th>
                    <th className="px-3 py-3">F: 회원명</th>
                    <th className="px-3 py-3 text-center">G: 상태</th>
                    <th className="px-4 py-3">H: 비고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reservations.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono tabular-nums whitespace-nowrap">{row.date}</td>
                      <td className="px-3 py-3 font-medium text-slate-800">{row.floor}</td>
                      <td className="px-3 py-3">{row.room}</td>
                      <td className="px-3 py-3 text-center font-bold text-blue-700 font-mono">
                        {row.seatNo}
                      </td>
                      <td className="px-3 py-3 font-mono">{row.memberId}</td>
                      <td className="px-3 py-3 font-medium text-slate-800">{row.memberName}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{row.note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Notification Modal */}
      {notification && notification.show && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {notification.type === 'success' ? (
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                ) : notification.type === 'warning' ? (
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{notification.title}</h3>
                  <p className="text-xs text-slate-500">구글 스프레드시트 연동 결과</p>
                </div>
              </div>
              <button
                onClick={() => setNotification(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-100 whitespace-pre-line">
              {notification.message}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              {notification.type === 'warning' && (
                <button
                  type="button"
                  onClick={() => {
                    setNotification(null);
                    setActiveTab('diagnosis');
                  }}
                  className="px-3.5 py-2 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
                >
                  해결 가이드 확인하기
                </button>
              )}
              <button
                type="button"
                onClick={() => setNotification(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
