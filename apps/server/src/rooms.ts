/**
 * Stream-room hub. The streamer's draft runs in their browser; the room
 * relays their state to viewers/overlay and funnels audience votes and
 * chaos events back. Chaos lands in the host's action transcript, so the
 * server still re-validates everything at submission time — the room never
 * grants power the draft rules don't allow.
 */
import type { WebSocket } from 'ws';

export interface RoomViewMsg {
  type: 'state';
  /** Opaque draft summary the host broadcasts (shop, budget, build, round). */
  payload: unknown;
}

interface Viewer {
  socket: WebSocket;
  id: string;
  lastChaosAt: number;
}

export interface Room {
  code: string;
  hostId: string;
  host?: WebSocket;
  viewers: Map<string, Viewer>;
  lastState?: unknown;
  votes: Map<string, Set<string>>; // tag -> voter ids
  chaosCooldownUntil: number;
}

const CHAOS_KINDS = new Set(['vaal', 'mirror', 'rerollSlot']);
const CHAOS_GLOBAL_COOLDOWN_MS = 20_000;
const CHAOS_VIEWER_COOLDOWN_MS = 90_000;

export class RoomHub {
  private rooms = new Map<string, Room>();

  create(hostId: string): Room {
    const code = Array.from({ length: 5 }, () =>
      'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
    const room: Room = {
      code, hostId, viewers: new Map(), votes: new Map(), chaosCooldownUntil: 0,
    };
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  private broadcast(room: Room, msg: unknown, includeHost = false) {
    const data = JSON.stringify(msg);
    for (const v of room.viewers.values()) {
      if (v.socket.readyState === v.socket.OPEN) v.socket.send(data);
    }
    if (includeHost && room.host && room.host.readyState === room.host.OPEN) {
      room.host.send(data);
    }
  }

  private tallies(room: Room): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [tag, voters] of room.votes) out[tag] = voters.size;
    return out;
  }

  connectHost(room: Room, socket: WebSocket) {
    room.host = socket;
    socket.on('message', (raw) => {
      let msg: any;
      try { msg = JSON.parse(String(raw)); } catch { return; }
      if (msg.type === 'state') {
        room.lastState = msg.payload;
        this.broadcast(room, { type: 'state', payload: msg.payload });
      } else if (msg.type === 'closeVote') {
        let top: string | undefined;
        let max = 0;
        for (const [tag, voters] of room.votes) {
          if (voters.size > max) { max = voters.size; top = tag; }
        }
        room.votes.clear();
        this.broadcast(room, { type: 'voteResult', tag: top ?? null }, true);
      } else if (msg.type === 'announce') {
        this.broadcast(room, { type: 'announce', payload: msg.payload });
      }
    });
    socket.on('close', () => {
      if (room.host === socket) room.host = undefined;
    });
    if (room.lastState) socket.send(JSON.stringify({ type: 'state', payload: room.lastState }));
  }

  connectViewer(room: Room, socket: WebSocket, viewerId: string) {
    const viewer: Viewer = { socket, id: viewerId, lastChaosAt: 0 };
    room.viewers.set(viewerId, viewer);
    this.broadcast(room, { type: 'viewers', count: room.viewers.size }, true);
    if (room.lastState) socket.send(JSON.stringify({ type: 'state', payload: room.lastState }));
    socket.send(JSON.stringify({ type: 'votes', tallies: this.tallies(room) }));

    socket.on('message', (raw) => {
      let msg: any;
      try { msg = JSON.parse(String(raw)); } catch { return; }
      if (msg.type === 'vote' && typeof msg.tag === 'string' && msg.tag.length < 24) {
        // one active vote per viewer — voting again moves it
        for (const voters of room.votes.values()) voters.delete(viewerId);
        if (!room.votes.has(msg.tag)) room.votes.set(msg.tag, new Set());
        room.votes.get(msg.tag)!.add(viewerId);
        this.broadcast(room, { type: 'votes', tallies: this.tallies(room) }, true);
      } else if (msg.type === 'chaos' && CHAOS_KINDS.has(msg.kind)) {
        const now = Date.now();
        if (now < room.chaosCooldownUntil || now - viewer.lastChaosAt < CHAOS_VIEWER_COOLDOWN_MS) {
          socket.send(JSON.stringify({ type: 'chaosDenied', reason: 'cooldown' }));
          return;
        }
        viewer.lastChaosAt = now;
        room.chaosCooldownUntil = now + CHAOS_GLOBAL_COOLDOWN_MS;
        if (room.host && room.host.readyState === room.host.OPEN) {
          room.host.send(JSON.stringify({ type: 'chaos', kind: msg.kind, from: viewerId }));
        }
        this.broadcast(room, { type: 'chaosFired', kind: msg.kind });
      }
    });
    socket.on('close', () => {
      room.viewers.delete(viewerId);
      for (const voters of room.votes.values()) voters.delete(viewerId);
      this.broadcast(room, { type: 'viewers', count: room.viewers.size }, true);
    });
  }
}
