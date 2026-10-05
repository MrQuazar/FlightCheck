import type { Application } from 'pixi.js';
import { GameBoard, PLAYER_SLOTS, type PlayerId } from './GameBoard';
import { Hud, playerLabel } from './Hud';
import { MainMenu } from './MainMenu';
import { loadItems, shuffleItems, type Item } from './loadItems';
import { Sounds } from './sounds';

type PlayerState = {
    id: PlayerId;
    alive: boolean;
    score: number;
    pressedThisRound: boolean;
};

/** Speed tiers follow how many items have been shown this match (survives CSV loops). */
function durationForShownCount(shown: number): number {
    if (shown < 10) return 2000;
    if (shown < 20) return 1000;
    return 800;
}

/**
 * Owns menu ↔ match flow, CSV rounds, input, and win/lose rules.
 */
export class GameManager {
    private readonly app: Application;
    private readonly menu: MainMenu;
    private readonly board: GameBoard;
    private readonly hud: Hud;
    private readonly sounds = new Sounds();

    /** Full CSV catalog (unshuffled). A fresh deck is dealt each match / loop. */
    private catalog: Item[] = [];
    private items: Item[] = [];
    private players: PlayerState[] = [];
    private playerCount: 1 | 2 | 3 | 4 = 1;
    private itemIndex = 0;
    /** How many items have been shown this match (used for speed tiers across loops). */
    private itemsShown = 0;
    private roundActive = false;
    private roundTimer: ReturnType<typeof setTimeout> | null = null;
    private acceptingInput = false;
    private keyHandler: ((event: KeyboardEvent) => void) | null = null;
    private matchRunning = false;
    /** Bumps when a match ends or a new one starts, to ignore stale timers. */
    private runId = 0;

    constructor(app: Application) {
        this.app = app;
        this.menu = new MainMenu();
        this.board = new GameBoard();
        this.hud = new Hud();

        this.app.stage.addChild(this.menu, this.board, this.hud);
        this.board.visible = false;
        this.hud.visible = false;

        this.menu.onSelect((count) => {
            void this.startMatch(count);
        });

        this.board.onPlayerPress((playerId) => this.registerPress(playerId));

        this.layout();
        this.app.renderer.on('resize', () => this.layout());
        window.addEventListener('resize', () => this.layout());
        new ResizeObserver(() => this.layout()).observe(this.app.canvas);
    }

    async init() {
        this.catalog = await loadItems('./items.csv');
        this.hud.setStatus('Choose players');
    }

    private refreshDeck() {
        this.items = shuffleItems(this.catalog);
        this.itemIndex = 0;
    }

    private async startMatch(playerCount: 1 | 2 | 3 | 4) {
        if (this.catalog.length === 0) {
            this.catalog = await loadItems('./items.csv');
        }

        this.stopRoundTimer();
        this.unbindKeys();
        this.sounds.stopClock();

        const runId = ++this.runId;
        this.playerCount = playerCount;
        this.refreshDeck();
        this.itemsShown = 0;
        this.matchRunning = true;
        this.players = PLAYER_SLOTS.filter((slot) => slot.id <= playerCount).map((slot) => ({
            id: slot.id,
            alive: true,
            score: 0,
            pressedThisRound: false,
        }));

        this.menu.visible = false;
        this.board.visible = true;
        this.hud.visible = true;
        this.hud.clear();
        this.hud.setKeyboardHints(playerCount);
        this.hud.setScoreVisible(playerCount === 1);
        this.hud.setScore(0);
        this.hud.setStatus('Get ready...');

        this.board.resetPlayers(playerCount);
        this.board.setText('...');
        this.bindKeys();
        this.layout();

        await this.wait(800);
        if (runId !== this.runId || !this.matchRunning) return;

        this.sounds.startClock();
        this.showNextItem();
    }

    private showNextItem() {
        if (!this.matchRunning) return;

        if (this.items.length === 0) {
            this.finishMatch('No items loaded');
            return;
        }

        // New shuffled list when the deck runs out.
        if (this.itemIndex >= this.items.length) {
            this.refreshDeck();
        }

        const alive = this.alivePlayers();
        if (alive.length === 0) {
            this.finishMatch('Everyone is out!');
            return;
        }

        if (this.playerCount > 1 && alive.length === 1) {
            void this.celebrateWinner(alive[0].id, this.runId);
            return;
        }

        const item = this.items[this.itemIndex];
        const duration = durationForShownCount(this.itemsShown);

        for (const player of this.players) {
            player.pressedThisRound = false;
            if (player.alive) {
                this.board.clearPressed(player.id);
            }
        }

        this.roundActive = true;
        this.acceptingInput = true;
        this.board.setText(item.name);
        this.hud.setStatus(`Round ${this.itemsShown + 1}`);

        this.stopRoundTimer();
        this.roundTimer = setTimeout(() => this.resolveRound(item), duration);
    }

