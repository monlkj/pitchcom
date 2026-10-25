import { supabase } from './supabase';
import { syncRead } from './teamSync';
import { featureSession, sameFeatureSession, saveFeature, type FeatureSession } from './teamFeatures';

export interface ChatMsg { id: string; authorId: string; authorName: string; authorRole: string; text: string; createdAt: string; }
const hiddenKey = (id: string) => `message-hidden:${id}`;
function list<T>(value: unknown): T[] {
  if (value === null) return [];
  if (!Array.isArray(value)) throw new Error('잘못된 메시지 데이터입니다.');
  return value as T[];
}
export async function readChat(session: FeatureSession) {
  sameFeatureSession(session);
  if (!supabase) throw new Error('서버 연결이 필요합니다.');
  const [raw, hidden, markers] = await Promise.all([
    syncRead(session.teamCode, 'messages', true), syncRead(session.teamCode, hiddenKey(session.id), true),
    supabase.from('team_shared_data').select('data').eq('team_code', session.teamCode).like('data_key', 'message-deleted:%'),
  ]);
  if (markers.error) throw markers.error;
  sameFeatureSession(session);
  const deleted = new Set<string>((markers.data || []).map((row: { data: { messageId?: string } }) => row.data?.messageId).filter(Boolean));
  return { messages: list<ChatMsg>(raw).filter(message => !deleted.has(message.id)), hidden: list<string>(hidden).filter(id => typeof id === 'string') };
}
export async function sendChat(text: string): Promise<Awaited<ReturnType<typeof readChat>>> {
  const session = featureSession();
  const value = text.trim();
  if (!value || value.length > 2000) throw new Error('메시지는 1~2000자로 입력해 주세요.');
  const latest = await readChat(session);
  const message: ChatMsg = { id: crypto.randomUUID(), authorId: session.id, authorName: session.name, authorRole: session.role, text: value, createdAt: new Date().toISOString() };
  const messages = [...latest.messages, message];
  await saveFeature(session, 'messages', messages);
  return { messages, hidden: latest.hidden };
}
export async function hideChat(messageId: string) {
  const session = featureSession();
  const latest = await readChat(session);
  const hidden = [...new Set([...latest.hidden, messageId])];
  await saveFeature(session, hiddenKey(session.id), hidden);
  return { messages: latest.messages, hidden };
}
export async function deleteChatForEveryone(messageId: string) {
  const session = featureSession();
  const latest = await readChat(session);
  const message = latest.messages.find(message => message.id === messageId);
  if (!message) {
    // Finish cleanup when a previous attempt wrote its marker but the list write failed.
    await saveFeature(session, 'messages', latest.messages);
    return latest;
  }
  if (String(message.authorId) !== session.id) throw new Error('내가 보낸 메시지만 모두에게서 삭제할 수 있습니다.');
  // Separate per-message markers prevent old caches or concurrent sends from restoring deleted text in the UI.
  await saveFeature(session, `message-deleted:${messageId}`, { messageId, authorId: session.id, deletedAt: new Date().toISOString() });
  const fresh = await readChat(session);
  const messages = fresh.messages.filter(message => message.id !== messageId);
  await saveFeature(session, 'messages', messages);
  return { messages, hidden: fresh.hidden };
}
