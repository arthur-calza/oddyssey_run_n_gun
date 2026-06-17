/* ============================================================
   save.js — persistent profile (localStorage): oregano (currency),
   "Rei do Picadão" tokens, and bought perks/unlocks. Survives reloads.
   ============================================================ */
const Save = {
  KEY: 'oddyssey_chronicles_v1',
  data: { oregano: 0, tokens: 0, perks: {} },

  load() {
    try { const s = localStorage.getItem(this.KEY); if (s) { const d = JSON.parse(s); this.data.oregano = d.oregano | 0; this.data.tokens = d.tokens | 0; this.data.perks = d.perks || {}; } } catch (e) {}
  },
  flush() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {} },

  get oregano() { return this.data.oregano; },
  get tokens() { return this.data.tokens; },
  addOregano(n) { this.data.oregano += n | 0; this.flush(); },
  addTokens(n) { this.data.tokens += n | 0; this.flush(); },
  spend(n) { if (this.data.oregano >= n) { this.data.oregano -= n; this.flush(); return true; } return false; },
  hasPerk(k) { return !!this.data.perks[k]; },
  buy(k, cost) { if (!this.hasPerk(k) && this.spend(cost)) { this.data.perks[k] = true; this.flush(); return true; } return false; },
  reset() { this.data = { oregano: 0, tokens: 0, perks: {} }; this.flush(); },
};
Save.load();

// purchasable perks (spent with oregano, persisted)
const PERKS = [
  { id: 'vigor',    name: 'VIGOR DE FERRO',     cost: 300, desc: '+40 de vida máxima para ambos os heróis.' },
  { id: 'bandolier',name: 'BANDOLEIRA',         cost: 450, desc: 'Começa cada fase com o ESPECIAL carregado.' },
  { id: 'scavenger',name: 'SAQUEADOR',          cost: 600, desc: 'Inimigos largam o dobro de orégano.' },
  { id: 'extralife',name: 'TALISMÃ DA VIDA',    cost: 800, desc: 'Começa cada fase com +1 vida.' },
];
