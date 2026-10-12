'use client';

import { useEffect, useRef, useState } from 'react';

type Port = {
  readable: ReadableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
};
type SerialAPI = { requestPort(): Promise<Port> };

export default function ArduinoButtons({ pitches, onPitch, disabled }: {
  pitches: string[];
  onPitch: (pitch: string) => void;
  disabled: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [message, setMessage] = useState('USB로 우노를 연결한 뒤 연결 버튼을 누르세요.');
  const [selection, setSelection] = useState(0);
  const selectionRef = useRef(0);
  const active = useRef(true);
  const portRef = useRef<Port | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const stopRef = useRef(false);
  const latest = useRef({ pitches, onPitch, disabled });
  latest.current = { pitches, onPitch, disabled };

  const pitchOrder = JSON.stringify(pitches);
  useEffect(() => { selectionRef.current = 0; setSelection(0); }, [pitchOrder]);

  useEffect(() => {
    active.current = true;
    setSupported('serial' in navigator && window.isSecureContext);
    return () => {
      active.current = false;
      stopRef.current = true;
      void readerRef.current?.cancel().catch(() => {});
    };
  }, []);

  const connect = async () => {
    if (portRef.current || state !== 'idle') return;
    stopRef.current = false;
    setState('connecting');
    let port: Port | null = null;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let opened = false;
    try {
      const serial = (navigator as Navigator & { serial: SerialAPI }).serial;
      port = await serial.requestPort();
      if (!active.current || stopRef.current) return;
      await port.open({ baudRate: 9600 });
      opened = true;
      portRef.current = port;
      if (!active.current || stopRef.current) return;
      if (!port.readable) throw new Error('읽기 불가');
      reader = port.readable.getReader();
      readerRef.current = reader;
      setState('connected');
      setMessage('연결됨 · 1번 선택 · 2번 전송 · 3번 초기화');
      const decoder = new TextDecoder();
      let buffer = '';
      while (!stopRef.current) {
        const { value, done } = await reader.read();
        if (done || stopRef.current) break;
        buffer += decoder.decode(value, { stream: true });
        let end: number;
        while ((end = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, end).trim();
          buffer = buffer.slice(end + 1);
          if (!active.current) continue;
          if (line === 'RESET') {
            selectionRef.current = 0; setSelection(0);
            setMessage('선택을 초기화했습니다. 1번 버튼으로 다시 선택하세요.');
            continue;
          }
          const current = latest.current;
          const legacy = /^(SELECT|SEND|PITCH):([0-9]+)$/.exec(line);
          const selecting = line === 'NEXT' || legacy?.[1] === 'SELECT';
          const sending = line === 'SEND' || legacy?.[1] === 'SEND' || legacy?.[1] === 'PITCH';
          if (!selecting && !sending) continue;
          if (current.disabled || current.pitches.length === 0) {
            selectionRef.current = 0; setSelection(0);
            setMessage('투수를 선택하고 구종을 등록하세요. 편집 중에는 입력하지 않습니다.');
            continue;
          }
          let count = selectionRef.current;
          if (line === 'NEXT') count = count % current.pitches.length + 1;
          else if (legacy) {
            const raw = Number(legacy[2]);
            if (!Number.isSafeInteger(raw)) continue;
            count = raw === 0 ? 0 : (raw - 1) % current.pitches.length + 1;
          }
          if (selecting) {
            selectionRef.current = count; setSelection(count);
            if (count) setMessage(`${count}번 · ${current.pitches[count - 1]} 선택됨. 2번 버튼을 누르면 전송합니다.`);
            continue;
          }
          if (count === 0) { setMessage('1번 버튼으로 먼저 구종을 선택하세요.'); continue; }
          const pitch = current.pitches[count - 1];
          selectionRef.current = 0; setSelection(0);
          current.onPitch(pitch);
          setMessage(`${count}번 구종 · ${pitch} 음성 요청`);
        }
        if (buffer.length > 256) buffer = '';
      }
      if (active.current) setMessage('연결이 해제되었습니다. 다시 연결할 수 있습니다.');
    } catch (error) {
      if (active.current) {
        const cancelled = error instanceof DOMException && error.name === 'NotFoundError';
        setMessage(cancelled ? '기기 선택이 취소되었습니다.' : '연결 실패: Arduino IDE 시리얼 모니터를 닫고 USB 연결과 권한을 확인하세요.');
      }
    } finally {
      if (reader) {
        try { await reader.cancel(); } catch {}
        reader.releaseLock();
      }
      readerRef.current = null;
      if (port && opened) { try { await port.close(); } catch {} }
      portRef.current = null;
      if (active.current) { setState('idle'); selectionRef.current = 0; setSelection(0); }
    }
  };

  const disconnect = () => {
    stopRef.current = true;
    void readerRef.current?.cancel().catch(() => {});
  };

  const testAudio = () => {
    if (!('speechSynthesis' in window)) { setMessage('이 브라우저는 음성 재생을 지원하지 않습니다.'); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance('이어폰 연결 확인');
    utterance.lang = 'ko-KR';
    utterance.onerror = () => setMessage('음성을 재생하지 못했습니다. 브라우저와 기기 음성 설정을 확인하세요.');
    window.speechSynthesis.speak(utterance);
  };

  return <section style={{ padding: 16, borderRadius: 14, background: '#1e293b', border: '1px solid #334155', marginBottom: 18 }}>
    <h2 style={{ fontSize: 15, margin: '0 0 8px', color: '#f8fafc' }}>🎛️ 우노 버튼 연결</h2>
    <p style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.7 }}>컴퓨터 Chrome·Edge에서 USB로 연결합니다. 이어폰을 이 컴퓨터의 소리 출력 장치로 선택하세요. 다른 기기의 이어폰으로 전송하는 기능은 아닙니다.</p>
    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
      <button disabled={!supported || state === 'connecting'} onClick={state === 'connected' ? disconnect : connect} style={{ flex: 1, padding: '11px 8px', border: 0, borderRadius: 9, color: '#fff', background: '#2563eb', cursor: 'pointer', opacity: !supported || state === 'connecting' ? .5 : 1 }}>{state === 'connected' ? '연결 해제' : state === 'connecting' ? '연결 중…' : 'USB 우노 연결'}</button>
      <button onClick={testAudio} style={{ padding: '11px 12px', borderRadius: 9, border: '1px solid #475569', background: 'transparent', color: '#bfdbfe', cursor: 'pointer' }}>이어폰 테스트</button>
    </div>
    <p role="status" aria-live="polite" style={{ margin: '10px 0', color: '#93c5fd', fontSize: 12, lineHeight: 1.7 }}>{supported ? message : 'USB 연결은 컴퓨터 Chrome·Edge에서 사용하세요. 팅커캐드 가상 버튼은 연결되지 않습니다.'}</p>
    <p style={{ color: '#f8fafc', fontSize: 13, marginBottom: 12 }}>선택 구종: {selection} / {pitches.length} · 1번(D2) 선택 · 2번(D3) 보내기 · 3번(D4) 초기화</p>
    <details><summary style={{ color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>횟수별 구종 · 설치 안내</summary>
      <ol style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 2, paddingLeft: 22 }}>{pitches.map((pitch, i) => <li key={`${pitch}-${i}`}>{pitch}</li>)}</ol>
      <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.8, marginTop: 12 }}>1번 버튼은 D2와 GND, 2번 버튼은 D3와 GND, 3번 초기화 버튼은 D4와 GND에 연결하세요. 나머지 버튼은 사용하지 않습니다. 1번을 누를 때마다 위 순서대로 선택합니다. 구종 개수를 넘으면 다시 1번으로 돌아갑니다. 편집 화면에서 구종을 드래그하면 버튼 선택 순서도 바뀝니다. 순서를 바꾸거나 투수를 바꾸면 선택은 초기화됩니다. 2번은 음성을 전송하고 횟수를 초기화합니다. 선택 없이 보내기를 누르면 아무 동작도 하지 않습니다. 부저는 필요 없습니다. 아래 코드를 실제 우노에 업로드하고 시리얼 모니터를 닫은 뒤 연결하세요. 버튼 입력은 화면의 구종 버튼과 같은 음성 동작을 실행합니다.</p>
      <a href="/arduino/pitchcom-buttons.ino" download style={{ display: 'inline-block', color: '#60a5fa', fontSize: 13, padding: '12px 0' }}>우노 코드 다운로드 (.ino)</a>
    </details>
  </section>;
}
