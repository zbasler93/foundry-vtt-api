/**
 * OpenClaw WebSocket Client für Foundry VTT
 * Einfache Verbindung zu OpenClaw Server
 */

class OpenClawAPI {
  static ID = 'openclaw-api-bridge';
  static WS_URL = 'ws://72.62.43.31:8766'; // Hardcoded - einfacher!
  
  static log(...args) {
    console.log(`[${this.ID}]`, ...args);
  }

  static initialize() {
    this.log('Initializing...');
    this.ws = null;
    this.connected = false;
    
    // API global verfügbar machen
    window.OpenClaw = {
      connect: () => this.connect(),
      disconnect: () => this.disconnect(),
      status: () => this.connected ? 'verbunden' : 'getrennt',
      createNPC: (data) => this.send('createNPC', data),
      createJournal: (data) => this.send('createJournal', data),
      createScene: (data) => this.send('createScene', data)
    };
    
    this.log('API ready. Nutze: window.OpenClaw.connect()');
    
    // Auto-connect nach 3 Sekunden
    Hooks.once('ready', () => {
      setTimeout(() => {
        this.log('Auto-connecting...');
        this.connect();
      }, 3000);
    });
  }

  static connect() {
    if (this.connected) {
      this.log('Bereits verbunden!');
      return;
    }
    
    try {
      this.log('Verbinde zu:', this.WS_URL);
      this.ws = new WebSocket(this.WS_URL);
      
      this.ws.onopen = () => {
        this.connected = true;
        this.log('✅ Verbunden!');
        ui.notifications.info('🎲 OpenClaw verbunden');
        
        // Identifikation
        this.ws.send(JSON.stringify({
          type: 'identify',
          payload: { world: game.world?.id, system: game.system?.id }
        }));
      };
      
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      };
      
      this.ws.onclose = () => {
        this.connected = false;
        this.log('❌ Verbindung getrennt');
        ui.notifications.warn('OpenClaw getrennt');
        // Reconnect nach 10 Sekunden
        setTimeout(() => this.connect(), 10000);
      };
      
      this.ws.onerror = (err) => {
        this.log('Fehler:', err);
      };
      
    } catch (e) {
      this.log('Verbindung fehlgeschlagen:', e.message);
    }
  }

  static disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  static send(type, payload) {
    if (!this.connected) {
      ui.notifications.error('Nicht verbunden! Nutze window.OpenClaw.connect()');
      return;
    }
    this.ws.send(JSON.stringify({ type, payload }));
    ui.notifications.info(`📤 ${type} gesendet...`);
  }

  static async handleMessage(msg) {
    this.log('Befehl empfangen:', msg.type);
    
    try {
      switch (msg.type) {
        case 'ping':
          this.ws.send(JSON.stringify({ type: 'pong' }));
          break;
          
        case 'createNPC':
          await this.createNPC(msg.payload);
          break;
          
        case 'createJournal':
          await this.createJournal(msg.payload);
          break;
          
        case 'createScene':
          await this.createScene(msg.payload);
          break;
      }
    } catch (e) {
      this.log('Fehler:', e.message);
    }
  }

  static async createNPC(data) {
    const actor = await Actor.create({
      name: data.name || 'NPC',
      type: 'npc',
      img: 'icons/svg/mystery-man.svg',
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
      }
    });
    ui.notifications.info(`🎲 NPC erstellt: ${actor.name}`);
    return actor;
  }

  static async createJournal(data) {
    const journal = await JournalEntry.create({
      name: data.name || 'Journal',
      content: data.content || ''
    });
    ui.notifications.info(`📜 Journal erstellt: ${journal.name}`);
    return journal;
  }

  static async createScene(data) {
    const scene = await Scene.create({
      name: data.name || 'Szene',
      width: 2000,
      height: 2000
    });
    ui.notifications.info(`🗺️ Szene erstellt: ${scene.name}`);
    return scene;
  }
}

// Start
Hooks.once('init', () => OpenClawAPI.initialize());
