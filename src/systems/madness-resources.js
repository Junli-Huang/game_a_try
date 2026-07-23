const round = (value) => Math.round((Number(value) || 0) * 10000) / 10000;

export function createMonsterMeat(maxMadness, id = undefined) {
  const maximum = Math.max(0, Number(maxMadness) || 0);
  return {
    id: id || `meat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    currentMadness: round(maximum),
    maxMadness: round(maximum)
  };
}

export function normalizeMonsterMeat(value, maxMadness, idPrefix = 'legacy-meat') {
  const fallbackMaximum = Math.max(0, Number(maxMadness) || 0);
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      const maximum = Math.max(0, Number(item?.maxMadness ?? fallbackMaximum) || 0);
      return {
        id: item?.id || `${idPrefix}-${index}`,
        currentMadness: round(Math.max(0, Math.min(maximum, Number(item?.currentMadness ?? maximum) || 0))),
        maxMadness: round(maximum)
      };
    });
  }
  const count = Math.max(0, Math.floor(Number(value) || 0));
  return Array.from({ length: count }, (_, index) => createMonsterMeat(fallbackMaximum, `${idPrefix}-${index}`));
}

export function addMonsterMeat(collection, count, maxMadness, idPrefix = 'meat') {
  const items = normalizeMonsterMeat(collection, maxMadness, idPrefix);
  const amount = Math.max(0, Math.floor(Number(count) || 0));
  for (let index = 0; index < amount; index += 1) {
    items.push(createMonsterMeat(maxMadness, `${idPrefix}-${items.length}-${index}`));
  }
  return items;
}

export function consumeLeastCorruptedMeat(collection) {
  if (!Array.isArray(collection) || !collection.length) return { meat: null, remaining: [] };
  let selectedIndex = 0;
  for (let index = 1; index < collection.length; index += 1) {
    if (collection[index].currentMadness < collection[selectedIndex].currentMadness) selectedIndex = index;
  }
  const remaining = [...collection];
  const [meat] = remaining.splice(selectedIndex, 1);
  return { meat, remaining };
}

export function restoreResistance(save, costMultiplier = 1) {
  const missing = Math.max(0, (save.maxMadnessResistance || 0) - (save.madnessResistance || 0));
  const available = Math.max(0, save.relic?.currentPurification || 0);
  const multiplier = Math.max(0, Number(costMultiplier) || 0);
  const restored = round(multiplier === 0 ? missing : Math.min(missing, available / multiplier));
  const cost = round(restored * multiplier);
  save.madnessResistance = round((save.madnessResistance || 0) + restored);
  save.relic.currentPurification = round(Math.max(0, available - cost));
  return { restored, cost };
}

export function purifyMonsterMeat(save, meatId, costMultiplier = 1) {
  const available = Math.max(0, save.relic?.currentPurification || 0);
  const items = Array.isArray(save.monsterMeat) ? save.monsterMeat : [];
  const index = items.findIndex((item) => item.id === meatId && item.currentMadness > 0);
  const multiplier = Math.max(0, Number(costMultiplier) || 0);
  if (index < 0 || (available <= 0 && multiplier > 0)) return { purified: 0, cost: 0, meat: null };
  const meat = items[index];
  const purified = round(multiplier === 0 ? meat.currentMadness : Math.min(meat.currentMadness, available / multiplier));
  const cost = round(purified * multiplier);
  meat.currentMadness = round(Math.max(0, meat.currentMadness - purified));
  save.relic.currentPurification = round(Math.max(0, available - cost));
  return { purified, cost, meat };
}

export function getResistanceRestorePreview(save, costMultiplier = 1) {
  const missing = Math.max(0, (save.maxMadnessResistance || 0) - (save.madnessResistance || 0));
  const available = Math.max(0, save.relic?.currentPurification || 0);
  const multiplier = Math.max(0, Number(costMultiplier) || 0);
  const restored = round(multiplier === 0 ? missing : Math.min(missing, available / multiplier));
  return { restored, cost: round(restored * multiplier) };
}

export function getMeatPurificationPreview(meat, availablePower, costMultiplier = 1) {
  const pollution = Math.max(0, Number(meat?.currentMadness) || 0);
  const available = Math.max(0, Number(availablePower) || 0);
  const multiplier = Math.max(0, Number(costMultiplier) || 0);
  const purified = round(multiplier === 0 ? pollution : Math.min(pollution, available / multiplier));
  return { purified, cost: round(purified * multiplier), complete: purified >= pollution && pollution > 0 };
}

export function applyEnvironmentalPollution(player, amount, maxMadness) {
  const pollution = Math.max(0, Number(amount) || 0);
  const blocked = round(Math.min(Math.max(0, player.madnessResistance || 0), pollution));
  const overflow = round(pollution - blocked);
  player.madnessResistance = round(Math.max(0, (player.madnessResistance || 0) - blocked));
  player.madness = round(Math.min(maxMadness, (player.madness || 0) + overflow));
  return { blocked, overflow };
}

export function formatResource(value) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}
