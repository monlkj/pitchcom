'use client';
import { useRef } from 'react';

export default function PitchDragHandle({ index, name, onMove }: {
  index: number; name: string; onMove: (from: number, to: number) => void;
}) {
  const target = useRef(index);
  return <button type="button" aria-label={`${name} 순서 이동`} title="끌어서 순서 변경 · 방향키로 이동" onPointerDown={event => {
    target.current = index;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }} onPointerMove={event => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const item = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-pitch-order]');
    if (item) target.current = Number(item.getAttribute('data-pitch-order'));
  }} onPointerUp={event => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    onMove(index, target.current);
  }} onPointerCancel={() => { target.current = index; }} onKeyDown={event => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') { event.preventDefault(); onMove(index, index - 1); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') { event.preventDefault(); onMove(index, index + 1); }
  }} style={{ touchAction: 'none', cursor: 'grab', background: 'transparent', border: 0, color: '#94a3b8', fontSize: 20, minWidth: 40, minHeight: 44 }}>⠿</button>;
}
