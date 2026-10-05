import { Container, Text } from 'pixi.js';
import type { PlayerId } from './GameBoard';
import { PLAYER_SLOTS } from './GameBoard';

/** Top status / score + bottom-right keyboard hints. */
export class Hud extends Container {
    private readonly statusText: Text;
    private readonly scoreText: Text;
    private readonly keysText: Text;
    private viewWidth = 800;
    private viewHeight = 600;

    constructor() {
        super();

        this.statusText = new Text({
            text: '',
            style: {
                fill: 0xffffff,
                fontSize: 22,
                fontFamily: 'Arial',
                fontWeight: 'bold',
                align: 'center',
            },
        });
        this.statusText.anchor.set(0.5, 0);

        this.scoreText = new Text({
            text: '',
            style: {
                fill: 0xffd166,
                fontSize: 18,
                fontFamily: 'Arial',
                align: 'center',
            },
        });
        this.scoreText.anchor.set(0.5, 0);
        this.scoreText.visible = false;

        this.keysText = new Text({
            text: '',
            style: {
                fill: 0xaaaaaa,
                fontSize: 14,
                fontFamily: 'Arial',
                align: 'right',
                lineHeight: 20,
            },
        });
        this.keysText.anchor.set(1, 1);

        this.addChild(this.statusText, this.scoreText, this.keysText);
        this.layout();
    }

    resize(width: number, height: number) {
        this.viewWidth = width;
        this.viewHeight = height;
        const ui = Math.max(0.75, Math.min(1.35, Math.min(width / 900, height / 700)));
        this.statusText.style.fontSize = Math.round(22 * ui);
        this.scoreText.style.fontSize = Math.round(18 * ui);
        this.keysText.style.fontSize = Math.round(14 * ui);
        this.keysText.style.lineHeight = Math.round(20 * ui);
        this.layout();
    }

    setStatus(message: string) {
        this.statusText.text = message;
    }

    setScoreVisible(visible: boolean) {
        this.scoreText.visible = visible;
        this.layout();
    }

    setScore(score: number) {
        this.scoreText.text = `Score: ${score}`;
    }

    setKeyboardHints(playerCount: number) {
        const lines = PLAYER_SLOTS.filter((slot) => slot.id <= playerCount).map(
            (slot) => `${slot.label}: key ${slot.key}`,
        );
        this.keysText.text = ['Keyboard', ...lines].join('\n');
    }

    clear() {
        this.statusText.text = '';
        this.scoreText.text = '';
        this.keysText.text = '';
        this.scoreText.visible = false;
    }

    private layout() {
        this.statusText.x = this.viewWidth / 2;
        this.statusText.y = 24;

        this.scoreText.x = this.viewWidth / 2;
        this.scoreText.y = this.statusText.y + (this.statusText.text ? 28 : 0);

        this.keysText.x = this.viewWidth - 20;
        this.keysText.y = this.viewHeight - 20;
    }
}

export function playerLabel(id: PlayerId): string {
    return `Player ${id}`;
}
