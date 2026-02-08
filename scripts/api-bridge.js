/**
 * OpenClaw API Bridge for Foundry VTT
 */

class OpenClawAPI {
  static ID = 'openclaw-api-bridge';
  
  static log(...args) {
    console.log(`[${this.ID}]`, ...args);
  }

  static initialize() {
    this.log('Initializing OpenClaw API Bridge...');
    this.registerAPI();
  }

  static registerAPI() {
    window.OpenClaw = {
      createNPC: this.createNPC.bind(this),
      createJournal: this.createJournal.bind(this),
      createScene: this.createScene.bind(this),
      batchImport: this.batchImport.bind(this)
    };
    this.log('API registered at window.OpenClaw');
  }

  static async createNPC(data) {
    const actorData = {
      name: data.name || 'Unbenannter NPC',
      type: data.type || 'npc',
      img: data.img || 'icons/svg/mystery-man.svg',
      system: {
        abilities: data.abilities || {
          str: { value: 10 }, dex: { value: 10 }, con: { value: 10 },
          int: { value: 10 }, wis: { value: 10 }, cha: { value: 10 }
        },
        attributes: {
          ac: { value: data.ac || 10 },
          hp: { value: data.hp || 10, max: data.hp || 10 }
        },
        details: {
          biography: { value: data.description || '' }
        }
      },
      token: { name: data.name || 'NPC' }
    };

    const actor = await Actor.create(actorData);
    this.log('Created NPC:', actor.name);
    ui.notifications.info(`🎲 NPC erstellt: ${actor.name}`);
    return actor;
  }

  static async createJournal(data) {
    const journal = await JournalEntry.create({
      name: data.name || 'Unbenannter Eintrag',
      content: data.content || ''
    });
    this.log('Created Journal:', journal.name);
    ui.notifications.info(`📜 Journal erstellt: ${journal.name}`);
    return journal;
  }

  static async createScene(data) {
    const scene = await Scene.create({
      name: data.name || 'Neue Szene',
      width: data.width || 2000,
      height: data.height || 2000
    });
    this.log('Created Scene:', scene.name);
    return scene;
  }

  static async batchImport(data) {
    const results = { npcs: [], journals: [], scenes: [] };
    if (data.npcs) for (const npc of data.npcs) results.npcs.push(await this.createNPC(npc));
    if (data.journals) for (const j of data.journals) results.journals.push(await this.createJournal(j));
    return results;
  }
}

Hooks.once('init', () => OpenClawAPI.initialize());