    private resolveRound(item: Item) {
        this.acceptingInput = false;
        this.roundActive = false;
        this.roundTimer = null;

        void this.resolveRoundAnimated(item);
    }

    private async resolveRoundAnimated(item: Item) {
        const runId = this.runId;
        const eliminated: PlayerId[] = [];
        const correctIds: PlayerId[] = [];

        for (const player of this.players) {
            if (!player.alive) continue;

            const answeredFlight = player.pressedThisRound;
            const correct = answeredFlight === item.hasFlight;

            if (correct) {
                player.score += 1;
                correctIds.push(player.id);
            } else {
                player.alive = false;
                eliminated.push(player.id);
            }
        }

        if (eliminated.length > 0) {
            this.sounds.playWrong();
        } else {
            this.sounds.playCorrect();
        }

        await Promise.all([
            ...correctIds.map((id) => this.board.playCorrect(id)),
            ...eliminated.map((id) => this.board.playIncorrect(id)),
        ]);
        if (runId !== this.runId) return;

        for (const id of eliminated) {
            this.board.setPlayerEnabled(id, false);
        }

        if (this.playerCount === 1) {
            this.hud.setScore(this.players[0]?.score ?? 0);
        }

        if (eliminated.length > 0) {
            const names = eliminated.map((id) => playerLabel(id)).join(', ');
            this.hud.setStatus(
                eliminated.length === 1 ? `${names} is out!` : `${names} are out!`,
            );
        } else {
            this.hud.setStatus('All safe!');
            await this.board.playAllPassed(this.app.screen.width);
            if (runId !== this.runId) return;
        }

        this.itemIndex += 1;
        this.itemsShown += 1;

        const alive = this.alivePlayers();

        if (this.playerCount === 1 && alive.length === 0) {
            const score = this.players[0]?.score ?? 0;
            this.finishMatch(`Game over — score ${score}`);
            return;
        }

        if (this.playerCount > 1 && alive.length <= 1) {
            if (alive.length === 1) {
                await this.celebrateWinner(alive[0].id, runId);
            } else {
                this.finishMatch('Everyone is out!');
            }
            return;
        }

        void this.delayThen(runId, () => this.showNextItem(), 350);
    }

    private async celebrateWinner(playerId: PlayerId, runId: number) {
        this.sounds.playWin();
        this.hud.setStatus(`${playerLabel(playerId)} won!`);
        this.board.setText('Winner!');
        await this.board.playWinner(playerId);
        if (runId !== this.runId) return;
        this.finishMatch(`${playerLabel(playerId)} won!`);
    }

    private finishMatch(message: string) {
        const runId = this.runId;
        this.matchRunning = false;
        this.acceptingInput = false;
        this.roundActive = false;
        this.stopRoundTimer();
        this.unbindKeys();
        this.sounds.stopClock();

        this.hud.setStatus(message);
        this.board.setText('Done');

        void this.delayThen(runId, () => this.returnToMenu(), 2200);
    }

    private returnToMenu() {
        this.runId += 1;
        this.sounds.stopClock();
        this.board.visible = false;
        this.hud.visible = false;
        this.hud.clear();
        this.menu.visible = true;
        this.layout();
    }

    private registerPress(playerId: PlayerId) {
        if (!this.acceptingInput || !this.roundActive) return;

        const player = this.players.find((p) => p.id === playerId);
        if (!player || !player.alive || player.pressedThisRound) return;

        player.pressedThisRound = true;
        this.board.markPressed(playerId);
    }

    private bindKeys() {
        this.unbindKeys();
        this.keyHandler = (event: KeyboardEvent) => {
            const slot = PLAYER_SLOTS.find(
                (s) => s.id <= this.playerCount && s.keyCode === event.code,
            );
            if (!slot) return;
            event.preventDefault();
            this.registerPress(slot.id);
        };
        window.addEventListener('keydown', this.keyHandler);
    }

    private unbindKeys() {
        if (this.keyHandler) {
            window.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = null;
        }
    }

    private alivePlayers() {
        return this.players.filter((p) => p.alive);
    }

    private stopRoundTimer() {
        if (this.roundTimer !== null) {
            clearTimeout(this.roundTimer);
            this.roundTimer = null;
        }
    }

    private wait(ms: number) {
        return new Promise<void>((resolve) => setTimeout(resolve, ms));
    }

    private async delayThen(runId: number, action: () => void, ms: number) {
        await this.wait(ms);
        if (runId !== this.runId) return;
        action();
    }

    private layout() {
        const width = this.app.canvas.clientWidth || this.app.screen.width;
        const height = this.app.canvas.clientHeight || this.app.screen.height;
        this.menu.resize(width, height);
        this.menu.x = width / 2;
        this.menu.y = height / 2;
        this.board.resize(width, height);
        this.board.x = width / 2;
        this.board.y = height / 2;
        this.hud.resize(width, height);
    }
}
