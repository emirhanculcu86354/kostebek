import type { EventBus } from '../core/EventBus';
import { ITEMS } from '../data/ItemData';
import type { GameEvents } from '../game/GameEvents';
import type { GameStateData } from '../game/GameTypes';

export class InventorySystem {
  constructor(
    private getState: () => GameStateData,
    private bus: EventBus<GameEvents>,
  ) {}

  private get inv() {
    return this.getState().inventory;
  }

  count(item: string): number {
    let n = 0;
    for (const s of this.inv.slots) if (s.item === item) n += s.count;
    return n;
  }

  has(item: string, count = 1): boolean {
    return this.count(item) >= count;
  }

  get usedSlots(): number {
    return this.inv.slots.length;
  }

  /** Adds as many as fit; returns the amount actually added. */
  add(item: string, count = 1): number {
    const def = ITEMS[item];
    if (!def || count <= 0) return 0;
    let remaining = count;
    for (const s of this.inv.slots) {
      if (s.item !== item || s.count >= def.maxStack) continue;
      const take = Math.min(def.maxStack - s.count, remaining);
      s.count += take;
      remaining -= take;
      if (remaining === 0) break;
    }
    while (remaining > 0 && this.inv.slots.length < this.inv.capacity) {
      const take = Math.min(def.maxStack, remaining);
      this.inv.slots.push({ item, count: take });
      remaining -= take;
    }
    const added = count - remaining;
    if (added > 0) this.bus.emit('itemAdded', { item, count: added });
    if (remaining > 0) this.bus.emit('inventoryFull', { item });
    return added;
  }

  /** Removes up to count; returns amount removed. Pass force for mission scripting. */
  remove(item: string, count = 1): number {
    let remaining = count;
    const slots = this.inv.slots;
    for (let i = slots.length - 1; i >= 0 && remaining > 0; i--) {
      const s = slots[i];
      if (s.item !== item) continue;
      const take = Math.min(s.count, remaining);
      s.count -= take;
      remaining -= take;
      if (s.count <= 0) slots.splice(i, 1);
    }
    const removed = count - remaining;
    if (removed > 0) this.bus.emit('itemRemoved', { item, count: removed });
    return removed;
  }

  /** Player-initiated discard: mission items are protected. */
  drop(slotIndex: number): boolean {
    const slot = this.inv.slots[slotIndex];
    if (!slot) return false;
    const def = ITEMS[slot.item];
    if (!def || def.missionItem) return false;
    this.inv.slots.splice(slotIndex, 1);
    this.bus.emit('itemRemoved', { item: slot.item, count: slot.count });
    return true;
  }
}
