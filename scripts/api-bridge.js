/**
 * OpenClaw WebSocket Client for Foundry VTT
 * Verbindet sich zu OpenClaw Server für Remote-Commands
 */

class OpenClawWebSocket {
  static ID = 'openclaw-api-bridge';
  static WS_URL = 'wss://ws.openclaw.ai'; // Default, wird überschrieben
  
  static log(...args) {
    console.log(`[${this.ID}]`, ...args);
  }

  static initialize() {
    this.log('Initializing OpenClaw WebSocket Client...');
    
    // Settings registrieren
    game.settings.register(this.ID, 'wsUrl', {
      name: 'WebSocket Server URL',
      hint: 'URL des OpenClaw WebSocket Servers',
      scope: 'world',
      config: true,
      type: String,
      default: 'wss://ws.openclaw.ai'
    });
    
    game.settings.register(this.ID, 'autoConnect', {
      name: 'Auto-Connect',
      hint: 'Automatisch beim Spielstart verbinden',
      scope: 'world',
      config: true,
      type: Boolean,
      default: true
    });
    
    this.registerAPI();
    
    // Auto-connect wenn aktiviert
    if (game.settings.get(this.ID, 'autoConnect')) {
      Hooks.once('ready', () => {
        setTimeout(() => this.connect(), 2000);
      });
    }
  }

  static registerAPI() {
    window.OpenClaw = {
      connect: this.connect.bind(this),
      disconnect: this.disconnect.bind(this),
      isConnected: () => this.ws?.readyState === WebSocket.OPEN,
      createNPC: this.createNPC.bind(this),
      createJournal: this.createJournal.bind(this),
      createScene: this.createScene.bind(this),
      batchImport: this.batchImport.bind(this)
    };
    
    this.log('API registered at window.OpenClaw');
  }

  static connect(url) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.log('Already connected');
      return;
    }
    
    const wsUrl = url || game.settings.get(this.ID, 'wsUrl');
    this.log('Connecting to:', wsUrl);
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        this.log('Connected to OpenClaw');
        ui.notifications.info('🎲 OpenClaw verbunden');
        
        // Identifikation senden
        this.send({
          type: 'identify',
          payload: {
            world: game.world.id,
            system: game.system.id,
            version: game.version
          }
        });
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };
      
      this.ws.onclose = () => {
        this.log('Disconnected from OpenClaw');
        ui.notifications.warn('OpenClaw Verbindung getrennt');
        // Reconnect nach 5 Sekunden
        setTimeout(() => this.connect(), 5000);
      };
      
      this.ws.onerror = (err) => {
        this.log('WebSocket error:', err);
      };
      
    } catch (e) {
      this.log('Connection failed:', e.message);
    }
  }

  static disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  static send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  static async handleMessage(msg) {
    this.log('Received command:', msg.type);
    
    try {
      switch (msg.type) {
        case 'ping':
          this.send({ type: 'pong' });
          break;
          
        case 'createNPC':
          const npc = await this.createNPC(msg.payload);
          this.send({ type: 'result', payload: { success: true, id: npc?.id, name: npc?.name } });
          break;
          
        case 'createJournal':
          const journal = await this.createJournal(msg.payload);
          this.send({ type: 'result', payload: { success: true, id: journal?.id, name: journal?.name } });
          break;
          
        case 'createScene':
          const scene = await this.createScene(msg.payload);
          this.send({ type: 'result', payload: { success: true, id: scene?.id, name: scene?.name } });
          break;
          
        case 'batchImport':
          const results = await this.batchImport(msg.payload);
          this.send({ type: 'result', payload: { success: true, results } });
          break;
          
        default:
          this.log('Unknown command:', msg.type);
      }
    } catch (e) {
      this.log('Error handling message:', e.message);
      this.send({ type: 'error', payload: { message: e.message } });
    }
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
    if (data.scenes) for (const s of data.scenes) results.scenes.push(await this.createScene(s));
    return results;
  }
}

// Initialisierung
Hooks.once('init', () => {
  OpenClawWebSocket.initialize();
});

// SocketLib Integration (falls verfügbar)
Hooks.once('socketlib.ready', () => {
  if (window.socketlib) {
    OpenClawWebSocket.socket = window.socketlib.registerModule(OpenClawWebSocket.ID);
    OpenClawWebSocket.log('SocketLib integration active');
  }
});
